import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/ui/button";
import { Icon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { useToast } from "@/src/components/ui/toast";
import { qk } from "@/src/db/keys";
import { createUser } from "@/src/db/repo/users";
import type { RoleName } from "@/src/db/types";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { queryClient } from "@/src/query-client";

export default function UserForm() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleName>("kasir");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => createUser({ username, name, password, roleName: role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users });
      toast.show("Pengguna ditambahkan", "success");
      router.back();
    },
    onError: (e) => {
      const msg = e instanceof Error && e.message.includes("UNIQUE") ? "Username sudah digunakan" : "Gagal menambah pengguna";
      toast.show(msg, "error");
    },
  });

  const onSave = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nama wajib diisi";
    if (!username.trim()) e.username = "Username wajib diisi";
    if (password.length < 4) e.password = "Password minimal 4 karakter";
    setErrors(e);
    if (Object.keys(e).length === 0) save.mutate();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="user-form-close">
          <Icon name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Pengguna Baru</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={20} showsVerticalScrollIndicator={false}>
        <Input label="Nama" testID="uf-name" value={name} onChangeText={setName} placeholder="Nama lengkap" error={errors.name} />
        <Input label="Username" testID="uf-username" value={username} onChangeText={setUsername} placeholder="username" autoCapitalize="none" error={errors.username} />
        <Input label="Password" testID="uf-password" value={password} onChangeText={setPassword} placeholder="••••" secureTextEntry autoCapitalize="none" error={errors.password} />

        <View>
          <Text style={styles.label}>Role</Text>
          <View style={styles.roleRow}>
            {(["kasir", "admin"] as RoleName[]).map((r) => (
              <Pressable key={r} testID={`uf-role-${r}`} onPress={() => setRole(r)} style={[styles.roleBtn, role === r && styles.roleActive]}>
                <Icon name={r === "admin" ? "shield-account-outline" : "account-outline"} size={20} color={role === r ? colors.onBrandPrimary : colors.onSurface} />
                <Text style={[styles.roleText, role === r && styles.roleTextActive]}>{r === "admin" ? "Admin" : "User"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button title="Simpan" icon="check" onPress={onSave} loading={save.isPending} testID="uf-save" />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x2l },
  label: { fontSize: 14, fontWeight: "600", color: colors.onSurface, marginBottom: spacing.xs },
  roleRow: { flexDirection: "row", gap: spacing.md },
  roleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  roleActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  roleText: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  roleTextActive: { color: colors.onBrandPrimary },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
}));
