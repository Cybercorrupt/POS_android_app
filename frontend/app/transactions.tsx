import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { EmptyState } from "@/src/components/ui/empty-state";
import { Badge } from "@/src/components/ui/badge";
import { Icon } from "@/src/components/ui/icon";
import { Screen } from "@/src/components/ui/screen";
import { SearchBar } from "@/src/components/ui/search-bar";
import { qk } from "@/src/db/keys";
import { listSales } from "@/src/db/repo/sales";
import type { Sale } from "@/src/db/types";
import { formatCurrency, formatDateTime } from "@/src/lib/format";
import { paymentMethodLabel } from "@/src/lib/payment";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Transactions() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const sales = useQuery({ queryKey: qk.sales(search), queryFn: () => listSales(search) });

  useFocusEffect(useCallback(() => { sales.refetch(); }, [sales]));

  const renderItem = ({ item }: { item: Sale }) => (
    <Pressable
      testID={`transaction-row-${item.invoice_no}`}
      onPress={() => router.push(`/transaction-detail?id=${item.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Icon name="receipt" size={22} color={colors.brandPrimary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.invoice}>{item.invoice_no}</Text>
        <Text style={styles.meta} numberOfLines={1}>{formatDateTime(item.created_at)}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.customer_name ?? "Umum"} • {paymentMethodLabel(item.payment_method)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.total, item.status === "void" && styles.voidTotal]}>{formatCurrency(item.grand_total)}</Text>
        <Badge
          label={item.status === "void" ? "Dibatalkan" : item.payment_status === "lunas" ? "Lunas" : "Belum"}
          tone={item.status === "void" ? "danger" : item.payment_status === "lunas" ? "success" : "warning"}
        />
      </View>
    </Pressable>
  );

  return (
    <Screen title="Riwayat Transaksi" subtitle={`${sales.data?.length ?? 0} transaksi`} showBack testID="transactions-screen">
      <View style={styles.searchWrap}>
        <SearchBar testID="transactions-search" value={search} onChangeText={setSearch} placeholder="Cari invoice / pelanggan" />
      </View>
      <FlatList
        data={sales.data ?? []}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={sales.isLoading ? null : <EmptyState icon="receipt" title="Belum ada transaksi" message="Transaksi penjualan akan muncul di sini." />}
      />
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.x2l, gap: spacing.md, flexGrow: 1 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  pressed: { opacity: 0.6 },
  iconWrap: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  invoice: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 2 },
  total: { fontSize: 16, fontWeight: "800", color: colors.brandPrimary },
  voidTotal: { textDecorationLine: "line-through", color: colors.muted },
}));
