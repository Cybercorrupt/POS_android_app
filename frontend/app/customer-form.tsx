import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/ui/button";
import { ConfirmSheet } from "@/src/components/ui/confirm-sheet";
import { Icon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { useToast } from "@/src/components/ui/toast";
import { qk } from "@/src/db/keys";
import { createCustomer, getCustomer, softDeleteCustomer, updateCustomer, type CustomerInput } from "@/src/db/repo/customers";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { queryClient } from "@/src/query-client";

export default function CustomerForm() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const existing = useQuery({ queryKey: qk.customer(id ?? ""), queryFn: () => getCustomer(id!), enabled: isEdit });

  useEffect(() => {
    const c = existing.data;
    if (c) {
      setName(c.name);
      setPhone(c.phone ?? "");
      setAddress(c.address ?? "");
      setNote(c.note ?? "");
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const input: CustomerInput = { name, phone: phone || null, address: address || null, note: note || null };
      if (isEdit) await updateCustomer(id!, input);
      else await createCustomer(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show(isEdit ? "Pelanggan diperbarui" : "Pelanggan ditambahkan", "success");
      router.back();
    },
    onError: () => toast.show("Gagal menyimpan", "error"),
  });

  const remove = useMutation({
    mutationFn: () => softDeleteCustomer(id!),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show("Pelanggan dihapus", "success");
      router.back();
    },
  });

  const onSave = () => {
    if (!name.trim()) {
      setNameError("Nama wajib diisi");
      return;
    }
    setNameError(undefined);
    save.mutate();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="customer-form-close">
          <Icon name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? "Edit Pelanggan" : "Pelanggan Baru"}</Text>
        {isEdit ? (
          <Pressable onPress={() => setConfirmDelete(true)} hitSlop={10} testID="customer-delete">
            <Icon name="trash-can-outline" size={22} color={colors.error} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={20} showsVerticalScrollIndicator={false}>
        <Input label="Nama" testID="cf-name" value={name} onChangeText={setName} placeholder="Nama pelanggan" error={nameError} />
        <Input label="Nomor HP" testID="cf-phone" value={phone} onChangeText={setPhone} placeholder="08xxxxxxxxxx" keyboardType="phone-pad" />
        <Input label="Alamat" testID="cf-address" value={address} onChangeText={setAddress} placeholder="Alamat (opsional)" multiline />
        <Input label="Catatan" testID="cf-note" value={note} onChangeText={setNote} placeholder="Catatan (opsional)" multiline />
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button title="Simpan" icon="check" onPress={onSave} loading={save.isPending} testID="cf-save" />
      </View>

      <ConfirmSheet
        visible={confirmDelete}
        title="Hapus Pelanggan?"
        message="Pelanggan akan disembunyikan dari daftar. Riwayat transaksi tetap tersimpan."
        confirmLabel="Hapus"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x2l },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
}));
