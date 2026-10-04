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
import { createUnit, listUnits, softDeleteUnit } from "@/src/db/repo/units";
import { queryClient } from "@/src/query-client";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function Units() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { isAdmin } = useAuth();

  const units = useQuery({ queryKey: qk.units, queryFn: listUnits });
  const [newUnit, setNewUnit] = useState("");

  const addUnit = useMutation({
    mutationFn: () => createUnit(newUnit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.units });
      setNewUnit("");
      toast.show("Unit ditambahkan", "success");
    },
    onError: () => toast.show("Unit sudah ada", "error"),
  });

  const delUnit = useMutation({
    mutationFn: (id: string) => softDeleteUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.units });
      toast.show("Unit dihapus", "success");
    },
  });

  return (
    <Screen title="Satuan Unit" subtitle="Satuan produk (pcs, box, kg, ...)" showBack scroll testID="units-screen">
      {!isAdmin ? (
        <Card style={styles.card}>
          <Text style={styles.readonly}>Hanya admin yang dapat mengelola satuan unit.</Text>
        </Card>
      ) : (
        <>
          <Card style={styles.addCard}>
            <View style={styles.flex}>
              <Input
                testID="unit-new-input"
                label="Unit Baru"
                value={newUnit}
                onChangeText={setNewUnit}
                placeholder="mis. gram"
                autoCapitalize="none"
              />
            </View>
            <Button title="Tambah" icon="plus" fullWidth={false} onPress={() => newUnit.trim() && addUnit.mutate()} loading={addUnit.isPending} testID="unit-add-btn" />
          </Card>

          {(units.data ?? []).length === 0 ? (
            <EmptyState icon="ruler" title="Belum ada unit" message="Tambahkan satuan unit pertama Anda di atas." />
          ) : (
            <Card padded={false}>
              {(units.data ?? []).map((u, idx) => (
                <View key={u.id} style={[styles.unitRow, idx > 0 && styles.unitBorder]} testID={`unit-row-${u.name}`}>
                  <View style={styles.unitIcon}>
                    <Icon name="ruler" size={18} color={colors.brandPrimary} />
                  </View>
                  <Text style={styles.unitName}>{u.name}</Text>
                  <Pressable testID={`unit-del-${u.name}`} onPress={() => delUnit.mutate(u.id)} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
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
  unitRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  unitBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  unitIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  unitName: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.onSurface },
}));
