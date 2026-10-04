import { useEffect, useState } from "react";
import { Platform, Pressable, Switch, Text, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";

import { useAuth } from "@/src/auth/auth-context";
import { emptyIds, useGoogleDrive, type GoogleIds } from "@/src/auth/google-drive-context";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { ConfirmSheet } from "@/src/components/ui/confirm-sheet";
import { Icon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { Screen } from "@/src/components/ui/screen";
import { useToast } from "@/src/components/ui/toast";
import {
  exportAllData,
  importAllData,
  isValidBackup,
  summarise,
  type BackupData,
} from "@/src/db/repo/backup";
import type { DriveFile } from "@/src/lib/google-drive";
import {
  countProductCsvRows,
  exportSalesCsv,
  importProductsCsv,
  PRODUCTS_CSV_TEMPLATE,
} from "@/src/db/repo/transfer";
import { formatDateTime } from "@/src/lib/format";
import { queryClient } from "@/src/query-client";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const TUTORIAL_STEPS = [
  "Buka console.cloud.google.com, buat atau pilih sebuah Project.",
  "Masuk ke \"APIs & Services\" → \"Library\", cari dan aktifkan \"Google Drive API\".",
  "Buka \"OAuth consent screen\", pilih tipe External, isi nama aplikasi & email dukungan, lalu simpan.",
  "Buka \"Credentials\" → \"Create Credentials\" → \"OAuth client ID\".",
  "Untuk uji di web, pilih tipe \"Web application\" lalu tambahkan Redirect URI di bawah ini ke \"Authorized redirect URIs\". Untuk aplikasi hasil build, buat juga OAuth client Android/iOS dengan package name aplikasi.",
  "Salin Client ID yang terbentuk, tempel ke kolom Kredensial di bawah, lalu tap \"Simpan Kredensial\".",
  "Tap \"Hubungkan Google Drive\", pilih akun Google & izinkan akses. Terakhir tap \"Tes Koneksi\".",
];

export default function Backup() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { user, isAdmin } = useAuth();
  const drive = useGoogleDrive();

  const [exporting, setExporting] = useState(false);
  const [exportingSales, setExportingSales] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingProd, setImportingProd] = useState(false);
  const [pending, setPending] = useState<BackupData | null>(null);
  const [prodCsv, setProdCsv] = useState<string | null>(null);

  // Google Drive state
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [drivePending, setDrivePending] = useState<{ file: DriveFile; data: BackupData } | null>(null);

  // Credentials & tutorial UI
  const [showTutorial, setShowTutorial] = useState(false);
  const [showCreds, setShowCreds] = useState(false);
  const [creds, setCreds] = useState<GoogleIds>(emptyIds());
  const [savingCreds, setSavingCreds] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setCreds(drive.clientIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drive.clientIds.webClientId, drive.clientIds.androidClientId, drive.clientIds.iosClientId]);

  const refreshDriveList = async () => {
    if (!drive.connected) return;
    setLoadingList(true);
    try {
      setDriveFiles(await drive.fetchBackups());
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Gagal memuat daftar backup", "error");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (drive.connected) refreshDriveList();
    else setDriveFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drive.connected]);

  const doConnect = async () => {
    try {
      await drive.connect();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Gagal menghubungkan Google Drive", "error");
    }
  };

  const doDisconnect = async () => {
    await drive.disconnect();
    setDriveFiles([]);
  };

  const doSaveCreds = async () => {
    setSavingCreds(true);
    try {
      await drive.saveClientIds(creds);
      toast.show("Kredensial Google tersimpan", "success");
      setShowCreds(false);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Gagal menyimpan kredensial", "error");
    } finally {
      setSavingCreds(false);
    }
  };

  const doClearCreds = async () => {
    await drive.clearClientIds();
    setCreds(emptyIds());
    setDriveFiles([]);
    toast.show("Kredensial Google dihapus", "info");
  };

  const doTest = async () => {
    setTesting(true);
    try {
      const about = await drive.testConnection();
      toast.show(`Koneksi berhasil: ${about.email || "akun Google terhubung"}`, "success");
      await refreshDriveList();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Tes koneksi gagal", "error");
    } finally {
      setTesting(false);
    }
  };

  const copyRedirect = async () => {
    if (!drive.redirectUri) return;
    await Clipboard.setStringAsync(drive.redirectUri);
    toast.show("Redirect URI disalin", "success");
  };

  const doDriveBackup = async () => {
    setBackingUp(true);
    try {
      await drive.backupNow();
      toast.show("Backup tersimpan ke Google Drive", "success");
      await refreshDriveList();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Gagal backup ke Google Drive", "error");
    } finally {
      setBackingUp(false);
    }
  };

  const openDriveRestore = async (file: DriveFile) => {
    try {
      const data = await drive.restore(file.id);
      if (!isValidBackup(data)) {
        toast.show("File bukan backup Sellix POS yang valid", "error");
        return;
      }
      setDrivePending({ file, data });
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Gagal mengunduh backup", "error");
    }
  };

  const confirmDriveRestore = async () => {
    if (!drivePending) return;
    setRestoring(true);
    try {
      await importAllData(drivePending.data);
      await queryClient.invalidateQueries();
      toast.show("Data dari Google Drive berhasil dipulihkan", "success");
      setDrivePending(null);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Gagal memulihkan data", "error");
    } finally {
      setRestoring(false);
    }
  };

  // Write a text file and open the share sheet (or download on web).
  const saveFile = async (filename: string, content: string, mime: string) => {
    if (Platform.OS === "web") {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.show("File diunduh", "success");
      return;
    }
    const uri = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: filename });
    } else {
      toast.show(`Tersimpan: ${filename}`, "success");
    }
  };

  const today = () => new Date().toISOString().slice(0, 10);

  const doExport = async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      await saveFile(`sellix-backup-${today()}.json`, JSON.stringify(data, null, 2), "application/json");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Gagal mengekspor data", "error");
    } finally {
      setExporting(false);
    }
  };

  const doExportSales = async () => {
    setExportingSales(true);
    try {
      const csv = await exportSalesCsv();
      await saveFile(`sellix-penjualan-${today()}.csv`, csv, "text/csv");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Gagal mengekspor penjualan", "error");
    } finally {
      setExportingSales(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      await saveFile("template-produk.csv", PRODUCTS_CSV_TEMPLATE, "text/csv");
    } catch {
      toast.show("Gagal mengunduh template", "error");
    }
  };

  const readPicked = async (type: string[]): Promise<string | null> => {
    const res = await DocumentPicker.getDocumentAsync({ type, copyToCacheDirectory: true });
    if (res.canceled) return null;
    const asset = res.assets[0];
    if (Platform.OS === "web") {
      const resp = await fetch(asset.uri);
      return resp.text();
    }
    return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  };

  const pickBackup = async () => {
    try {
      const content = await readPicked(["application/json", "text/plain", "*/*"]);
      if (content === null) return;
      const parsed = JSON.parse(content) as unknown;
      if (!isValidBackup(parsed)) {
        toast.show("File bukan backup Sellix POS yang valid", "error");
        return;
      }
      setPending(parsed);
    } catch {
      toast.show("Gagal membaca file backup", "error");
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    setImporting(true);
    try {
      await importAllData(pending);
      await queryClient.invalidateQueries();
      toast.show("Data berhasil dipulihkan", "success");
      setPending(null);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Gagal mengimpor data", "error");
    } finally {
      setImporting(false);
    }
  };

  const pickProducts = async () => {
    try {
      const content = await readPicked(["text/csv", "text/comma-separated-values", "text/plain", "*/*"]);
      if (content === null) return;
      if (countProductCsvRows(content) === 0) {
        toast.show("Tidak ada data produk di file CSV", "error");
        return;
      }
      setProdCsv(content);
    } catch {
      toast.show("Gagal membaca file CSV", "error");
    }
  };

  const confirmImportProducts = async () => {
    if (!prodCsv || !user) return;
    setImportingProd(true);
    try {
      const res = await importProductsCsv(prodCsv, user.id);
      await queryClient.invalidateQueries();
      toast.show(`${res.created} baru, ${res.updated} diperbarui`, "success");
      setProdCsv(null);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Gagal mengimpor produk", "error");
    } finally {
      setImportingProd(false);
    }
  };

  const preview = pending ? summarise(pending) : null;

  return (
    <Screen title="Backup & Transfer" showBack scroll testID="backup-screen">
      <Card style={styles.intro}>
        <View style={styles.introIcon}>
          <Icon name="database-cog-outline" size={26} color={colors.brandPrimary} />
        </View>
        <Text style={styles.introText}>
          Cadangkan seluruh data, ekspor penjualan ke Excel/CSV, dan impor produk beserta stok secara
          massal — semuanya offline.
        </Text>
      </Card>

      <Text style={styles.section}>Google Drive</Text>
      <Card style={styles.cloudCard}>
        <View style={styles.rowHead}>
          <Icon name="google-drive" size={22} color={colors.brandPrimary} />
          <Text style={styles.cardTitle}>Backup ke Google Drive</Text>
        </View>

        {/* Tutorial (show/hide) */}
        <Pressable onPress={() => setShowTutorial((v) => !v)} style={styles.tutorialToggle} testID="drive-tutorial-toggle">
          <Icon name="help-circle-outline" size={18} color={colors.brandPrimary} />
          <Text style={styles.tutorialToggleText}>Cara menghubungkan Google Drive</Text>
          <Icon name={showTutorial ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
        </Pressable>
        {showTutorial ? (
          <View style={styles.tutorialBox} testID="drive-tutorial">
            {TUTORIAL_STEPS.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
            {drive.redirectUri ? (
              <View style={styles.redirectBox}>
                <Text style={styles.redirectLabel}>Redirect URI aplikasi ini (tempel di Google Console):</Text>
                <Pressable onPress={copyRedirect} style={styles.redirectRow} testID="drive-redirect-copy">
                  <Text style={styles.redirectText} selectable numberOfLines={2}>{drive.redirectUri}</Text>
                  <Icon name="content-copy" size={16} color={colors.brandPrimary} />
                </Pressable>
              </View>
            ) : null}
            <Text style={styles.noteText}>
              Catatan: koneksi via web preview memakai Web Client ID. OAuth Android/iOS hanya berfungsi di
              aplikasi hasil build, bukan di Expo Go.
            </Text>
          </View>
        ) : null}

        {/* Admin: credential input */}
        {isAdmin ? (
          <View style={styles.credBox}>
            <View style={styles.credHead}>
              <Text style={styles.credTitle}>Kredensial OAuth {drive.configured ? "✓" : ""}</Text>
              <Pressable onPress={() => setShowCreds((v) => !v)} style={styles.showHide} hitSlop={8} testID="drive-creds-toggle">
                <Icon name={showCreds ? "eye-off-outline" : "eye-outline"} size={18} color={colors.brandPrimary} />
                <Text style={styles.showHideText}>{showCreds ? "Sembunyikan" : "Tampilkan"}</Text>
              </Pressable>
            </View>
            {showCreds ? (
              <>
                <Input
                  label="Web Client ID"
                  testID="cred-web"
                  value={creds.webClientId}
                  onChangeText={(t) => setCreds((c) => ({ ...c, webClientId: t }))}
                  placeholder="1234-xxxx.apps.googleusercontent.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Input
                  label="Android Client ID (opsional)"
                  testID="cred-android"
                  value={creds.androidClientId}
                  onChangeText={(t) => setCreds((c) => ({ ...c, androidClientId: t }))}
                  placeholder="1234-xxxx.apps.googleusercontent.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Input
                  label="iOS Client ID (opsional)"
                  testID="cred-ios"
                  value={creds.iosClientId}
                  onChangeText={(t) => setCreds((c) => ({ ...c, iosClientId: t }))}
                  placeholder="1234-xxxx.apps.googleusercontent.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button title="Simpan Kredensial" icon="content-save-outline" onPress={doSaveCreds} loading={savingCreds} testID="cred-save" />
                {drive.configured ? (
                  <Button title="Hapus Kredensial" variant="outline" icon="delete-outline" onPress={doClearCreds} testID="cred-clear" />
                ) : null}
              </>
            ) : (
              <Text style={styles.credHint}>
                {drive.configured ? "Kredensial tersimpan di perangkat ini." : "Belum ada kredensial. Tap Tampilkan untuk mengisi."}
              </Text>
            )}
          </View>
        ) : null}

        {/* Connection */}
        {!drive.configured ? (
          <View style={styles.warnBox}>
            <Icon name="information-outline" size={18} color={colors.warning} />
            <Text style={styles.warnText}>
              {isAdmin
                ? "Masukkan Client ID Google OAuth di atas untuk mengaktifkan backup ke Drive."
                : "Google Drive belum dikonfigurasi. Hubungi admin untuk mengatur kredensial."}
            </Text>
          </View>
        ) : !drive.connected ? (
          <>
            <Text style={styles.cardDesc}>
              Hubungkan akun Google Anda untuk menyimpan backup di folder &quot;Sellix POS&quot; dan
              memulihkannya kapan saja dari perangkat mana pun.
            </Text>
            <Button
              title="Hubungkan Google Drive"
              icon="google-drive"
              onPress={doConnect}
              loading={drive.connecting}
              testID="drive-connect"
            />
          </>
        ) : (
          <>
            <View style={styles.accountRow} testID="drive-account">
              <Icon name="account-circle-outline" size={20} color={colors.success} />
              <Text style={styles.accountText} numberOfLines={1}>
                {drive.email ?? "Akun Google terhubung"}
              </Text>
              <Text style={styles.disconnect} onPress={doDisconnect} testID="drive-disconnect">
                Putuskan
              </Text>
            </View>

            <Button
              title="Tes Koneksi"
              variant="outline"
              icon="lan-connect"
              onPress={doTest}
              loading={testing}
              testID="drive-test"
            />

            <View style={styles.autoRow}>
              <View style={styles.flex}>
                <Text style={styles.autoTitle}>Backup otomatis</Text>
                <Text style={styles.autoHint}>Simpan otomatis setiap ada transaksi &amp; secara berkala.</Text>
              </View>
              <Switch
                value={drive.autoBackup}
                onValueChange={drive.setAutoBackup}
                trackColor={{ true: colors.brandPrimary, false: colors.border }}
                testID="drive-auto-toggle"
              />
            </View>

            {drive.lastBackupAt ? (
              <Text style={styles.lastBackup}>
                Backup terakhir: {formatDateTime(new Date(drive.lastBackupAt).toISOString())}
              </Text>
            ) : null}

            <Button
              title="Backup Sekarang"
              icon="cloud-upload-outline"
              onPress={doDriveBackup}
              loading={backingUp}
              testID="drive-backup-now"
            />

            <View style={styles.cloudDivider} />

            <View style={styles.rowHead}>
              <Text style={styles.cardTitle}>Pulihkan dari Drive</Text>
            </View>
            <View style={styles.warnBox}>
              <Icon name="alert-outline" size={18} color={colors.warning} />
              <Text style={styles.warnText}>Memulihkan akan menimpa SEMUA data saat ini.</Text>
            </View>

            {loadingList ? (
              <Text style={styles.codeHint}>Memuat daftar backup…</Text>
            ) : driveFiles.length === 0 ? (
              <Text style={styles.codeHint}>Belum ada backup di Google Drive.</Text>
            ) : (
              driveFiles.map((f) => (
                <View key={f.id} style={styles.fileRow} testID={`drive-file-${f.id}`}>
                  <Icon name="file-document-outline" size={20} color={colors.brandPrimary} />
                  <View style={styles.flex}>
                    <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                    <Text style={styles.fileMeta}>{formatDateTime(f.createdTime)}</Text>
                  </View>
                  <Text style={styles.restoreLink} onPress={() => openDriveRestore(f)} testID={`drive-restore-${f.id}`}>
                    Pulihkan
                  </Text>
                </View>
              ))
            )}

            <Button
              title="Muat Ulang Daftar"
              variant="outline"
              icon="refresh"
              onPress={refreshDriveList}
              loading={loadingList}
              testID="drive-refresh"
            />
          </>
        )}
      </Card>

      <Text style={styles.section}>Backup Lengkap</Text>
      <Card style={styles.card}>
        <View style={styles.rowHead}>
          <Icon name="tray-arrow-down" size={22} color={colors.brandPrimary} />
          <Text style={styles.cardTitle}>Simpan / Pulihkan</Text>
        </View>
        <Text style={styles.cardDesc}>Backup berisi seluruh data (produk, transaksi, pelanggan, pengaturan).</Text>
        <Button title="Ekspor Backup (.json)" icon="tray-arrow-down" onPress={doExport} loading={exporting} testID="backup-export" />
        <View style={styles.warnBox}>
          <Icon name="alert-outline" size={18} color={colors.warning} />
          <Text style={styles.warnText}>Impor backup akan menimpa SEMUA data saat ini.</Text>
        </View>
        <Button title="Pulihkan dari Backup" variant="outline" icon="tray-arrow-up" onPress={pickBackup} testID="backup-import" />
      </Card>

      <Text style={styles.section}>Ekspor Penjualan</Text>
      <Card style={styles.card}>
        <View style={styles.rowHead}>
          <Icon name="file-chart-outline" size={22} color={colors.success} />
          <Text style={styles.cardTitle}>Laporan Penjualan (CSV)</Text>
        </View>
        <Text style={styles.cardDesc}>Unduh semua transaksi sebagai file CSV untuk dibuka di Excel / Spreadsheet.</Text>
        <Button title="Ekspor Penjualan" variant="secondary" icon="file-export-outline" onPress={doExportSales} loading={exportingSales} testID="export-sales" />
      </Card>

      <Text style={styles.section}>Impor Produk & Stok</Text>
      <Card style={styles.card}>
        <View style={styles.rowHead}>
          <Icon name="package-variant-closed" size={22} color={colors.accent} />
          <Text style={styles.cardTitle}>Impor dari CSV</Text>
        </View>
        <Text style={styles.cardDesc}>
          Tambah / perbarui banyak produk sekaligus. Kolom: nama, sku, barcode, kategori, unit, harga_modal,
          harga_jual, stok_minimal, stok. Produk dicocokkan berdasarkan SKU lalu nama.
        </Text>
        <Button title="Unduh Template CSV" variant="outline" icon="file-download-outline" onPress={downloadTemplate} testID="download-template" />
        <Button title="Pilih File CSV" variant="secondary" icon="file-import-outline" onPress={pickProducts} testID="import-products" />
      </Card>

      <ConfirmSheet
        visible={!!drivePending}
        title="Pulihkan dari Google Drive?"
        message={
          drivePending
            ? `${drivePending.file.name}` +
              `\nBerisi ${summarise(drivePending.data).products} produk, ${summarise(drivePending.data).sales} transaksi, ${summarise(drivePending.data).customers} pelanggan` +
              `\nDibuat: ${formatDateTime(drivePending.file.createdTime)}` +
              `\n\nSemua data saat ini akan DIGANTI dengan isi backup ini.`
            : ""
        }
        confirmLabel="Ya, Pulihkan"
        destructive
        loading={restoring}
        onConfirm={confirmDriveRestore}
        onClose={() => !restoring && setDrivePending(null)}
      />

      <ConfirmSheet
        visible={!!pending}
        title="Pulihkan Data?"
        message={
          preview
            ? `File berisi ${preview.products} produk, ${preview.sales} transaksi, ${preview.customers} pelanggan` +
              (preview.exportedAt ? `\nDibuat: ${formatDateTime(preview.exportedAt)}` : "") +
              `\n\nSemua data saat ini akan DIGANTI dengan isi file ini.`
            : ""
        }
        confirmLabel="Ya, Pulihkan"
        destructive
        loading={importing}
        onConfirm={confirmImport}
        onClose={() => !importing && setPending(null)}
      />

      <ConfirmSheet
        visible={!!prodCsv}
        title="Impor Produk?"
        message={prodCsv ? `${countProductCsvRows(prodCsv)} baris produk akan ditambahkan atau diperbarui (termasuk stok). Lanjutkan?` : ""}
        confirmLabel="Ya, Impor"
        loading={importingProd}
        onConfirm={confirmImportProducts}
        onClose={() => !importingProd && setProdCsv(null)}
      />
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  intro: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  introIcon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  introText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  section: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xs },
  card: { gap: spacing.md },
  rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  cardDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  warnBox: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.accent + "18", borderRadius: radius.md, padding: spacing.md },
  warnText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  cloudCard: { gap: spacing.md },
  cloudDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs },
  codeHint: { fontSize: 12, color: colors.textSecondary, textAlign: "center" },
  flex: { flex: 1 },
  accountRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md },
  accountText: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.onSurface },
  disconnect: { fontSize: 13, fontWeight: "700", color: colors.error },
  autoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  autoTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  autoHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 2 },
  lastBackup: { fontSize: 12, color: colors.textSecondary, fontStyle: "italic" },
  fileRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md },
  fileName: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  fileMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  restoreLink: { fontSize: 13, fontWeight: "700", color: colors.brandPrimary },
  tutorialToggle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  tutorialToggleText: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.brandPrimary },
  tutorialBox: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  stepRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumText: { fontSize: 12, fontWeight: "800", color: colors.onBrandPrimary },
  stepText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  redirectBox: { gap: 4, marginTop: spacing.xs },
  redirectLabel: { fontSize: 12, fontWeight: "700", color: colors.onSurface },
  redirectRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm },
  redirectText: { flex: 1, fontSize: 11, color: colors.brandPrimary, fontWeight: "600" },
  noteText: { fontSize: 11, color: colors.muted, fontStyle: "italic", lineHeight: 16 },
  credBox: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  credHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  credTitle: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  showHide: { flexDirection: "row", alignItems: "center", gap: 4 },
  showHideText: { fontSize: 13, fontWeight: "700", color: colors.brandPrimary },
  credHint: { fontSize: 12, color: colors.textSecondary },
}));
