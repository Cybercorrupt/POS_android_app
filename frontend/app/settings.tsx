import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";

import { useAuth } from "@/src/auth/auth-context";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Icon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { Screen } from "@/src/components/ui/screen";
import { Sheet } from "@/src/components/ui/sheet";
import { useToast } from "@/src/components/ui/toast";
import { qk } from "@/src/db/keys";
import { changePassword, verifyUserPassword } from "@/src/db/repo/users";
import { getSettings, updateSettings, updateStoreLogo, type SettingsInput } from "@/src/db/repo/settings";
import { parseNumber } from "@/src/lib/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { queryClient } from "@/src/query-client";

export default function Settings() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { user, isAdmin, logout } = useAuth();

  const settings = useQuery({ queryKey: qk.settings, queryFn: getSettings });

  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [tax, setTax] = useState(0);

  const [passSheet, setPassSheet] = useState(false);
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  useEffect(() => {
    const s = settings.data;
    if (s) {
      setStoreName(s.store_name);
      setAddress(s.store_address);
      setPhone(s.store_phone);
      setHeader(s.receipt_header);
      setFooter(s.receipt_footer);
      setTax(s.default_tax_percent);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => {
      const input: SettingsInput = {
        store_name: storeName,
        store_address: address,
        store_phone: phone,
        receipt_header: header,
        receipt_footer: footer,
        default_tax_percent: tax,
      };
      return updateSettings(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.settings });
      toast.show("Pengaturan disimpan", "success");
    },
    onError: () => toast.show("Gagal menyimpan", "error"),
  });

  const savePass = useMutation({
    mutationFn: async () => {
      if (newPass.length < 4) throw new Error("Password minimal 4 karakter");
      if (newPass !== confirmPass) throw new Error("Konfirmasi password tidak cocok");
      const ok = await verifyUserPassword(user!.id, curPass);
      if (!ok) throw new Error("Password saat ini salah");
      await changePassword(user!.id, newPass);
    },
    onSuccess: () => {
      toast.show("Password diperbarui", "success");
      setPassSheet(false);
      setCurPass(""); setNewPass(""); setConfirmPass("");
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Gagal", "error"),
  });

  const saveLogo = useMutation({
    mutationFn: (logo: string | null) => updateStoreLogo(logo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.settings });
      toast.show("Logo disimpan", "success");
    },
    onError: () => toast.show("Gagal menyimpan logo", "error"),
  });

  const pickLogo = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      if (!asset.base64) {
        toast.show("Gagal membaca gambar", "error");
        return;
      }
      const mime = asset.mimeType ?? "image/jpeg";
      saveLogo.mutate(`data:${mime};base64,${asset.base64}`);
    } catch {
      toast.show("Gagal memilih gambar", "error");
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };  return (
    <Screen title="Pengaturan" showBack scroll testID="settings-screen">
      {isAdmin ? (
        <>
          <Text style={styles.section}>Logo Toko</Text>
          <Card style={styles.logoCard}>
            {settings.data?.store_logo ? (
              <Image source={{ uri: settings.data.store_logo }} style={styles.logoPreview} contentFit="contain" testID="logo-preview" />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Icon name="storefront-outline" size={34} color={colors.muted} />
                <Text style={styles.logoHint}>Belum ada logo</Text>
              </View>
            )}
            <View style={styles.logoActions}>
              <View style={styles.flex}>
                <Button title="Unggah Logo" variant="secondary" icon="image-plus" onPress={pickLogo} loading={saveLogo.isPending} testID="logo-upload" />
              </View>
              {settings.data?.store_logo ? (
                <Button title="Hapus" variant="outline" icon="trash-can-outline" fullWidth={false} onPress={() => saveLogo.mutate(null)} testID="logo-remove" />
              ) : null}
            </View>
            <Text style={styles.logoNote}>Logo akan tampil di bagian atas struk.</Text>
          </Card>

          <Text style={styles.section}>Informasi Toko</Text>
          <Card style={styles.card}>
            <Input label="Nama Toko" testID="set-store-name" value={storeName} onChangeText={setStoreName} placeholder="Nama toko" />
            <Input label="Alamat" testID="set-address" value={address} onChangeText={setAddress} placeholder="Alamat toko" multiline />
            <Input label="Telepon" testID="set-phone" value={phone} onChangeText={setPhone} placeholder="No. telepon" keyboardType="phone-pad" />
          </Card>

          <Text style={styles.section}>Struk & Pajak</Text>
          <Card style={styles.card}>
            <Input label="Header Struk" testID="set-header" value={header} onChangeText={setHeader} placeholder="Teks atas struk" multiline />
            <Input label="Footer Struk" testID="set-footer" value={footer} onChangeText={setFooter} placeholder="Teks bawah struk" multiline />
            <Input label="Pajak Default (%)" testID="set-tax" value={tax ? String(tax) : ""} onChangeText={(t) => setTax(parseNumber(t))} placeholder="0" keyboardType="number-pad" />
          </Card>

          <Button title="Simpan Pengaturan" icon="check" onPress={() => save.mutate()} loading={save.isPending} testID="set-save" />
        </>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.readonly}>Hanya admin yang dapat mengubah pengaturan toko.</Text>
        </Card>
      )}

      <Text style={styles.section}>Akun</Text>
      <Card padded={false}>
        <Pressable testID="set-change-pass" onPress={() => setPassSheet(true)} style={styles.rowBtn}>
          <Icon name="lock-reset" size={22} color={colors.brandPrimary} />
          <Text style={styles.rowBtnText}>Ubah Password</Text>
          <Icon name="chevron-right" size={20} color={colors.muted} />
        </Pressable>
        <Pressable testID="set-logout" onPress={onLogout} style={[styles.rowBtn, styles.rowBorder]}>
          <Icon name="logout" size={22} color={colors.error} />
          <Text style={[styles.rowBtnText, { color: colors.error }]}>Keluar</Text>
          <View />
        </Pressable>
      </Card>

      <Text style={styles.appInfo}>Sellix POS by MeO-Labs • Modern POS v1.0{"\n"}Masuk sebagai {user?.name} ({isAdmin ? "Admin" : "User"})</Text>

      <Sheet visible={passSheet} onClose={() => setPassSheet(false)} title="Ubah Password" scroll>
        <Input label="Password Saat Ini" testID="cp-current" value={curPass} onChangeText={setCurPass} secureTextEntry autoCapitalize="none" />
        <Input label="Password Baru" testID="cp-new" value={newPass} onChangeText={setNewPass} secureTextEntry autoCapitalize="none" />
        <Input label="Konfirmasi Password" testID="cp-confirm" value={confirmPass} onChangeText={setConfirmPass} secureTextEntry autoCapitalize="none" />
        <Button title="Simpan Password" onPress={() => savePass.mutate()} loading={savePass.isPending} testID="cp-save" />
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  section: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xs },
  card: { gap: spacing.md },
  readonly: { fontSize: 14, color: colors.muted, textAlign: "center" },
  rowBtn: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowBtnText: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  flex: { flex: 1 },
  logoCard: { gap: spacing.md, alignItems: "stretch" },
  logoPreview: { width: "100%", height: 120, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  logoPlaceholder: { height: 120, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
  logoHint: { fontSize: 13, color: colors.muted },
  logoActions: { flexDirection: "row", gap: spacing.sm, alignItems: "stretch" },
  logoNote: { fontSize: 12, color: colors.muted },
  appInfo: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: spacing.sm, lineHeight: 18 },
}));
