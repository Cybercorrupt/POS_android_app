import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/src/auth/auth-context";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Icon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { Screen } from "@/src/components/ui/screen";
import { useToast } from "@/src/components/ui/toast";
import { qk } from "@/src/db/keys";
import { createBrand, listBrands, softDeleteBrand } from "@/src/db/repo/brands";
import { queryClient } from "@/src/query-client";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function Brands() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { isAdmin } = useAuth();

  const brands = useQuery({ queryKey: qk.brands, queryFn: listBrands });
  const [newBrand, setNewBrand] = useState("");

  const addBrand = useMutation({
    mutationFn: () => createBrand(newBrand),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.brands });
      setNewBrand("");
      toast.show("Merek ditambahkan", "success");
    },
    onError: () => toast.show("Merek sudah ada", "error"),
  });

  const delBrand = useMutation({
    mutationFn: (id: string) => softDeleteBrand(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.brands });
      toast.show("Merek dihapus", "success");
    },
  });

  return (
    <Screen title="Merek" subtitle="Merek / brand produk" showBack scroll testID="brands-screen">
      {!isAdmin ? (
        <Card style={styles.card}>
          <Text style={styles.readonly}>Hanya admin yang dapat mengelola merek.</Text>
        </Card>
      ) : (
        <>
          <Card style={styles.addCard}>
            <View style={styles.flex}>
              <Input
                testID="brand-new-input"
                label="Merek Baru"
                value={newBrand}
                onChangeText={setNewBrand}
                placeholder="mis. Indomie"
              />
            </View>
            <Button title="Tambah" icon="plus" fullWidth={false} onPress={() => newBrand.trim() && addBrand.mutate()} loading={addBrand.isPending} testID="brand-add-btn" />
          </Card>

          {(brands.data ?? []).length === 0 ? (
            <EmptyState icon="tag-outline" title="Belum ada merek" message="Tambahkan merek pertama Anda di atas." />
          ) : (
            <Card padded={false}>
              {(brands.data ?? []).map((b, idx) => (
                <View key={b.id} style={[styles.brandRow, idx > 0 && styles.brandBorder]} testID={`brand-row-${b.name}`}>
                  <View style={styles.brandIcon}>
                    <Icon name="tag-outline" size={18} color={colors.brandPrimary} />
                  </View>
                  <Text style={styles.brandName}>{b.name}</Text>
                  <Pressable testID={`brand-del-${b.name}`} onPress={() => delBrand.mutate(b.id)} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
                    <Icon name="trash-can-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { gap: spacing.md },
  readonly: { fontSize: 14, color: colors.muted, textAlign: "center" },
  addCard: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" },
  flex: { flex: 1 },
  pressed: { opacity: 0.5 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  brandBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  brandIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  brandName: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.onSurface },
}));
