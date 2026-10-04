import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { Button } from "@/src/components/ui/button";
import { Icon, type IconName } from "@/src/components/ui/icon";
import { Image } from "expo-image";
import { useToast } from "@/src/components/ui/toast";
import { qk } from "@/src/db/keys";
import { getSaleDetails } from "@/src/db/repo/sales";
import { getSettings } from "@/src/db/repo/settings";
import type { SaleWithDetails, Settings } from "@/src/db/types";
import { formatCurrency, formatDateTime } from "@/src/lib/format";
import { paymentMethodLabel } from "@/src/lib/payment";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Receipt() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const paperRef = useRef<View>(null);
  const { id } = useLocalSearchParams<{ id: string }>();

  const detail = useQuery({ queryKey: qk.sale(id), queryFn: () => getSaleDetails(id) });
  const settings = useQuery({ queryKey: qk.settings, queryFn: getSettings });

  const d = detail.data;
  const s = settings.data;

  const isVoid = d?.sale.status === "void";
  const statusLabel = isVoid ? "DIBATALKAN" : d?.sale.payment_status === "lunas" ? "LUNAS" : "BELUM LUNAS";
  const statusHex = isVoid ? "#6B7280" : d?.sale.payment_status === "lunas" ? "#16A34A" : "#DC2626";
  const statusTone = isVoid ? colors.textSecondary : d?.sale.payment_status === "lunas" ? colors.success : colors.error;
  const statusIcon: IconName = isVoid ? "cancel" : d?.sale.payment_status === "lunas" ? "check-circle" : "clock-alert-outline";

  const shareImage = async () => {
    if (Platform.OS === "web") {
      toast.show("Bagikan gambar tersedia di aplikasi HP", "info");
      return;
    }
    try {
      const uri = await captureRef(paperRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Bagikan Struk" });
      } else {
        toast.show("Berbagi tidak tersedia di perangkat ini", "error");
      }
    } catch {
      toast.show("Gagal membuat gambar struk", "error");
    }
  };

  const printReceipt = async () => {
    if (!d || !s) return;
    try {
      await Print.printAsync({ html: buildReceiptHtml(d, s) });
    } catch {
      // user dismissed the print dialog
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successBadge}>
          <Icon name="check-circle" size={44} color={colors.success} />
          <Text style={styles.successText}>Transaksi Berhasil</Text>
        </View>

        {d && s ? (
          <View style={styles.paper} ref={paperRef} collapsable={false} testID="receipt-paper">
            <View pointerEvents="none" style={styles.watermark}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Text key={i} style={[styles.watermarkText, { color: statusHex }]}>{statusLabel}</Text>
              ))}
            </View>

            <View style={styles.brandHeader}>
              {s.store_logo ? (
                <Image source={{ uri: s.store_logo }} style={styles.logo} contentFit="contain" testID="receipt-logo" />
              ) : (
                <View style={styles.logoFallback}>
                  <Icon name="storefront-outline" size={26} color={colors.brandPrimary} />
                </View>
              )}
              <Text style={styles.storeName}>{s.store_name || "Toko"}</Text>
              {s.store_address ? <Text style={styles.storeInfo}>{s.store_address}</Text> : null}
              {s.store_phone ? <Text style={styles.storeInfo}>Telp: {s.store_phone}</Text> : null}
              {s.receipt_header ? <Text style={styles.headerNote}>{s.receipt_header}</Text> : null}
            </View>

            <View style={styles.invoiceBar}>
              <View style={styles.flex}>
                <Text style={styles.invoiceLabel}>INVOICE</Text>
                <Text style={styles.invoiceNo}>{d.sale.invoice_no}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: statusTone + "1A" }]}>
                <Icon name={statusIcon} size={13} color={statusTone} />
                <Text style={[styles.statusPillText, { color: statusTone }]}>{statusLabel}</Text>
              </View>
            </View>

            <View style={styles.metaGrid}>
              <Meta label="Tanggal" value={formatDateTime(d.sale.created_at)} />
              <Meta label="Kasir" value={d.sale.cashier_name ?? "-"} />
              <Meta label="Pelanggan" value={d.sale.customer_name ?? "Umum"} />
              <Meta label="Pembayaran" value={paymentMethodLabel(d.sale.payment_method)} />
            </View>

            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.thItem]}>Item</Text>
              <Text style={[styles.th, styles.thQty]}>Qty</Text>
              <Text style={[styles.th, styles.thAmt]}>Jumlah</Text>
            </View>
            {d.items.map((it) => (
              <View key={it.id} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemName}>{it.product_name}</Text>
                  <Text style={styles.itemSub}>@ {formatCurrency(it.price)}</Text>
                </View>
                <Text style={[styles.mono, styles.itemQty]}>{it.qty}</Text>
                <Text style={[styles.mono, styles.itemAmt]}>{formatCurrency(it.line_total)}</Text>
              </View>
            ))}

            <Dashed />
            <Line label="Subtotal" value={formatCurrency(d.sale.subtotal)} />
            {d.sale.discount_amount > 0 ? <Line label="Diskon" value={`-${formatCurrency(d.sale.discount_amount)}`} /> : null}
            {d.sale.tax_amount > 0 ? <Line label={`Pajak ${d.sale.tax_percent}%`} value={formatCurrency(d.sale.tax_amount)} /> : null}

            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>TOTAL</Text>
              <Text style={styles.grandValue}>{formatCurrency(d.sale.grand_total)}</Text>
            </View>

            <Line label={`Bayar (${paymentMethodLabel(d.sale.payment_method)})`} value={formatCurrency(d.sale.paid_amount)} />
            {d.sale.payment_method === "cash" && d.sale.change_amount > 0 ? (
              <Line label="Kembalian" value={formatCurrency(d.sale.change_amount)} />
            ) : null}
            {d.sale.payment_status === "belum_lunas" ? (
              <Line label="Sisa Tagihan" value={formatCurrency(d.sale.grand_total - d.sale.paid_amount)} danger />
            ) : null}
            {d.sale.note ? <Text style={styles.noteLine}>Catatan: {d.sale.note}</Text> : null}

            <Dashed />
            <Text style={styles.footerNote}>{s.receipt_footer || "Terima kasih atas kunjungan Anda 🙏"}</Text>
            <Text style={styles.legalNote}>Struk ini adalah bukti pembayaran yang sah.</Text>
          </View>
        ) : null}

        {d && s ? (
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button title="Bagikan" variant="outline" icon="share-variant" onPress={shareImage} testID="receipt-share" />
            </View>
            <View style={styles.flex}>
              <Button title="Cetak" variant="secondary" icon="printer" onPress={printReceipt} testID="receipt-print" />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.flex}>
          <Button title="Selesai" variant="outline" onPress={() => router.replace("/(tabs)")} testID="receipt-done" />
        </View>
        <View style={styles.flex}>
          <Button title="Transaksi Baru" icon="cart-plus" onPress={() => router.replace("/(tabs)/pos")} testID="receipt-new" />
        </View>
      </View>
    </View>
  );
}

function Line({ label, value, bold, danger }: { label: string; value: string; bold?: boolean; danger?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <Text style={[styles.mono, bold && styles.boldMono, danger && styles.dangerMono]}>{label}</Text>
      <Text style={[styles.mono, bold && styles.boldMono, danger && styles.dangerMono]}>{value}</Text>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Dashed() {
  const styles = useStyles();
  return <Text style={styles.dashed}>- - - - - - - - - - - - - - - - - - - -</Text>;
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing.x2l, gap: spacing.lg },
  successBadge: { alignItems: "center", gap: spacing.sm },
  successText: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  paper: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, overflow: "hidden" },
  watermark: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-20deg" }] },
  watermarkText: { fontSize: 34, fontWeight: "900", opacity: 0.1, letterSpacing: 3, textAlign: "center", marginVertical: spacing.md },
  brandHeader: { alignItems: "center", gap: 2, paddingBottom: spacing.md },
  logo: { width: "55%", height: 70, alignSelf: "center", marginBottom: spacing.xs },
  logoFallback: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  storeName: { fontSize: 19, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  storeInfo: { fontSize: 12, color: colors.textSecondary, textAlign: "center" },
  headerNote: { fontSize: 12, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs, fontStyle: "italic" },
  invoiceBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  invoiceLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 1 },
  invoiceNo: { fontSize: 14, fontWeight: "800", color: colors.onSurface, fontVariant: ["tabular-nums"] },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  statusPillText: { fontSize: 12, fontWeight: "800" },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.md },
  metaCell: { width: "50%", paddingVertical: spacing.xs, paddingRight: spacing.sm },
  metaLabel: { fontSize: 11, color: colors.muted },
  metaValue: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginTop: 1 },
  tableHead: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  thItem: { flex: 1 },
  thQty: { width: 36, textAlign: "center" },
  thAmt: { width: 90, textAlign: "right" },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  itemLeft: { flex: 1, paddingRight: spacing.sm },
  itemName: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  itemSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  itemQty: { width: 36, textAlign: "center" },
  itemAmt: { width: 90, textAlign: "right" },
  dashed: { color: colors.muted, textAlign: "center", marginVertical: spacing.sm, fontSize: 12 },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  mono: { fontSize: 13, color: colors.onSurface, fontVariant: ["tabular-nums"] },
  boldMono: { fontSize: 15, fontWeight: "800" },
  dangerMono: { color: colors.error, fontWeight: "800" },
  grandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md },
  grandLabel: { fontSize: 15, fontWeight: "800", color: colors.brandPrimary, letterSpacing: 0.5 },
  grandValue: { fontSize: 20, fontWeight: "900", color: colors.brandPrimary, fontVariant: ["tabular-nums"] },
  footerNote: { fontSize: 12, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
  legalNote: { fontSize: 10, color: colors.muted, textAlign: "center", marginTop: spacing.xs, fontStyle: "italic" },
  noteLine: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: spacing.md },
  footer: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
}));

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

function buildReceiptHtml(d: SaleWithDetails, s: Settings): string {
  const isVoid = d.sale.status === "void";
  const statusLabel = isVoid ? "DIBATALKAN" : d.sale.payment_status === "lunas" ? "LUNAS" : "BELUM LUNAS";
  const statusColor = isVoid ? "#6B7280" : d.sale.payment_status === "lunas" ? "#16A34A" : "#DC2626";
  const row = (label: string, value: string, cls = "") =>
    `<div class="row ${cls}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
  const meta = (label: string, value: string) =>
    `<div class="meta"><div class="meta-l">${escapeHtml(label)}</div><div class="meta-v">${escapeHtml(value)}</div></div>`;
  const items = d.items
    .map(
      (it) =>
        `<tr><td class="it-name">${escapeHtml(it.product_name)}<div class="it-sub">@ ${formatCurrency(it.price)}</div></td>` +
        `<td class="it-qty">${it.qty}</td><td class="it-amt">${formatCurrency(it.line_total)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { font-family: 'Helvetica Neue', Arial, sans-serif; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { width: 300px; margin: 0 auto; padding: 16px 14px; color: #111; position: relative; }
    .center { text-align: center; }
    .store { font-size: 18px; font-weight: 800; }
    .muted { font-size: 11px; color: #555; }
    .note { font-size: 11px; color: #555; font-style: italic; margin-top: 4px; }
    .inv-bar { display: flex; justify-content: space-between; align-items: center; background: #F1F5F9; border-radius: 8px; padding: 8px 10px; margin-top: 12px; }
    .inv-l { font-size: 9px; letter-spacing: 1px; color: #777; font-weight: 700; }
    .inv-no { font-size: 13px; font-weight: 800; }
    .pill { font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px; color: ${statusColor}; background: ${statusColor}22; }
    .metas { display: flex; flex-wrap: wrap; margin-top: 10px; }
    .meta { width: 50%; padding: 3px 6px 3px 0; }
    .meta-l { font-size: 10px; color: #888; }
    .meta-v { font-size: 12px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #888; text-align: left; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    th.q, td.it-qty { text-align: center; width: 30px; }
    th.a, td.it-amt { text-align: right; width: 84px; }
    td { font-size: 12px; padding: 6px 0; border-bottom: 1px solid #eee; vertical-align: top; }
    .it-name { font-weight: 600; }
    .it-sub { font-size: 10px; color: #999; margin-top: 2px; font-weight: 400; }
    .totals { margin-top: 8px; }
    .row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
    .row.danger span { color: #DC2626; font-weight: 700; }
    .grand { display: flex; justify-content: space-between; align-items: center; background: #205396; color: #fff; border-radius: 8px; padding: 8px 10px; margin: 8px 0; }
    .grand .g-l { font-size: 13px; font-weight: 800; letter-spacing: .5px; }
    .grand .g-v { font-size: 17px; font-weight: 900; }
    .dashed { border-top: 1px dashed #bbb; margin: 8px 0; }
    .wm-wrap { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px; transform: rotate(-18deg); opacity: 0.1; z-index: 0; }
    .wm { font-size: 40px; font-weight: 900; color: ${statusColor}; white-space: nowrap; }
    .foot { text-align: center; font-size: 11px; color: #555; margin-top: 8px; }
    .legal { text-align: center; font-size: 9px; color: #999; font-style: italic; margin-top: 4px; }
  </style></head><body>
    <div class="wm-wrap">${Array(6).fill(`<div class="wm">${statusLabel}</div>`).join("")}</div>
    ${s.store_logo ? `<img src="${s.store_logo}" style="max-width:120px;max-height:70px;display:block;margin:0 auto 6px;" />` : ""}
    <div class="center store">${escapeHtml(s.store_name || "Toko")}</div>
    ${s.store_address ? `<div class="center muted">${escapeHtml(s.store_address)}</div>` : ""}
    ${s.store_phone ? `<div class="center muted">Telp: ${escapeHtml(s.store_phone)}</div>` : ""}
    ${s.receipt_header ? `<div class="center note">${escapeHtml(s.receipt_header)}</div>` : ""}

    <div class="inv-bar">
      <div><div class="inv-l">INVOICE</div><div class="inv-no">${escapeHtml(d.sale.invoice_no)}</div></div>
      <div class="pill">${escapeHtml(statusLabel)}</div>
    </div>

    <div class="metas">
      ${meta("Tanggal", formatDateTime(d.sale.created_at))}
      ${meta("Kasir", d.sale.cashier_name ?? "-")}
      ${meta("Pelanggan", d.sale.customer_name ?? "Umum")}
      ${meta("Pembayaran", paymentMethodLabel(d.sale.payment_method))}
    </div>

    <table>
      <thead><tr><th>Item</th><th class="q">Qty</th><th class="a">Jumlah</th></tr></thead>
      <tbody>${items}</tbody>
    </table>

    <div class="totals">
      ${row("Subtotal", formatCurrency(d.sale.subtotal))}
      ${d.sale.discount_amount > 0 ? row("Diskon", "-" + formatCurrency(d.sale.discount_amount)) : ""}
      ${d.sale.tax_amount > 0 ? row(`Pajak ${d.sale.tax_percent}%`, formatCurrency(d.sale.tax_amount)) : ""}
    </div>
    <div class="grand"><span class="g-l">TOTAL</span><span class="g-v">${formatCurrency(d.sale.grand_total)}</span></div>
    ${row(`Bayar (${paymentMethodLabel(d.sale.payment_method)})`, formatCurrency(d.sale.paid_amount))}
    ${d.sale.payment_method === "cash" && d.sale.change_amount > 0 ? row("Kembalian", formatCurrency(d.sale.change_amount)) : ""}
    ${d.sale.payment_status === "belum_lunas" ? row("Sisa Tagihan", formatCurrency(d.sale.grand_total - d.sale.paid_amount), "danger") : ""}
    ${d.sale.note ? `<div class="muted" style="margin-top:4px;">Catatan: ${escapeHtml(d.sale.note)}</div>` : ""}
    <div class="dashed"></div>
    <div class="foot">${escapeHtml(s.receipt_footer || "Terima kasih atas kunjungan Anda")}</div>
    <div class="legal">Struk ini adalah bukti pembayaran yang sah.</div>
  </body></html>`;
}
