import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "@/src/auth/auth-context";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { ConfirmSheet } from "@/src/components/ui/confirm-sheet";
import { Icon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { Screen } from "@/src/components/ui/screen";
import { Sheet } from "@/src/components/ui/sheet";
import { useToast } from "@/src/components/ui/toast";
import { Pressable, ScrollView, Text, View } from "react-native";
import { qk } from "@/src/db/keys";
import { getSaleDetails, recordPayment, voidSale } from "@/src/db/repo/sales";
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
  const [paySheet, setPaySheet] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payAmount, setPayAmount] = useState("");

  const voidMut = useMutation({
    mutationFn: () => voidSale(id, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show("Transaksi dibatalkan & stok dikembalikan", "success");
      setVoidSheet(false);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Gagal membatalkan transaksi", "error"),
  });

  const payMut = useMutation({
    mutationFn: () => recordPayment(id, Number((payAmount || "0").replace(/\D/g, "")), payMethod),
    onSuccess: (res) => {
      queryClient.invalidateQueries();
      toast.show(
        res.lunas ? "Pembayaran lunas! Transaksi LUNAS" : `Pembayaran dicatat. Sisa ${formatCurrency(res.outstanding)}`,
        "success",
      );
      setPaySheet(false);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Gagal mencatat pembayaran", "error"),
  });

  function openPaySheet() {
    if (!d) return;
    setPayMethod(d.sale.payment_method);
    setPayAmount(String(outstanding));
    setPaySheet(true);
  }

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
            {!isVoid && d.sale.payment_status === "belum_lunas" ? (
              <Button
                title="Catat Pembayaran"
                icon="cash-plus"
                onPress={openPaySheet}
                testID="record-payment"
              />
            ) : null}
          </Card>

          {d.payments.length > 0 ? (
            <>
              <Text style={styles.section}>Riwayat Pembayaran</Text>
              <Card style={styles.card}>
                {d.payments.map((p) => (
                  <View key={p.id} style={styles.payRow}>
                    <View style={styles.payIcon}>
                      <Icon name={PAYMENT_METHODS.find((m) => m.value === p.method)?.icon ?? "cash"} size={16} color={colors.brandPrimary} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.payMethod}>{paymentMethodLabel(p.method)}</Text>
                      <Text style={styles.payDate}>{formatDateTime(p.created_at)}</Text>
                    </View>
                    <Text style={styles.payAmount}>{formatCurrency(p.paid_amount)}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
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

      <Sheet visible={paySheet} onClose={() => !payMut.isPending && setPaySheet(false)} title="Catat Pembayaran" scroll>
        <Card style={styles.settleTotal}>
          <Text style={styles.settleLabel}>Sisa Tagihan</Text>
          <Text style={styles.settleValue}>{formatCurrency(outstanding)}</Text>
        </Card>
        <Input
          label="Nominal Pembayaran"
          keyboardType="number-pad"
          value={payAmount ? formatCurrency(Number(payAmount.replace(/\D/g, ""))) : ""}
          onChangeText={(t) => setPayAmount(t.replace(/\D/g, ""))}
          placeholder="Masukkan nominal"
          testID="pay-amount-input"
        />
        <Pressable testID="pay-full" onPress={() => setPayAmount(String(outstanding))} style={styles.fullBtn}>
          <Icon name="cash-check" size={16} color={colors.brandPrimary} />
          <Text style={styles.fullText}>Bayar Penuh ({formatCurrency(outstanding)})</Text>
        </Pressable>
        <Text style={styles.settleHint}>Metode pembayaran:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodRow}>
          {PAYMENT_METHODS.map((m) => {
            const active = payMethod === m.value;
            return (
              <Pressable
                key={m.value}
                testID={`pay-method-${m.value}`}
                onPress={() => setPayMethod(m.value)}
                style={[styles.methodChip, active && styles.methodActive]}
              >
                <Icon name={m.icon} size={18} color={active ? colors.onBrandPrimary : colors.onSurface} />
                <Text style={[styles.methodText, active && styles.methodTextActive]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Button
          title="Simpan Pembayaran"
          icon="content-save"
          onPress={() => payMut.mutate()}
          loading={payMut.isPending}
          testID="pay-confirm"
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
  fullBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.brandTertiary },
  fullText: { fontSize: 13, fontWeight: "700", color: colors.brandPrimary },
  payRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  payIcon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  payMethod: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  payDate: { fontSize: 12, color: colors.muted, marginTop: 2 },
  payAmount: { fontSize: 14, fontWeight: "800", color: colors.brandPrimary },
  methodRow: { gap: spacing.sm, paddingVertical: 2 },
  methodChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  methodActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  methodText: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  methodTextActive: { color: colors.onBrandPrimary },
}));
