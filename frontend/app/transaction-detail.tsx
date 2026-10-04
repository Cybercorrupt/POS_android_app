import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "@/src/auth/auth-context";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { ConfirmSheet } from "@/src/components/ui/confirm-sheet";
import { Icon } from "@/src/components/ui/icon";
import { Screen } from "@/src/components/ui/screen";
import { Sheet } from "@/src/components/ui/sheet";
import { useToast } from "@/src/components/ui/toast";
import { Pressable, ScrollView, Text, View } from "react-native";
import { qk } from "@/src/db/keys";
import { getSaleDetails, settleSale, voidSale } from "@/src/db/repo/sales";
import type { PaymentMethod } from "@/src/db/types";
import { formatCurrency, formatDateTime } from "@/src/lib/format";
import { PAYMENT_METHODS, paymentMethodLabel, paymentStatusLabel } from "@/src/lib/payment";
import { queryClient } from "@/src/query-client";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function TransactionDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { isAdmin, user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useQuery({ queryKey: qk.sale(id), queryFn: () => getSaleDetails(id) });

  const d = detail.data;
  const isVoid = d?.sale.status === "void";
  const outstanding = d ? d.sale.grand_total - d.sale.paid_amount : 0;
  const [voidSheet, setVoidSheet] = useState(false);
  const [settleSheet, setSettleSheet] = useState(false);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>("cash");

  const voidMut = useMutation({
    mutationFn: () => voidSale(id, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show("Transaksi dibatalkan & stok dikembalikan", "success");
      setVoidSheet(false);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Gagal membatalkan transaksi", "error"),
  });

  const settleMut = useMutation({
    mutationFn: () => settleSale(id, settleMethod),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show("Transaksi ditandai LUNAS", "success");
      setSettleSheet(false);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Gagal menandai lunas", "error"),
  });

  return (
    <Screen
      title="Detail Transaksi"
      subtitle={d?.sale.invoice_no}
      showBack
      scroll
      testID="transaction-detail-screen"
      footer={
        <View style={styles.footerRow}>
          <View style={styles.flex}>
            <Button
              title="Lihat Struk"
              variant={isAdmin && !isVoid ? "outline" : "primary"}
              icon="receipt"
              onPress={() => router.push(`/receipt?id=${id}`)}
              testID="view-receipt"
            />
          </View>
          {isAdmin && !isVoid ? (
            <View style={styles.flex}>
              <Button title="Void" variant="danger" icon="cancel" onPress={() => setVoidSheet(true)} testID="void-transaction" />
            </View>
          ) : null}
        </View>
      }
    >
      {d ? (
        <>
          <Card style={styles.card}>
            <Info label="Invoice" value={d.sale.invoice_no} />
            <Info label="Tanggal" value={formatDateTime(d.sale.created_at)} />
            <Info label="Petugas" value={d.sale.cashier_name ?? "-"} />
            <Info label="Pelanggan" value={d.sale.customer_name ?? "Umum"} />
            <View style={styles.badgeRow}>
              {isVoid ? <Badge label="DIBATALKAN" tone="danger" /> : null}
              <Badge label={paymentMethodLabel(d.sale.payment_method)} tone="info" />
              <Badge label={paymentStatusLabel(d.sale.payment_status)} tone={d.sale.payment_status === "lunas" ? "success" : "warning"} />
            </View>
            {d.sale.note ? <Text style={styles.note}>“{d.sale.note}”</Text> : null}
          </Card>

          <Text style={styles.section}>Item</Text>
          <Card style={styles.card}>
            {d.items.map((it) => (
              <View key={it.id} style={styles.itemRow}>
                <View style={styles.flex}>
                  <Text style={styles.itemName} numberOfLines={1}>{it.product_name}</Text>
                  <Text style={styles.itemMeta}>{it.qty} x {formatCurrency(it.price)}</Text>
                </View>
                <Text style={styles.itemTotal}>{formatCurrency(it.line_total)}</Text>
              </View>
            ))}
          </Card>

          <Card style={styles.card}>
            <Info label="Subtotal" value={formatCurrency(d.sale.subtotal)} />
            {d.sale.discount_amount > 0 ? <Info label="Diskon" value={`- ${formatCurrency(d.sale.discount_amount)}`} /> : null}
            {d.sale.tax_amount > 0 ? <Info label={`Pajak ${d.sale.tax_percent}%`} value={formatCurrency(d.sale.tax_amount)} /> : null}
            <View style={styles.divider} />
            <Info label="Grand Total" value={formatCurrency(d.sale.grand_total)} bold />
            <Info label={`Dibayar (${paymentMethodLabel(d.sale.payment_method)})`} value={formatCurrency(d.sale.paid_amount)} />
            {d.sale.payment_method === "cash" && d.sale.change_amount > 0 ? (
              <Info label="Kembalian" value={formatCurrency(d.sale.change_amount)} />
            ) : null}
            {d.sale.payment_status === "belum_lunas" ? (
              <Info label="Sisa Tagihan" value={formatCurrency(d.sale.grand_total - d.sale.paid_amount)} />
            ) : null}
            {isAdmin && !isVoid && d.sale.payment_status === "belum_lunas" ? (
              <Button
                title="Tandai Lunas"
                icon="cash-check"
                onPress={() => {
                  setSettleMethod(d.sale.payment_method);
                  setSettleSheet(true);
                }}
                testID="settle-transaction"
              />
            ) : null}
          </Card>
        </>
      ) : null}

      <ConfirmSheet
        visible={voidSheet}
        title="Batalkan Transaksi?"
        message={`Transaksi ${d?.sale.invoice_no ?? ""} akan dibatalkan (VOID) dan semua stok produk dikembalikan. Tindakan ini tidak bisa diurungkan.`}
        confirmLabel="Ya, Batalkan"
        destructive
        loading={voidMut.isPending}
        onConfirm={() => voidMut.mutate()}
        onClose={() => !voidMut.isPending && setVoidSheet(false)}
      />

      <Sheet visible={settleSheet} onClose={() => !settleMut.isPending && setSettleSheet(false)} title="Tandai Lunas" scroll>
        <Card style={styles.settleTotal}>
          <Text style={styles.settleLabel}>Sisa Tagihan</Text>
          <Text style={styles.settleValue}>{formatCurrency(outstanding)}</Text>
        </Card>
        <Text style={styles.settleHint}>Metode pembayaran pelunasan:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodRow}>
          {PAYMENT_METHODS.map((m) => {
            const active = settleMethod === m.value;
            return (
              <Pressable
                key={m.value}
                testID={`settle-method-${m.value}`}
                onPress={() => setSettleMethod(m.value)}
                style={[styles.methodChip, active && styles.methodActive]}
              >
                <Icon name={m.icon} size={18} color={active ? colors.onBrandPrimary : colors.onSurface} />
                <Text style={[styles.methodText, active && styles.methodTextActive]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Button
          title="Konfirmasi Lunas"
          icon="check-circle"
          onPress={() => settleMut.mutate()}
          loading={settleMut.isPending}
          testID="settle-confirm"
        />
      </Sheet>
    </Screen>
  );
}

function Info({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.infoValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { gap: spacing.sm },
  footerRow: { flexDirection: "row", gap: spacing.md },
  flex: { flex: 1 },
  badgeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs, flexWrap: "wrap" },
  note: { fontSize: 13, color: colors.textSecondary, fontStyle: "italic", marginTop: spacing.xs },
  section: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xs },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoLabel: { fontSize: 14, color: colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  bold: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  itemName: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  itemMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 2 },
  settleTotal: { backgroundColor: colors.brandTertiary, borderColor: colors.brandTertiary, alignItems: "center", gap: 4 },
  settleLabel: { fontSize: 13, color: colors.onBrandTertiary, fontWeight: "600" },
  settleValue: { fontSize: 26, fontWeight: "800", color: colors.onBrandTertiary },
  settleHint: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginTop: spacing.sm },
  methodRow: { gap: spacing.sm, paddingVertical: 2 },
  methodChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  methodActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  methodText: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  methodTextActive: { color: colors.onBrandPrimary },
}));
