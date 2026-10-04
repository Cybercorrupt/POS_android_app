import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/auth-context";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Icon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { Sheet } from "@/src/components/ui/sheet";
import { useToast } from "@/src/components/ui/toast";
import { qk } from "@/src/db/keys";
import { stockAdjust, stockIn, stockOut } from "@/src/db/repo/inventory";
import { getProduct, listProducts } from "@/src/db/repo/products";
import { parseNumber } from "@/src/lib/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { queryClient } from "@/src/query-client";

type AdjType = "in" | "out" | "adjustment";

const META: Record<AdjType, { title: string; label: string; icon: any; verb: string }> = {
  in: { title: "Stok Masuk", label: "Jumlah Masuk", icon: "tray-arrow-down", verb: "Tambah Stok" },
  out: { title: "Stok Keluar", label: "Jumlah Keluar", icon: "tray-arrow-up", verb: "Kurangi Stok" },
  adjustment: { title: "Penyesuaian Stok", label: "Stok Aktual", icon: "tune-variant", verb: "Sesuaikan" },
};

export default function StockAdjust() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ type?: string; productId?: string }>();
  const type = (params.type as AdjType) ?? "in";
  const meta = META[type];

  const [productId, setProductId] = useState<string | null>(params.productId ?? null);
  const [qty, setQty] = useState(0);
  const [note, setNote] = useState("");
  const [picker, setPicker] = useState(false);
  const [pSearch, setPSearch] = useState("");

  const product = useQuery({ queryKey: qk.product(productId ?? ""), queryFn: () => getProduct(productId!), enabled: !!productId });
  const allProducts = useQuery({ queryKey: qk.products(pSearch), queryFn: () => listProducts(pSearch), enabled: picker });

  const submit = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Pilih produk");
      if (type === "in") await stockIn(productId, qty, note || null, user!.id);
      else if (type === "out") await stockOut(productId, qty, note || null, user!.id);
      else await stockAdjust(productId, qty, note || null, user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show("Stok diperbarui", "success");
      router.back();
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Gagal memperbarui stok", "error"),
  });

  const onSubmit = () => {
    if (!productId) { toast.show("Pilih produk dulu", "error"); return; }
    if (type !== "adjustment" && qty <= 0) { toast.show("Jumlah harus lebih dari 0", "error"); return; }
    submit.mutate();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="stock-adjust-close">
          <Icon name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{meta.title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={20} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Produk</Text>
        <Pressable testID="sa-product" onPress={() => setPicker(true)} style={styles.selector}>
          <Text style={[styles.selectorText, !product.data && styles.placeholder]} numberOfLines={1}>
            {product.data ? product.data.name : "Pilih produk"}
          </Text>
          <Icon name="chevron-right" size={20} color={colors.muted} />
        </Pressable>

        {product.data ? (
          <Card style={styles.currentCard}>
            <View style={[styles.currentIcon, { backgroundColor: colors.brandTertiary }]}>
              <Icon name={meta.icon} size={22} color={colors.brandPrimary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.currentLabel}>Stok saat ini</Text>
              <Text style={styles.currentValue}>{product.data.current_stock} {product.data.unit}</Text>
            </View>
          </Card>
        ) : null}

        <Input
          label={meta.label}
          testID="sa-qty"
          keyboardType="number-pad"
          value={qty ? String(qty) : ""}
          onChangeText={(t) => setQty(parseNumber(t))}
          placeholder="0"
          hint={type === "adjustment" ? "Masukkan jumlah stok fisik yang sebenarnya" : undefined}
        />
        <Input label="Catatan" testID="sa-note" value={note} onChangeText={setNote} placeholder="Opsional" multiline />
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button title={meta.verb} icon="check" onPress={onSubmit} loading={submit.isPending} testID="sa-submit" />
      </View>

      <Sheet visible={picker} onClose={() => setPicker(false)} title="Pilih Produk" scroll>
        <Input testID="sa-search" value={pSearch} onChangeText={setPSearch} placeholder="Cari produk" />
        {(allProducts.data ?? []).map((p) => (
          <Pressable key={p.id} testID={`sa-pick-${p.sku}`} onPress={() => { setProductId(p.id); setPicker(false); }} style={styles.pickRow}>
            <View style={styles.flex}>
              <Text style={styles.pickName}>{p.name}</Text>
              <Text style={styles.pickMeta}>{p.sku} • Stok {p.current_stock}</Text>
            </View>
            {productId === p.id ? <Icon name="check-circle" size={20} color={colors.success} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x2l },
  label: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  selector: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50 },
  selectorText: { fontSize: 16, color: colors.onSurface, flex: 1 },
  placeholder: { color: colors.muted },
  currentCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  currentIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  currentLabel: { fontSize: 13, color: colors.muted },
  currentValue: { fontSize: 20, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  pickRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  pickName: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  pickMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
}));
