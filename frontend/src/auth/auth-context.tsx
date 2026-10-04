import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authenticate, getUserById } from "@/src/db/repo/users";
import type { RoleName, User } from "@/src/db/types";
import { storage } from "@/src/utils/storage";

const SESSION_KEY = "pos.session.userId";

interface AuthApi {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  role: RoleName | null;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children, ready }: { children: ReactNode; ready: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const restore = useCallback(async () => {
    const id = await storage.secureGet<string>(SESSION_KEY, "");
    if (id) {
      const found = await getUserById(id);
      setUser(found && found.active ? found : null);
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (ready) restore();
  }, [ready, restore]);

  const login = useCallback(async (username: string, password: string) => {
    const found = await authenticate(username, password);
    if (!found) {
      return { ok: false, error: "Username atau password salah" };
    }
    await storage.secureSet(SESSION_KEY, found.id);
    setUser(found);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await storage.secureRemove(SESSION_KEY);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (user) {
      const found = await getUserById(user.id);
      setUser(found ?? null);
    }
  }, [user]);

  const value = useMemo<AuthApi>(
    () => ({
      user,
      loading,
      isAdmin: user?.role_name === "admin",
      role: user?.role_name ?? null,
      login,
      logout,
      refresh,
    }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
