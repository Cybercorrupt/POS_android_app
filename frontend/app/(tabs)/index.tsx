import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/src/auth/auth-context";
import { Badge } from "@/src/components/ui/badge";
import { BarChart } from "@/src/components/charts/bar-chart";
import { DonutChart } from "@/src/components/charts/donut-chart";
import { LinearGradient } from "expo-linear-gradient";
import { Card } from "@/src/components/ui/card";
import { Icon, type IconName } from "@/src/components/ui/icon";
import { Screen } from "@/src/components/ui/screen";
import { getDailySalesSeries, getDashboardStats, getPeriodTotals, getRangeReport } from "@/src/db/repo/dashboard";
import { lowStockProducts } from "@/src/db/repo/inventory";
import { getSettings } from "@/src/db/repo/settings";
import { qk } from "@/src/db/keys";
import { formatCurrency } from "@/src/lib/format";
import { paymentMethodLabel } from "@/src/lib/payment";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Dashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const stats = useQuery({ queryKey: qk.dashboard, queryFn: getDashboardStats });
  const low = useQuery({ queryKey: qk.lowStock, queryFn: lowStockProducts });
  const settings = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const periods = useQuery({ queryKey: qk.periodTotals, queryFn: getPeriodTotals, enabled: isAdmin });
  const series = useQuery({ queryKey: qk.salesSeries, queryFn: () => getDailySalesSeries(7), enabled: isAdmin });
  const monthReport = useQuery({
    queryKey: qk.salesReport("dash-month"),
    queryFn: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now);
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      return getRangeReport(start.toISOString(), end.toISOString());
    },
    enabled: isAdmin,
  });

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
      queryClient.invalidateQueries({ queryKey: qk.lowStock });
      if (isAdmin) {
        queryClient.invalidateQueries({ queryKey: qk.periodTotals });
        queryClient.invalidateQueries({ queryKey: qk.salesSeries });
        queryClient.invalidateQueries({ queryKey: qk.salesReport("dash-month") });
      }
    }, [queryClient, isAdmin]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([stats.refetch(), low.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [stats, low]);

  const s = stats.data;

  const donutPalette = [colors.brandPrimary, colors.accent, colors.success, colors.info, colors.brandSecondary];
  const donutData = (monthReport.data?.byMethod ?? [])
    .filter((m) => m.total > 0)
    .map((m, i) => ({ label: paymentMethodLabel(m.method), value: m.total, color: donutPalette[i % donutPalette.length] }));

  const actions: { label: string; icon: IconName; onPress: () => void; show: boolean }[] = [
    { label: "Transaksi", icon: "cart-plus", onPress: () => router.navigate("/(tabs)/pos"), show: true },
    { label: "Produk", icon: "package-variant-closed-plus", onPress: () => router.push("/product-form"), show: isAdmin },
    { label: "Stok Masuk", icon: "tray-arrow-down", onPress: () => router.push("/stock-adjust?type=in"), show: isAdmin },
    { label: "Pelanggan", icon: "account-plus", onPress: () => router.push("/customer-form"), show: true },
  ];

  return (
    <Screen
      title={`Halo, ${user?.name?.split(" ")[0] ?? ""}`}
      subtitle={settings.data?.store_name ?? "Dashboard"}
      scroll
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />
      }
      headerRight={
        <Pressable testID="dashboard-logout" onPress={() => router.push("/settings")} hitSlop={8} style={styles.iconBtn}>
          <Icon name="cog-outline" size={22} color={colors.onSurface} />
        </Pressable>
      }
      testID="dashboard-screen"
    >
      <LinearGradient
        colors={[colors.brandPrimary, colors.brandSecondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>Penjualan Hari Ini</Text>
          <View style={styles.heroBadge}>
            <Icon name="chart-line" size={18} color={colors.onBrandPrimary} />
          </View>
        </View>
        <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit testID="stat-today-sales">
          {formatCurrency(s?.todaySales ?? 0)}
        </Text>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{s?.todayTransactions ?? 0}</Text>
            <Text style={styles.heroStatLabel}>Transaksi</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{s?.todayItemsSold ?? 0}</Text>
            <Text style={styles.heroStatLabel}>Item Terjual</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.grid}>
        <PaymentTile
          icon="check-circle"
          label="Lunas"
          amount={s?.paidTotal ?? 0}
          count={s?.paidCount ?? 0}
          tone={colors.success}
          testID="stat-paid"
        />
        <PaymentTile
          icon="clock-alert-outline"
          label="Belum Dibayar"
          amount={s?.unpaidTotal ?? 0}
          count={s?.unpaidCount ?? 0}
          tone={colors.error}
          testID="stat-unpaid"
        />
      </View>

      <View style={styles.grid}>
        <StatTile icon="package-variant" label="Total Produk" value={String(s?.productCount ?? 0)} tone={colors.info} testID="stat-products" />
        <StatTile
          icon="alert"
          label="Stok Rendah"
          value={String(s?.lowStockCount ?? 0)}
          tone={colors.warning}
          testID="stat-lowstock"
        />
      </View>

      {isAdmin ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ringkasan Penjualan</Text>
            <Pressable testID="dashboard-reports-link" onPress={() => router.push("/daily-report")} hitSlop={6}>
              <Text style={styles.link}>Laporan ›</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow} style={styles.periodScroller}>
            <PeriodCard label="Minggu Ini" value={formatCurrency(periods.data?.week ?? 0)} icon="calendar-week" tone={colors.brandPrimary} />
            <PeriodCard label="Bulan Ini" value={formatCurrency(periods.data?.month ?? 0)} icon="calendar-month" tone={colors.accent} />
            <PeriodCard label="Tahun Ini" value={formatCurrency(periods.data?.year ?? 0)} icon="calendar-star" tone={colors.success} />
          </ScrollView>

          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle}>Penjualan 7 Hari Terakhir</Text>
            <BarChart
              data={(series.data ?? []).map((d) => ({ label: d.label, value: d.total }))}
              formatValue={(v) => formatCurrency(v)}
              testID="dashboard-bar-chart"
            />
          </Card>

          {donutData.length > 0 ? (
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Metode Pembayaran (Bulan Ini)</Text>
              <DonutChart data={donutData} formatValue={(v) => formatCurrency(v)} testID="dashboard-donut-chart" />
            </Card>
          ) : null}

          {(monthReport.data?.topProducts?.length ?? 0) > 0 ? (
            <Card style={styles.chartCard} padded={false} testID="dashboard-top-products">
              <Text style={[styles.chartTitle, styles.topTitle]}>Produk Terlaris (Bulan Ini)</Text>
              {monthReport.data!.topProducts.map((p, i) => (
                <View key={p.product_name} style={[styles.topRow, i > 0 && styles.rowBorder]}>
                  <View style={[styles.topRank, i === 0 && styles.topRankFirst]}>
                    <Text style={[styles.topRankText, i === 0 && styles.topRankTextFirst]}>{i + 1}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.topName} numberOfLines={1}>{p.product_name}</Text>
                    <Text style={styles.topMeta}>{p.qty} terjual</Text>
                  </View>
                  <Text style={styles.topTotal}>{formatCurrency(p.total)}</Text>
                </View>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Aksi Cepat</Text>
      <View style={styles.actionsRow}>
        {actions.filter((a) => a.show).map((a) => (
          <Pressable
            key={a.label}
            testID={`quick-${a.label}`}
            onPress={a.onPress}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <View style={styles.actionIcon}>
              <Icon name={a.icon} size={22} color={colors.brandPrimary} />
            </View>
            <Text style={styles.actionLabel} numberOfLines={1}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Stok Rendah</Text>
        <Pressable onPress={() => router.push("/inventory")} hitSlop={6}>
          <Text style={styles.link}>Lihat semua</Text>
        </Pressable>
      </View>
      {low.data && low.data.length > 0 ? (
        <Card padded={false}>
          {low.data.slice(0, 5).map((p, idx) => (
            <View key={p.id} style={[styles.lowRow, idx > 0 && styles.rowBorder]}>
              <View style={styles.flex}>
                <Text style={styles.lowName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.lowSku}>{p.sku}</Text>
              </View>
              <Badge label={`${p.current_stock} / ${p.min_stock}`} tone={p.current_stock === 0 ? "danger" : "warning"} />
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <Text style={styles.emptyLow}>Semua stok aman 👍</Text>
        </Card>
      )}
    </Screen>
  );
}

function StatTile({ icon, label, value, tone, testID }: { icon: IconName; label: string; value: string; tone: string; testID: string }) {
  const styles = useStyles();
  return (
    <Card style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: tone + "1A" }]}>
        <Icon name={icon} size={20} color={tone} />
      </View>
      <Text style={styles.tileValue} testID={testID}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </Card>
  );
}

function PaymentTile({ icon, label, amount, count, tone, testID }: { icon: IconName; label: string; amount: number; count: number; tone: string; testID: string }) {
  const styles = useStyles();
  return (
    <Card style={styles.tile}>
      <View style={styles.payHead}>
        <View style={[styles.tileIcon, styles.payIcon, { backgroundColor: tone + "1A" }]}>
          <Icon name={icon} size={20} color={tone} />
        </View>
        <View style={[styles.payCountBadge, { backgroundColor: tone + "1A" }]}>
          <Text style={[styles.payCountText, { color: tone }]}>{count} trx</Text>
        </View>
      </View>
      <Text style={styles.payAmount} numberOfLines={1} adjustsFontSizeToFit testID={testID}>{formatCurrency(amount)}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </Card>
  );
}

function PeriodCard({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone: string }) {
  const styles = useStyles();
  return (
    <Card style={styles.periodCard} testID={`period-card-${label}`}>
      <View style={[styles.periodIcon, { backgroundColor: tone + "1A" }]}>
        <Icon name={icon} size={18} color={tone} />
      </View>
      <Text style={styles.periodValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.periodLabel}>{label}</Text>
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  heroCard: { borderRadius: radius.lg, padding: spacing.lg },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroLabel: { color: colors.brandTertiary, fontSize: 14, fontWeight: "600" },
  heroValue: { color: colors.onBrandPrimary, fontSize: 34, fontWeight: "800", marginTop: spacing.sm },
  heroStatsRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg },
  heroStat: { flex: 1 },
  heroStatValue: { color: colors.onBrandPrimary, fontSize: 20, fontWeight: "800" },
  heroStatLabel: { color: colors.brandTertiary, fontSize: 12, marginTop: 2 },
  heroDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.25)" },
  grid: { flexDirection: "row", gap: spacing.md },
  tile: { flex: 1, gap: spacing.xs },
  tileIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  tileValue: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  tileLabel: { fontSize: 13, color: colors.muted },
  payHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  payIcon: { marginBottom: 0 },
  payCountBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  payCountText: { fontSize: 11, fontWeight: "800" },
  payAmount: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  periodScroller: { flexGrow: 0, marginHorizontal: -spacing.lg },
  periodRow: { gap: spacing.md, paddingHorizontal: spacing.lg },
  periodCard: { width: 150, gap: spacing.xs },
  periodIcon: { width: 34, height: 34, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  periodValue: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  periodLabel: { fontSize: 12, color: colors.muted },
  chartCard: { gap: spacing.md },
  chartTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { color: colors.brandPrimary, fontWeight: "700", fontSize: 13 },
  actionsRow: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1, alignItems: "center", gap: spacing.xs, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  actionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 12, fontWeight: "600", color: colors.onSurface },
  pressed: { opacity: 0.7 },
  lowRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  flex: { flex: 1 },
  lowName: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  lowSku: { fontSize: 12, color: colors.muted, marginTop: 2 },
  emptyLow: { color: colors.muted, textAlign: "center", fontSize: 14 },
  topTitle: { padding: spacing.md, paddingBottom: spacing.sm },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  topRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  topRankFirst: { backgroundColor: colors.accent },
  topRankText: { fontSize: 13, fontWeight: "800", color: colors.onSurfaceTertiary },
  topRankTextFirst: { color: colors.onAccent },
  topName: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  topMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  topTotal: { fontSize: 14, fontWeight: "800", color: colors.brandPrimary },
}));
