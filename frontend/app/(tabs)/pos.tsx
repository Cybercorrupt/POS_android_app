import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useAuth } from "@/src/auth/auth-context";
import { useGoogleDrive } from "@/src/auth/google-drive-context";
import { useCart } from "@/src/cart/cart-context";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Icon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { Screen } from "@/src/components/ui/screen";
import { SearchBar } from "@/src/components/ui/search-bar";
import { Sheet } from "@/src/components/ui/sheet";
import { useToast } from "@/src/components/ui/toast";
import { qk } from "@/src/db/keys";
import { listCustomers } from "@/src/db/repo/customers";
import { listActiveProducts } from "@/src/db/repo/products";
import { createSale } from "@/src/db/repo/sales";
import { getSettings } from "@/src/db/repo/settings";
import { formatCurrency, formatThousands, parseNumber } from "@/src/lib/format";
import { PAYMENT_METHODS } from "@/src/lib/payment";
import type { PaymentMethod, PaymentStatus } from "@/src/db/types";
import { scanBus } from "@/src/lib/scan-bus";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { queryClient } from "@/src/query-client";

export default function Pos() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const cart = useCart();
  const { scheduleAutoBackup } = useGoogleDrive();

  const [search, setSearch] = useState("");
  const [customerSheet, setCustomerSheet] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [payStatus, setPayStatus] = useState<PaymentStatus>("lunas");
  const [payNote, setPayNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [qtyEdit, setQtyEdit] = useState<{ productId: string; name: string; max: number } | null>(null);
  const [qtyInput, setQtyInput] = useState("");

  const settings = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const results = useQuery({
    queryKey: qk.products(`pos:${search}`),
    queryFn: () => listActiveProducts(search),
    enabled: search.trim().length > 0,
  });
  const customers = useQuery({ queryKey: qk.customers(), queryFn: () => listCustomers() });

  useEffect(() => {
    if (settings.data && cart.items.length === 0 && cart.taxPercent === 0 && cart.discountValue === 0) {
      cart.setTax(settings.data.default_tax_percent);
    }
  }, [settings.data]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      const scanned = scanBus.take();
      if (scanned) setSearch(scanned);
    }, []),
  );

  const selectedCustomer = customers.data?.find((c) => c.id === cart.customerId) ?? null;
  const { subtotal, discountAmount, taxAmount, grandTotal } = cart.totals;
  const change = Math.max(0, paid - grandTotal);
  const outstanding = Math.max(0, grandTotal - paid);

  const openCheckout = () => {
    if (cart.items.length === 0) {
      toast.show("Keranjang masih kosong", "error");
      return;
    }
    setMethod("cash");
    setPayStatus("lunas");
    setPayNote("");
    setPaid(0);
    setCheckout(true);
  };

  const confirmPayment = async () => {
    if (payStatus === "lunas" && method === "cash" && paid < grandTotal) {
      toast.show("Jumlah bayar kurang", "error");
      return;
    }
    setSubmitting(true);
    try {
      const saleId = await createSale({
        customerId: cart.customerId,
        userId: user!.id,
        items: cart.items.map((i) => ({ product_id: i.product_id, product_name: i.product_name, sku: i.sku, qty: i.qty, price: i.price })),
        discountType: cart.discountType,
        discountValue: cart.discountValue,
        taxPercent: cart.taxPercent,
        paymentMethod: method,
        paymentStatus: payStatus,
        paidAmount: method === "cash" ? paid : payStatus === "lunas" ? grandTotal : paid,
        note: payNote.trim() || null,
      });
      queryClient.invalidateQueries();
      scheduleAutoBackup();
      cart.clear();
      setSearch("");
      setCheckout(false);
      setSubmitting(false);
      router.push(`/receipt?id=${saleId}`);
    } catch (e) {
      setSubmitting(false);
      toast.show(e instanceof Error ? e.message : "Gagal menyimpan transaksi", "error");
    }
  };

  const saveQty = () => {
    if (!qtyEdit) return;
    const n = parseNumber(qtyInput);
    if (n <= 0) {
      cart.remove(qtyEdit.productId);
    } else if (n > qtyEdit.max) {
      cart.setQty(qtyEdit.productId, qtyEdit.max);
      toast.show(`Stok maksimal ${qtyEdit.max}`, "info");
    } else {
      cart.setQty(qtyEdit.productId, n);
    }
    setQtyEdit(null);
  };

  return (
    <Screen
      title="Penjualan"
      subtitle={cart.count > 0 ? `${cart.count} item di keranjang` : "Keranjang kosong"}
      testID="pos-screen"
      headerRight={
        cart.items.length > 0 ? (
          <Pressable testID="pos-clear" onPress={() => cart.clear()} hitSlop={8} style={styles.clearBtn}>
            <Icon name="trash-can-outline" size={18} color={colors.error} />
            <Text style={styles.clearText}>Kosongkan</Text>
          </Pressable>
        ) : null
      }
      footer={
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Total</Text>
            <Text style={styles.footerTotal} testID="pos-grand-total">{formatCurrency(grandTotal)}</Text>
          </View>
          <Button title="Lanjut Bayar" icon="cash" onPress={openCheckout} testID="pos-checkout" disabled={cart.items.length === 0} />
        </View>
      }
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
      >
        <SearchBar
          testID="pos-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Cari / scan produk"
          onScan={() => router.push("/scanner?mode=pos")}
        />

        {search.trim().length > 0 ? (
          <Card padded={false} style={styles.results}>
            {(results.data ?? []).length === 0 ? (
              <Text style={styles.noResult}>Produk tidak ditemukan</Text>
            ) : (
              (results.data ?? []).slice(0, 6).map((p, idx) => (
                <Pressable
                  key={p.id}
                  testID={`pos-add-${p.sku}`}
                  disabled={p.current_stock <= 0}
                  onPress={() => { cart.addProduct(p); }}
                  style={({ pressed }) => [styles.resultRow, idx > 0 && styles.rowBorder, pressed && styles.pressed, p.current_stock <= 0 && styles.disabledRow]}
                >
                  <View style={styles.flex}>
                    <Text style={styles.resultName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.resultMeta}>{p.sku} • Stok {p.current_stock}</Text>
                  </View>
                  <Text style={styles.resultPrice}>{formatCurrency(p.sell_price)}</Text>
                  <Icon name={p.current_stock <= 0 ? "close" : "plus-circle"} size={22} color={p.current_stock <= 0 ? colors.muted : colors.brandPrimary} />
                </Pressable>
              ))
            )}
          </Card>
        ) : null}

        {cart.items.length === 0 ? (
          <EmptyState icon="cart-outline" title="Keranjang kosong" message="Cari produk di atas lalu tap untuk menambahkan ke keranjang." />
        ) : (
          <View style={styles.cart}>
            {cart.items.map((item) => (
              <Card key={item.product_id} style={styles.cartCard}>
                <View style={styles.cartTop}>
                  <View style={styles.flex}>
                    <Text style={styles.cartName} numberOfLines={1}>{item.product_name}</Text>
                    <Text style={styles.cartPrice}>{formatCurrency(item.price)} / unit</Text>
                  </View>
                  <Pressable testID={`cart-remove-${item.sku}`} onPress={() => cart.remove(item.product_id)} hitSlop={8}>
                    <Icon name="delete-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
                <View style={styles.cartBottom}>
                  <View style={styles.stepper}>
                    <Pressable testID={`cart-dec-${item.sku}`} onPress={() => cart.decrement(item.product_id)} style={styles.stepBtn}>
                      <Icon name="minus" size={18} color={colors.onSurface} />
                    </Pressable>
                    <Pressable
                      testID={`cart-qty-${item.sku}`}
                      onPress={() => { setQtyEdit({ productId: item.product_id, name: item.product_name, max: item.max_stock }); setQtyInput(String(item.qty)); }}
                      hitSlop={6}
                      style={styles.qtyBtn}
                    >
                      <Text style={styles.stepQty}>{item.qty}</Text>
                    </Pressable>
                    <Pressable testID={`cart-inc-${item.sku}`} onPress={() => cart.increment(item.product_id)} style={styles.stepBtn} disabled={item.qty >= item.max_stock}>
                      <Icon name="plus" size={18} color={item.qty >= item.max_stock ? colors.muted : colors.onSurface} />
                    </Pressable>
                  </View>
                  <Text style={styles.cartLineTotal}>{formatCurrency(item.price * item.qty)}</Text>
                </View>
              </Card>
            ))}

            {/* Customer */}
            <Pressable testID="pos-customer" onPress={() => setCustomerSheet(true)} style={styles.selectorRow}>
              <Icon name="account-outline" size={20} color={colors.brandPrimary} />
              <Text style={styles.selectorText} numberOfLines={1}>{selectedCustomer ? selectedCustomer.name : "Tanpa pelanggan"}</Text>
              <Icon name="chevron-right" size={20} color={colors.muted} />
            </Pressable>

            {/* Discount */}
            <Card style={styles.adjustCard}>
              <View style={styles.adjustHeader}>
                <Text style={styles.adjustTitle}>Diskon</Text>
                <View style={styles.toggle}>
                  <Pressable
                    testID="discount-nominal"
                    onPress={() => cart.setDiscount("nominal", cart.discountValue)}
                    style={[styles.toggleBtn, cart.discountType === "nominal" && styles.toggleActive]}
                  >
                    <Text style={[styles.toggleText, cart.discountType === "nominal" && styles.toggleTextActive]}>Rp</Text>
                  </Pressable>
                  <Pressable
                    testID="discount-percent"
                    onPress={() => cart.setDiscount("percent", cart.discountValue)}
                    style={[styles.toggleBtn, cart.discountType === "percent" && styles.toggleActive]}
                  >
                    <Text style={[styles.toggleText, cart.discountType === "percent" && styles.toggleTextActive]}>%</Text>
                  </Pressable>
                </View>
              </View>
              <Input
                testID="discount-value"
                keyboardType="number-pad"
                value={cart.discountValue ? String(cart.discountValue) : ""}
                onChangeText={(t) => cart.setDiscount(cart.discountType, parseNumber(t))}
                placeholder="0"
              />
            </Card>

            {/* Tax */}
            <Card style={styles.adjustCard}>
              <Text style={styles.adjustTitle}>Pajak (%)</Text>
              <Input
                testID="tax-value"
                keyboardType="number-pad"
                value={cart.taxPercent ? String(cart.taxPercent) : ""}
                onChangeText={(t) => cart.setTax(parseNumber(t))}
                placeholder="0"
              />
            </Card>

            {/* Totals */}
            <Card style={styles.totalsCard}>
              <Row label="Subtotal" value={formatCurrency(subtotal)} />
              {discountAmount > 0 ? <Row label="Diskon" value={`- ${formatCurrency(discountAmount)}`} tone={colors.error} /> : null}
              {taxAmount > 0 ? <Row label={`Pajak ${cart.taxPercent}%`} value={formatCurrency(taxAmount)} /> : null}
              <View style={styles.totalDivider} />
              <Row label="Grand Total" value={formatCurrency(grandTotal)} bold />
            </Card>
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* Customer picker */}
      <Sheet visible={customerSheet} onClose={() => setCustomerSheet(false)} title="Pilih Pelanggan" scroll>
        <Pressable
          testID="pos-add-customer"
          onPress={() => { setCustomerSheet(false); router.push("/customer-form"); }}
          style={styles.addCustomerBtn}
        >
          <Icon name="account-plus-outline" size={20} color={colors.brandPrimary} />
          <Text style={styles.addCustomerText}>Pelanggan Baru</Text>
        </Pressable>
        <Pressable
          testID="customer-none"
          onPress={() => { cart.setCustomer(null); setCustomerSheet(false); }}
          style={styles.custRow}
        >
          <Icon name="account-off-outline" size={20} color={colors.muted} />
          <Text style={styles.custName}>Tanpa pelanggan</Text>
        </Pressable>
        {(customers.data ?? []).map((c) => (
          <Pressable
            key={c.id}
            testID={`customer-pick-${c.id}`}
            onPress={() => { cart.setCustomer(c.id); setCustomerSheet(false); }}
            style={styles.custRow}
          >
            <Icon name="account-outline" size={20} color={colors.brandPrimary} />
            <View style={styles.flex}>
              <Text style={styles.custName}>{c.name}</Text>
              {c.phone ? <Text style={styles.custPhone}>{c.phone}</Text> : null}
            </View>
            {cart.customerId === c.id ? <Icon name="check-circle" size={20} color={colors.success} /> : null}
          </Pressable>
        ))}
      </Sheet>

      {/* Checkout / Payment */}
      <Sheet visible={checkout} onClose={() => setCheckout(false)} title="Pembayaran" scroll>
        <Card style={styles.payTotal}>
          <Text style={styles.payTotalLabel}>Total Tagihan</Text>
          <Text style={styles.payTotalValue}>{formatCurrency(grandTotal)}</Text>
        </Card>

        <Text style={styles.payLabel}>Metode Pembayaran</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodRow}>
          {PAYMENT_METHODS.map((m) => {
            const activeM = method === m.value;
            return (
              <Pressable
                key={m.value}
                testID={`pay-method-${m.value}`}
                onPress={() => setMethod(m.value)}
                style={[styles.methodChip, activeM && styles.methodActive]}
              >
                <Icon name={m.icon} size={18} color={activeM ? colors.onBrandPrimary : colors.onSurface} />
                <Text style={[styles.methodText, activeM && styles.methodTextActive]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.payLabel}>Status Pembayaran</Text>
        <View style={styles.statusRow}>
          <Pressable testID="pay-status-lunas" onPress={() => setPayStatus("lunas")} style={[styles.statusBtn, payStatus === "lunas" && styles.statusLunas]}>
            <Icon name="cash-check" size={18} color={payStatus === "lunas" ? colors.onSuccess : colors.onSurface} />
            <Text style={[styles.statusText, payStatus === "lunas" && styles.statusTextOn]}>Lunas</Text>
          </Pressable>
          <Pressable testID="pay-status-belum" onPress={() => setPayStatus("belum_lunas")} style={[styles.statusBtn, payStatus === "belum_lunas" && styles.statusBelum]}>
            <Icon name="cash-clock" size={18} color={payStatus === "belum_lunas" ? colors.onWarning : colors.onSurface} />
            <Text style={[styles.statusText, payStatus === "belum_lunas" && styles.statusTextOn]}>Belum Lunas</Text>
          </Pressable>
        </View>

        {method === "cash" && payStatus === "lunas" ? (
          <>
            <Input
              label="Jumlah Bayar"
              testID="pay-amount"
              keyboardType="number-pad"
              value={paid ? formatThousands(paid) : ""}
              onChangeText={(t) => setPaid(parseNumber(t))}
              placeholder="Masukkan jumlah bayar"
            />
            <View style={styles.changeRow}>
              <Text style={styles.changeLabel}>Kembalian</Text>
              <Text style={[styles.changeValue, { color: paid < grandTotal ? colors.error : colors.success }]} testID="pay-change">
                {formatCurrency(change)}
              </Text>
            </View>
          </>
        ) : null}

        {payStatus === "belum_lunas" ? (
          <>
            <Input
              label="Uang Muka / Dibayar (opsional)"
              testID="pay-amount"
              keyboardType="number-pad"
              value={paid ? formatThousands(paid) : ""}
              onChangeText={(t) => setPaid(parseNumber(t))}
              placeholder="0"
            />
            <View style={styles.changeRow}>
              <Text style={styles.changeLabel}>Sisa Tagihan</Text>
              <Text style={[styles.changeValue, { color: colors.warning }]} testID="pay-outstanding">
                {formatCurrency(outstanding)}
              </Text>
            </View>
          </>
        ) : null}

        {method !== "cash" && payStatus === "lunas" ? (
          <View style={styles.changeRow}>
            <Text style={styles.changeLabel}>Dibayar Penuh</Text>
            <Text style={[styles.changeValue, { color: colors.success }]}>{formatCurrency(grandTotal)}</Text>
          </View>
        ) : null}

        <Input
          label="Keterangan"
          testID="pay-note"
          value={payNote}
          onChangeText={setPayNote}
          placeholder="Catatan transaksi (opsional)"
          multiline
        />

        <Button
          title="Selesaikan Transaksi"
          icon="check-circle"
          onPress={confirmPayment}
          loading={submitting}
          disabled={payStatus === "lunas" && method === "cash" && paid < grandTotal}
          testID="pay-confirm"
        />
      </Sheet>

      {/* Manual quantity editor */}
      <Sheet visible={!!qtyEdit} onClose={() => setQtyEdit(null)} title="Ubah Jumlah">
        {qtyEdit ? <Text style={styles.qtyEditName}>{qtyEdit.name}</Text> : null}
        <Input
          testID="qty-edit-input"
          keyboardType="number-pad"
          value={qtyInput}
          onChangeText={setQtyInput}
          placeholder="Masukkan jumlah"
          autoFocus
        />
        <Text style={styles.qtyEditHint}>Maks. stok: {qtyEdit?.max ?? 0}</Text>
        <Button title="Simpan Jumlah" icon="check" onPress={saveQty} testID="qty-edit-save" />
      </Sheet>
    </Screen>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.sumRow}>
      <Text style={[styles.sumLabel, bold && styles.sumBold]}>{label}</Text>
      <Text style={[styles.sumValue, bold && styles.sumBold, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x2l },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  clearText: { color: colors.error, fontSize: 13, fontWeight: "600" },
  results: { overflow: "hidden" },
  noResult: { padding: spacing.lg, textAlign: "center", color: colors.muted },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  disabledRow: { opacity: 0.5 },
  pressed: { opacity: 0.6 },
  flex: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  resultMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  resultPrice: { fontSize: 14, fontWeight: "700", color: colors.brandPrimary },
  cart: { gap: spacing.md },
  cartCard: { gap: spacing.md },
  cartTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  cartName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  cartPrice: { fontSize: 12, color: colors.muted, marginTop: 2 },
  cartBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4 },
  stepBtn: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  stepQty: { fontSize: 16, fontWeight: "800", color: colors.onSurface, minWidth: 24, textAlign: "center" },
  qtyBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, minWidth: 40, alignItems: "center" },
  qtyEditName: { fontSize: 15, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.xs },
  qtyEditHint: { fontSize: 12, color: colors.muted },
  cartLineTotal: { fontSize: 16, fontWeight: "800", color: colors.brandPrimary },
  selectorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  selectorText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.onSurface },
  adjustCard: { gap: spacing.sm },
  adjustHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  adjustTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  toggle: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, padding: 3, gap: 3 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.sm - 2 },
  toggleActive: { backgroundColor: colors.brandPrimary },
  toggleText: { fontSize: 14, fontWeight: "700", color: colors.onSurfaceTertiary },
  toggleTextActive: { color: colors.onBrandPrimary },
  totalsCard: { gap: spacing.sm },
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sumLabel: { fontSize: 14, color: colors.textSecondary },
  sumValue: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  sumBold: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  totalDivider: { height: 1, backgroundColor: colors.divider, marginVertical: 2 },
  footer: { gap: spacing.md },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerLabel: { fontSize: 14, color: colors.muted },
  footerTotal: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  custRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  custName: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  custPhone: { fontSize: 12, color: colors.muted, marginTop: 2 },
  payTotal: { backgroundColor: colors.brandTertiary, borderColor: colors.brandTertiary, alignItems: "center", gap: 4 },
  payTotalLabel: { fontSize: 13, color: colors.onBrandTertiary, fontWeight: "600" },
  payTotalValue: { fontSize: 28, fontWeight: "800", color: colors.onBrandTertiary },
  quickRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  quickChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceTertiary, flexShrink: 0 },
  quickChipText: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  changeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs },
  changeLabel: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  changeValue: { fontSize: 20, fontWeight: "800" },
  payLabel: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  methodRow: { gap: spacing.sm, paddingVertical: 2 },
  methodChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  methodActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  methodText: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  methodTextActive: { color: colors.onBrandPrimary },
  statusRow: { flexDirection: "row", gap: spacing.sm },
  statusBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  statusLunas: { backgroundColor: colors.success, borderColor: colors.success },
  statusBelum: { backgroundColor: colors.warning, borderColor: colors.warning },
  statusText: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  statusTextOn: { color: "#FFFFFF" },
  addCustomerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, marginTop: spacing.xs },
  addCustomerText: { fontSize: 15, fontWeight: "700", color: colors.brandPrimary },
}));
