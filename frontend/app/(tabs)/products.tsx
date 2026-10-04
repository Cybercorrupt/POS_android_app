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
import { listProducts } from "@/src/db/repo/products";
import type { Product } from "@/src/db/types";
import { formatCurrency } from "@/src/lib/format";
import { scanBus } from "@/src/lib/scan-bus";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Products() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");

  const products = useQuery({ queryKey: qk.products(search), queryFn: () => listProducts(search) });

  useFocusEffect(
    useCallback(() => {
      const scanned = scanBus.take();
      if (scanned) setSearch(scanned);
      products.refetch();
    }, [products]),
  );

  const renderItem = ({ item }: { item: Product }) => {
    const low = item.min_stock > 0 && item.current_stock <= item.min_stock;
    return (
      <Pressable
        testID={`product-row-${item.sku}`}
        onPress={() => isAdmin && router.push(`/product-form?id=${item.id}`)}
        style={({ pressed }) => [styles.row, pressed && isAdmin && styles.pressed]}
      >
        <View style={styles.rowIcon}>
          <Icon name="package-variant" size={22} color={colors.brandPrimary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.sku}{item.brand ? ` • ${item.brand}` : ""}{item.category_name ? ` • ${item.category_name}` : ""}
          </Text>
          <Text style={styles.price}>{formatCurrency(item.sell_price)}</Text>
        </View>
        <View style={styles.rowRight}>
          <Badge
            label={`${item.current_stock} ${item.unit}`}
            tone={item.current_stock === 0 ? "danger" : low ? "warning" : "success"}
          />
          {item.active ? null : <Text style={styles.inactive}>Nonaktif</Text>}
          {isAdmin ? <Icon name="chevron-right" size={20} color={colors.muted} /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Screen title="Produk" subtitle={`${products.data?.length ?? 0} item`} testID="products-screen">
      <View style={styles.searchWrap}>
        <SearchBar
          testID="products-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Cari nama / SKU / barcode"
          onScan={() => router.push("/scanner?mode=search")}
        />
      </View>
      <FlatList
        data={products.data ?? []}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          products.isLoading ? null : (
            <EmptyState icon="package-variant" title="Belum ada produk" message={isAdmin ? "Tap tombol + untuk menambah produk." : "Hubungi admin untuk menambah produk."} />
          )
        }
      />
      {isAdmin ? (
        <Pressable
          testID="products-fab"
          onPress={() => router.push("/product-form")}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Icon name="plus" size={26} color={colors.onBrandPrimary} />
        </Pressable>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.x2l * 2, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  pressed: { opacity: 0.6 },
  rowIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  price: { fontSize: 14, fontWeight: "700", color: colors.brandPrimary, marginTop: 4 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  inactive: { fontSize: 11, color: colors.muted },
  sep: { height: 1, backgroundColor: colors.divider },
  fab: {
    position: "absolute", right: spacing.lg, bottom: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  fabPressed: { backgroundColor: colors.brandPrimaryPressed },
}));
