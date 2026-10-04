import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Icon } from "@/src/components/ui/icon";
import { Screen } from "@/src/components/ui/screen";
import { qk } from "@/src/db/keys";
import { getRangeReport } from "@/src/db/repo/dashboard";
import { formatCurrency } from "@/src/lib/format";
import { paymentMethodIcon, paymentMethodLabel } from "@/src/lib/payment";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Period = "today" | "week" | "month" | "year";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "week", label: "Minggu Ini" },
  { key: "month", label: "Bulan Ini" },
  { key: "year", label: "Tahun Ini" },
];

function rangeFor(period: Period): { start: string; end: string; sub: string } {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const end = new Date(todayStart);
  end.setDate(end.getDate() + 1); // include all of today

  let start = new Date(todayStart);
  let sub = "";
  const dOpt: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  if (period === "today") {
    sub = todayStart.toLocaleDateString("id-ID", dOpt);
  } else if (period === "week") {
    start = new Date(todayStart);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    sub = `${start.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${todayStart.toLocaleDateString("id-ID", dOpt)}`;
  } else if (period === "month") {
    start = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    sub = todayStart.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  } else {
    start = new Date(todayStart.getFullYear(), 0, 1);
    sub = String(todayStart.getFullYear());
  }
  return { start: start.toISOString(), end: end.toISOString(), sub };
}

export default function SalesReport() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [period, setPeriod] = useState<Period>("today");

  const { start, end, sub } = useMemo(() => rangeFor(period), [period]);
  const report = useQuery({
    queryKey: qk.salesReport(`${period}-${start.slice(0, 10)}`),
    queryFn: () => getRangeReport(start, end),
  });

  const r = report.data;

  return (
    <Screen title="Laporan Penjualan" showBack scroll testID="sales-report-screen">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroller}
      >
        {PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <Pressable
              key={p.key}
              testID={`period-${p.key}`}
              onPress={() => setPeriod(p.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card style={styles.heroCard} testID="report-total">
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>Total Penjualan</Text>
          <Icon name="chart-line" size={20} color={colors.onBrandPrimary} />
        </View>
        <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(r?.totalSales ?? 0)}</Text>
        <Text style={styles.heroSub}>{sub}</Text>
      </Card>

      {r && r.transactions === 0 ? (
        <EmptyState icon="chart-box-outline" title="Belum ada penjualan" message={`Tidak ada transaksi pada periode ${sub}.`} />
      ) : r ? (
        <>
          <View style={styles.grid}>
            <StatBox icon="receipt-text-outline" label="Transaksi" value={String(r.transactions)} tint={colors.brandPrimary} />
            <StatBox icon="cube-outline" label="Item Terjual" value={String(r.itemsSold)} tint={colors.accent} />
          </View>
          <View style={styles.grid}>
            <StatBox icon="cash-check" label="Terbayar" value={formatCurrency(r.totalPaid)} tint={colors.success} />
            <StatBox icon="cash-clock" label="Piutang" value={formatCurrency(r.totalOutstanding)} tint={colors.warning} />
          </View>

          <Text style={styles.section}>Metode Pembayaran</Text>
          <Card padded={false}>
            {r.byMethod.map((m, idx) => (
              <View key={m.method} style={[styles.row, idx > 0 && styles.rowBorder]} testID={`report-method-${m.method}`}>
                <View style={styles.methodIcon}>
                  <Icon name={paymentMethodIcon(m.method)} size={18} color={colors.brandPrimary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowLabel}>{paymentMethodLabel(m.method)}</Text>
                  <Text style={styles.rowSub}>{m.count} transaksi</Text>
                </View>
                <Text style={styles.rowValue}>{formatCurrency(m.total)}</Text>
              </View>
            ))}
          </Card>

          <Text style={styles.section}>Produk Terlaris</Text>
          <Card padded={false}>
            {r.topProducts.length === 0 ? (
              <Text style={styles.empty}>Belum ada produk terjual.</Text>
            ) : (
              r.topProducts.map((p, idx) => (
                <View key={p.product_name + idx} style={[styles.row, idx > 0 && styles.rowBorder]} testID={`report-top-${idx}`}>
                  <View style={styles.rank}>
                    <Text style={styles.rankText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{p.product_name}</Text>
                    <Text style={styles.rowSub}>{p.qty} terjual</Text>
                  </View>
                  <Text style={styles.rowValue}>{formatCurrency(p.total)}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function StatBox({ icon, label, value, tint }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: string; tint: string }) {
  const styles = useStyles();
  return (
    <Card style={styles.statBox}>
      <View style={[styles.statIcon, { backgroundColor: tint + "22" }]}>
        <Icon name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  chipScroller: { flexGrow: 0, marginHorizontal: -spacing.lg },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  chipTextActive: { color: colors.onBrandPrimary },
  heroCard: { backgroundColor: colors.brandPrimary },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLabel: { fontSize: 13, fontWeight: "600", color: colors.onBrandPrimary, opacity: 0.85 },
  heroValue: { fontSize: 30, fontWeight: "900", color: colors.onBrandPrimary, marginTop: spacing.xs },
  heroSub: { fontSize: 13, color: colors.onBrandPrimary, opacity: 0.85, marginTop: 2 },
  grid: { flexDirection: "row", gap: spacing.md },
  statBox: { flex: 1, gap: spacing.xs },
  statIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xs },
  statLabel: { fontSize: 12, color: colors.muted },
  section: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  methodIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowValue: { fontSize: 15, fontWeight: "800", color: colors.onSurface, fontVariant: ["tabular-nums"] },
  rank: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 15, fontWeight: "900", color: colors.onAccent },
  empty: { fontSize: 14, color: colors.muted, textAlign: "center", padding: spacing.lg },
}));
