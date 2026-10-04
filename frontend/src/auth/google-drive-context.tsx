import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

import { exportAllData } from "@/src/db/repo/backup";
import {
  DriveAuthError,
  downloadBackup,
  getDriveAbout,
  getDriveUser,
  getOrCreateFolder,
  listBackups,
  trashBackup,
  uploadBackup,
  type DriveAbout,
  type DriveFile,
} from "@/src/lib/google-drive";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "pos.gdrive.token";
const EMAIL_KEY = "pos.gdrive.email";
const AUTO_KEY = "pos.gdrive.auto";
const LAST_KEY = "pos.gdrive.lastBackup";
const WEB_ID_KEY = "pos.gdrive.webClientId";
const ANDROID_ID_KEY = "pos.gdrive.androidClientId";
const IOS_ID_KEY = "pos.gdrive.iosClientId";

const SCOPES = ["openid", "profile", "email", "https://www.googleapis.com/auth/drive.file"];
const AUTO_DEBOUNCE_MS = 30 * 1000; // coalesce a burst of sales into one backup
const AUTO_PERIODIC_MS = 20 * 60 * 1000; // safety net while app is open

// A Google OAuth client ID looks like: 1234567890-abcDEF.apps.googleusercontent.com
const CLIENT_ID_RE = /^\d+-[\w-]+\.apps\.googleusercontent\.com$/;

export interface GoogleIds {
  webClientId: string;
  androidClientId: string;
  iosClientId: string;
}

export function emptyIds(): GoogleIds {
  return { webClientId: "", androidClientId: "", iosClientId: "" };
}

export function isValidClientId(value: string): boolean {
  return CLIENT_ID_RE.test(value.trim());
}

function hasAnyId(ids: GoogleIds | null): ids is GoogleIds {
  return !!ids && !!(ids.webClientId || ids.androidClientId || ids.iosClientId);
}

interface GoogleDriveContextValue {
  /** True once at least one Google OAuth Client ID has been saved. */
  configured: boolean;
  /** The saved client IDs (empty strings when not set). */
  clientIds: GoogleIds;
  saveClientIds: (ids: GoogleIds) => Promise<void>;
  clearClientIds: () => Promise<void>;
  /** Redirect URI this app uses — the admin registers this in Google Console. */
  redirectUri: string | null;
  connected: boolean;
  email: string | null;
  connecting: boolean;
  autoBackup: boolean;
  setAutoBackup: (on: boolean) => Promise<void>;
  lastBackupAt: number | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  backupNow: () => Promise<DriveFile>;
  fetchBackups: () => Promise<DriveFile[]>;
  restore: (fileId: string) => Promise<unknown>;
  removeBackup: (fileId: string) => Promise<void>;
  /** Verify the saved connection works; returns the connected account info. */
  testConnection: () => Promise<DriveAbout>;
  /** Debounced auto-backup; safe to call after every sale. */
  scheduleAutoBackup: () => void;
}

const GoogleDriveContext = createContext<GoogleDriveContextValue | null>(null);

/** Full implementation — only mounted once valid client IDs exist. */
function EnabledProvider({
  ids,
  clientIds,
  saveClientIds,
  clearClientIds,
  children,
}: {
  ids: GoogleIds;
  clientIds: GoogleIds;
  saveClientIds: (ids: GoogleIds) => Promise<void>;
  clearClientIds: () => Promise<void>;
  children: ReactNode;
}) {
  // Fallback so the current platform always has a client ID (avoids the
  // library's invariant throw). Empty strings become undefined.
  const platformId =
    Platform.select({ web: ids.webClientId, android: ids.androidClientId, ios: ids.iosClientId, default: ids.webClientId }) ||
    ids.webClientId ||
    ids.androidClientId ||
    ids.iosClientId ||
    undefined;

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: ids.webClientId || undefined,
    androidClientId: ids.androidClientId || undefined,
    iosClientId: ids.iosClientId || undefined,
    clientId: platformId,
    scopes: SCOPES,
    selectAccount: true,
  });

  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [autoBackup, setAutoBackupState] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);

  const tokenRef = useRef<string | null>(null);
  const autoRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  tokenRef.current = token;
  autoRef.current = autoBackup;

  useEffect(() => {
    (async () => {
      const [t, e, a, l] = await Promise.all([
        storage.secureGet<string>(TOKEN_KEY, ""),
        storage.getItem<string>(EMAIL_KEY, ""),
        storage.getItem<boolean>(AUTO_KEY, false),
        storage.getItem<number>(LAST_KEY, 0),
      ]);
      if (t) setToken(t);
      if (e) setEmail(e);
      setAutoBackupState(!!a);
      setLastBackupAt(l ? l : null);
    })();
  }, []);

  const clearSession = useCallback(async () => {
    setToken(null);
    setEmail(null);
    await Promise.all([storage.secureRemove(TOKEN_KEY), storage.removeItem(EMAIL_KEY)]);
  }, []);

  useEffect(() => {
    if (response?.type !== "success") return;
    const accessToken =
      response.authentication?.accessToken ?? (response.params?.access_token as string | undefined);
    if (!accessToken) return;
    (async () => {
      setToken(accessToken);
      await storage.secureSet(TOKEN_KEY, accessToken);
      try {
        const user = await getDriveUser(accessToken);
        setEmail(user.email);
        await storage.setItem(EMAIL_KEY, user.email);
      } catch {
        // Non-fatal: profile fetch failed but Drive access still works.
      }
    })();
  }, [response]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await promptAsync();
    } finally {
      setConnecting(false);
    }
  }, [promptAsync]);

  const disconnect = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const requireToken = useCallback(() => {
    const t = tokenRef.current;
    if (!t) throw new DriveAuthError("Belum terhubung ke Google Drive.");
    return t;
  }, []);

  const markBackedUp = useCallback(async () => {
    const now = Date.now();
    setLastBackupAt(now);
    await storage.setItem(LAST_KEY, now);
  }, []);

  const backupNow = useCallback(async () => {
    const t = requireToken();
    try {
      const data = await exportAllData();
      const file = await uploadBackup(t, data);
      await markBackedUp();
      return file;
    } catch (e) {
      if (e instanceof DriveAuthError) await clearSession();
      throw e;
    }
  }, [requireToken, markBackedUp, clearSession]);

  const fetchBackups = useCallback(async () => {
    const t = requireToken();
    try {
      return await listBackups(t);
    } catch (e) {
      if (e instanceof DriveAuthError) await clearSession();
      throw e;
    }
  }, [requireToken, clearSession]);

  const restore = useCallback(
    async (fileId: string) => {
      const t = requireToken();
      try {
        return await downloadBackup(t, fileId);
      } catch (e) {
        if (e instanceof DriveAuthError) await clearSession();
        throw e;
      }
    },
    [requireToken, clearSession],
  );

  const removeBackup = useCallback(
    async (fileId: string) => {
      const t = requireToken();
      try {
        await trashBackup(t, fileId);
      } catch (e) {
        if (e instanceof DriveAuthError) await clearSession();
        throw e;
      }
    },
    [requireToken, clearSession],
  );

  const testConnection = useCallback(async () => {
    const t = requireToken();
    try {
      const about = await getDriveAbout(t);
      // Also confirm we can create/find our backup folder (write permission).
      await getOrCreateFolder(t);
      if (about.email) {
        setEmail(about.email);
        await storage.setItem(EMAIL_KEY, about.email);
      }
      return about;
    } catch (e) {
      if (e instanceof DriveAuthError) await clearSession();
      throw e;
    }
  }, [requireToken, clearSession]);

  const setAutoBackup = useCallback(async (on: boolean) => {
    setAutoBackupState(on);
    await storage.setItem(AUTO_KEY, on);
  }, []);

  const runAutoBackup = useCallback(async () => {
    if (!autoRef.current || !tokenRef.current) return;
    try {
      const data = await exportAllData();
      await uploadBackup(tokenRef.current, data);
      await markBackedUp();
    } catch (e) {
      if (e instanceof DriveAuthError) await clearSession();
      // Auto-backup failures stay silent; manual backup surfaces errors.
    }
  }, [markBackedUp, clearSession]);

  const scheduleAutoBackup = useCallback(() => {
    if (!autoRef.current || !tokenRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runAutoBackup();
    }, AUTO_DEBOUNCE_MS);
  }, [runAutoBackup]);

  useEffect(() => {
    const id = setInterval(() => {
      runAutoBackup();
    }, AUTO_PERIODIC_MS);
    return () => clearInterval(id);
  }, [runAutoBackup]);

  const value = useMemo<GoogleDriveContextValue>(
    () => ({
      configured: true,
      clientIds,
      saveClientIds,
      clearClientIds,
      redirectUri: request?.redirectUri ?? null,
      connected: !!token,
      email,
      connecting,
      autoBackup,
      setAutoBackup,
      lastBackupAt,
      connect,
      disconnect,
      backupNow,
      fetchBackups,
      restore,
      removeBackup,
      testConnection,
      scheduleAutoBackup,
    }),
    [
      clientIds,
      saveClientIds,
      clearClientIds,
      request?.redirectUri,
      token,
      email,
      connecting,
      autoBackup,
      setAutoBackup,
      lastBackupAt,
      connect,
      disconnect,
      backupNow,
      fetchBackups,
      restore,
      removeBackup,
      testConnection,
      scheduleAutoBackup,
    ],
  );

  return <GoogleDriveContext.Provider value={value}>{children}</GoogleDriveContext.Provider>;
}

/** Lightweight value used before any client ID is saved (no OAuth hook mounted). */
function DisabledProvider({
  clientIds,
  saveClientIds,
  clearClientIds,
  children,
}: {
  clientIds: GoogleIds;
  saveClientIds: (ids: GoogleIds) => Promise<void>;
  clearClientIds: () => Promise<void>;
  children: ReactNode;
}) {
  const needIds = async (): Promise<never> => {
    throw new Error("Masukkan Client ID Google terlebih dahulu");
  };
  const value = useMemo<GoogleDriveContextValue>(
    () => ({
      configured: false,
      clientIds,
      saveClientIds,
      clearClientIds,
      redirectUri: null,
      connected: false,
      email: null,
      connecting: false,
      autoBackup: false,
      setAutoBackup: async () => {},
      lastBackupAt: null,
      connect: needIds,
      disconnect: async () => {},
      backupNow: needIds,
      fetchBackups: async () => [],
      restore: needIds,
      removeBackup: async () => {},
      testConnection: needIds,
      scheduleAutoBackup: () => {},
    }),
    [clientIds, saveClientIds, clearClientIds],
  );
  return <GoogleDriveContext.Provider value={value}>{children}</GoogleDriveContext.Provider>;
}

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<GoogleIds | null>(null);

  useEffect(() => {
    (async () => {
      const [w, a, i] = await Promise.all([
        storage.getItem<string>(WEB_ID_KEY, ""),
        storage.getItem<string>(ANDROID_ID_KEY, ""),
        storage.getItem<string>(IOS_ID_KEY, ""),
      ]);
      const loaded: GoogleIds = { webClientId: w ?? "", androidClientId: a ?? "", iosClientId: i ?? "" };
      if (hasAnyId(loaded)) setIds(loaded);
    })();
  }, []);

  const saveClientIds = useCallback(async (next: GoogleIds) => {
    const clean: GoogleIds = {
      webClientId: next.webClientId.trim(),
      androidClientId: next.androidClientId.trim(),
      iosClientId: next.iosClientId.trim(),
    };
    const provided = [clean.webClientId, clean.androidClientId, clean.iosClientId].filter(Boolean);
    if (provided.length === 0) throw new Error("Masukkan minimal satu Client ID");
    if (provided.some((v) => !isValidClientId(v))) {
      throw new Error("Format Client ID tidak valid (harus diakhiri .apps.googleusercontent.com)");
    }
    await Promise.all([
      storage.setItem(WEB_ID_KEY, clean.webClientId),
      storage.setItem(ANDROID_ID_KEY, clean.androidClientId),
      storage.setItem(IOS_ID_KEY, clean.iosClientId),
    ]);
    setIds(clean);
  }, []);

  const clearClientIds = useCallback(async () => {
    await Promise.all([
      storage.removeItem(WEB_ID_KEY),
      storage.removeItem(ANDROID_ID_KEY),
      storage.removeItem(IOS_ID_KEY),
      storage.secureRemove(TOKEN_KEY),
      storage.removeItem(EMAIL_KEY),
    ]);
    setIds(null);
  }, []);

  const clientIds = ids ?? emptyIds();

  if (!hasAnyId(ids)) {
    return (
      <DisabledProvider clientIds={clientIds} saveClientIds={saveClientIds} clearClientIds={clearClientIds}>
        {children}
      </DisabledProvider>
    );
  }

  // Remount when IDs change so useAuthRequest rebuilds with the new clientId.
  const remountKey = `${ids.webClientId}|${ids.androidClientId}|${ids.iosClientId}`;
  return (
    <EnabledProvider
      key={remountKey}
      ids={ids}
      clientIds={clientIds}
      saveClientIds={saveClientIds}
      clearClientIds={clearClientIds}
    >
      {children}
    </EnabledProvider>
  );
}

export function useGoogleDrive(): GoogleDriveContextValue {
  const ctx = useContext(GoogleDriveContext);
  if (!ctx) throw new Error("useGoogleDrive must be used within GoogleDriveProvider");
  return ctx;
}
