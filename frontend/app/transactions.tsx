import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/src/components/ui/empty-state";
import { Badge } from "@/src/components/ui/badge";
import { Icon } from "@/src/components/ui/icon";
import { Screen } from "@/src/components/ui/screen";
import { SearchBar } from "@/src/components/ui/search-bar";
import { qk } from "@/src/db/keys";
import { listSales } from "@/src/db/repo/sales";
import type { PaymentMethod, Sale } from "@/src/db/types";
import { formatCurrency, formatDateTime } from "@/src/lib/format";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/src/lib/payment";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Transactions() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const sales = useQuery({ queryKey: qk.sales(search), queryFn: () => listSales(search) });

  useFocusEffect(useCallback(() => { sales.refetch(); }, [sales]));

  const [statusFilter, setStatusFilter] = useState<"all" | "lunas" | "belum_lunas" | "void">("all");
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "all">("all");

  const STATUS_CHIPS: { value: "all" | "lunas" | "belum_lunas" | "void"; label: string }[] = [
    { value: "all", label: "Semua" },
    { value: "lunas", label: "Lunas" },
    { value: "belum_lunas", label: "Belum Lunas" },
    { value: "void", label: "Dibatalkan" },
  ];

  const filtered = useMemo(() => {
    return (sales.data ?? []).filter((s) => {
      if (statusFilter === "void" && s.status !== "void") return false;
      if (statusFilter === "lunas" && (s.status === "void" || s.payment_status !== "lunas")) return false;
      if (statusFilter === "belum_lunas" && (s.status === "void" || s.payment_status !== "belum_lunas")) return false;
      if (methodFilter !== "all" && s.payment_method !== methodFilter) return false;
      return true;
    });
  }, [sales.data, statusFilter, methodFilter]);

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
    <Screen title="Riwayat Transaksi" subtitle={`${filtered.length} transaksi`} showBack testID="transactions-screen">
      <View style={styles.searchWrap}>
        <SearchBar testID="transactions-search" value={search} onChangeText={setSearch} placeholder="Cari invoice / pelanggan" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
        {STATUS_CHIPS.map((c) => {
          const active = statusFilter === c.value;
          return (
            <Pressable
              key={c.value}
              testID={`filter-status-${c.value}`}
              onPress={() => setStatusFilter(c.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
        <Pressable
          testID="filter-method-all"
          onPress={() => setMethodFilter("all")}
          style={[styles.chip, methodFilter === "all" && styles.chipActive]}
        >
          <Text style={[styles.chipText, methodFilter === "all" && styles.chipTextActive]}>Semua Metode</Text>
        </Pressable>
        {PAYMENT_METHODS.map((m) => {
          const active = methodFilter === m.value;
          return (
            <Pressable
              key={m.value}
              testID={`filter-method-${m.value}`}
              onPress={() => setMethodFilter(m.value)}
              style={[styles.chip, styles.chipWithIcon, active && styles.chipActive]}
            >
              <Icon name={m.icon} size={15} color={active ? colors.onBrandPrimary : colors.textSecondary} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={sales.isLoading ? null : <EmptyState icon="receipt" title="Tidak ada transaksi" message="Coba ubah kata kunci atau filter." />}
      />
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  chipScroll: { flexGrow: 0 },
  chipRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipWithIcon: { flexDirection: "row", gap: 6 },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  chipTextActive: { color: colors.onBrandPrimary },
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
