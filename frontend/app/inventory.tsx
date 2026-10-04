import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { useAuth } from "@/src/auth/auth-context";
import { Badge } from "@/src/components/ui/badge";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Icon } from "@/src/components/ui/icon";
import { Screen } from "@/src/components/ui/screen";
import { SearchBar } from "@/src/components/ui/search-bar";
import { qk } from "@/src/db/keys";
import { listMovements } from "@/src/db/repo/inventory";
import { listProducts } from "@/src/db/repo/products";
import type { MovementType, Product, StockMovement } from "@/src/db/types";
import { formatDateTime } from "@/src/lib/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Tab = "stock" | "history";

export default function Inventory() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("stock");
  const [search, setSearch] = useState("");

  const products = useQuery({ queryKey: qk.products(search), queryFn: () => listProducts(search) });
  const movements = useQuery({ queryKey: qk.movements, queryFn: () => listMovements(150) });

  useFocusEffect(useCallback(() => { products.refetch(); movements.refetch(); }, [products, movements]));

  const go = (type: string, productId: string) => router.push(`/stock-adjust?type=${type}&productId=${productId}`);

  const renderProduct = ({ item }: { item: Product }) => {
    const low = item.min_stock > 0 && item.current_stock <= item.min_stock;
    return (
      <View style={styles.card} testID={`inv-product-${item.sku}`}>
        <View style={styles.cardTop}>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.meta}>{item.sku}</Text>
          </View>
          <View style={styles.stockWrap}>
            <Text style={[styles.stockValue, low && { color: colors.warning }, item.current_stock === 0 && { color: colors.error }]}>{item.current_stock}</Text>
            <Text style={styles.stockUnit}>{item.unit}</Text>
          </View>
        </View>
        {isAdmin ? (
          <View style={styles.actions}>
            <ActionChip label="Masuk" icon="tray-arrow-down" tone={colors.success} onPress={() => go("in", item.id)} testID={`inv-in-${item.sku}`} />
            <ActionChip label="Keluar" icon="tray-arrow-up" tone={colors.error} onPress={() => go("out", item.id)} testID={`inv-out-${item.sku}`} />
            <ActionChip label="Sesuaikan" icon="tune-variant" tone={colors.info} onPress={() => go("adjustment", item.id)} testID={`inv-adj-${item.sku}`} />
          </View>
        ) : null}
      </View>
    );
  };

  const typeLabel: Record<MovementType, string> = { in: "Masuk", out: "Keluar", adjustment: "Penyesuaian", sale: "Penjualan" };
  const typeTone: Record<MovementType, "success" | "danger" | "info" | "neutral"> = { in: "success", out: "danger", adjustment: "info", sale: "neutral" };

  const renderMovement = ({ item }: { item: StockMovement }) => (
    <View style={styles.moveRow} testID="movement-row">
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>{item.product_name ?? "Produk"}</Text>
        <Text style={styles.meta}>{formatDateTime(item.created_at)}{item.user_name ? ` • ${item.user_name}` : ""}</Text>
        {item.note ? <Text style={styles.note} numberOfLines={1}>{item.note}</Text> : null}
      </View>
      <View style={styles.moveRight}>
        <Badge label={typeLabel[item.type]} tone={typeTone[item.type]} />
        <Text style={[styles.qtyChange, { color: item.qty_change >= 0 ? colors.success : colors.error }]}>
          {item.qty_change >= 0 ? "+" : ""}{item.qty_change}
        </Text>
        <Text style={styles.moveStock}>{item.qty_before} → {item.qty_after}</Text>
      </View>
    </View>
  );

  return (
    <Screen title="Inventori" showBack testID="inventory-screen">
      <View style={styles.segment}>
        <Pressable testID="inv-tab-stock" onPress={() => setTab("stock")} style={[styles.segBtn, tab === "stock" && styles.segActive]}>
          <Text style={[styles.segText, tab === "stock" && styles.segTextActive]}>Stok Produk</Text>
        </Pressable>
        <Pressable testID="inv-tab-history" onPress={() => setTab("history")} style={[styles.segBtn, tab === "history" && styles.segActive]}>
          <Text style={[styles.segText, tab === "history" && styles.segTextActive]}>Riwayat</Text>
        </Pressable>
      </View>

      {tab === "stock" ? (
        <>
          <View style={styles.searchWrap}>
            <SearchBar testID="inv-search" value={search} onChangeText={setSearch} placeholder="Cari produk" />
          </View>
          <FlatList
            data={products.data ?? []}
            keyExtractor={(i) => i.id}
            renderItem={renderProduct}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={products.isLoading ? null : <EmptyState icon="package-variant" title="Belum ada produk" />}
          />
        </>
      ) : (
        <FlatList
          data={movements.data ?? []}
          keyExtractor={(i) => i.id}
          renderItem={renderMovement}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={movements.isLoading ? null : <EmptyState icon="history" title="Belum ada pergerakan stok" />}
        />
      )}
    </Screen>
  );
}

function ActionChip({ label, icon, tone, onPress, testID }: { label: string; icon: any; tone: string; onPress: () => void; testID: string }) {
  const styles = useStyles();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={16} color={tone} />
      <Text style={[styles.chipText, { color: tone }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4, margin: spacing.lg, marginBottom: spacing.sm },
  segBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: "center" },
  segActive: { backgroundColor: colors.surfaceSecondary },
  segText: { fontSize: 14, fontWeight: "700", color: colors.muted },
  segTextActive: { color: colors.brandPrimary },
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.x2l, gap: spacing.md, flexGrow: 1 },
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  note: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  stockWrap: { alignItems: "center" },
  stockValue: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  stockUnit: { fontSize: 11, color: colors.muted },
  actions: { flexDirection: "row", gap: spacing.sm },
  chip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingVertical: spacing.sm },
  chipText: { fontSize: 13, fontWeight: "700" },
  sep: { height: spacing.md },
  moveRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  moveRight: { alignItems: "flex-end", gap: 4 },
  qtyChange: { fontSize: 18, fontWeight: "800" },
  moveStock: { fontSize: 12, color: colors.muted },
}));
