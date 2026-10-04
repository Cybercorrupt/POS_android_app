import { useMutation, useQuery } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { ConfirmSheet } from "@/src/components/ui/confirm-sheet";
import { Icon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { Sheet } from "@/src/components/ui/sheet";
import { useToast } from "@/src/components/ui/toast";
import { qk } from "@/src/db/keys";
import { createCategory, listCategories } from "@/src/db/repo/categories";
import { createProduct, getProduct, softDeleteProduct, updateProduct, type ProductInput } from "@/src/db/repo/products";
import { listUnits } from "@/src/db/repo/units";
import { parseNumber } from "@/src/lib/format";
import { scanBus } from "@/src/lib/scan-bus";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { queryClient } from "@/src/query-client";
import { useAuth } from "@/src/auth/auth-context";

export default function ProductForm() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [unit, setUnit] = useState("pcs");
  const [cost, setCost] = useState(0);
  const [sell, setSell] = useState(0);
  const [minStock, setMinStock] = useState(0);
  const [initialStock, setInitialStock] = useState(0);
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [catSheet, setCatSheet] = useState(false);
  const [unitSheet, setUnitSheet] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categories = useQuery({ queryKey: qk.categories, queryFn: listCategories });
  const units = useQuery({ queryKey: qk.units, queryFn: listUnits });
  const existing = useQuery({ queryKey: qk.product(id ?? ""), queryFn: () => getProduct(id!), enabled: isEdit });

  useEffect(() => {
    const p = existing.data;
    if (p) {
      setName(p.name);
      setSku(p.sku);
      setBarcode(p.barcode ?? "");
      setCategoryId(p.category_id);
      setUnit(p.unit);
      setCost(p.cost_price);
      setSell(p.sell_price);
      setMinStock(p.min_stock);
      setActive(p.active === 1);
    }
  }, [existing.data]);

  useFocusEffect(
    useCallback(() => {
      const scanned = scanBus.take();
      if (scanned) setBarcode(scanned);
    }, []),
  );

  const selectedCat = categories.data?.find((c) => c.id === categoryId);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nama wajib diisi";
    if (!sku.trim()) e.sku = "SKU wajib diisi";
    if (sell <= 0) e.sell = "Harga jual harus lebih dari 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = useMutation({
    mutationFn: async () => {
      const input: ProductInput = {
        name,
        sku,
        barcode: barcode || null,
        category_id: categoryId,
        unit,
        cost_price: cost,
        sell_price: sell,
        min_stock: minStock,
        active,
        initial_stock: initialStock,
      };
      if (isEdit) {
        await updateProduct(id!, input);
      } else {
        await createProduct(input, user!.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show(isEdit ? "Produk diperbarui" : "Produk ditambahkan", "success");
      router.back();
    },
    onError: (err) => {
      const msg = err instanceof Error && err.message.includes("UNIQUE") ? "SKU sudah digunakan" : "Gagal menyimpan produk";
      toast.show(msg, "error");
    },
  });

  const onSave = () => {
    if (!validate()) return;
    save.mutate();
  };

  const addCategory = useMutation({
    mutationFn: () => createCategory(newCat),
    onSuccess: (cat) => {
      queryClient.invalidateQueries({ queryKey: qk.categories });
      setCategoryId(cat.id);
      setNewCat("");
      setCatSheet(false);
      toast.show("Kategori ditambahkan", "success");
    },
    onError: () => toast.show("Kategori sudah ada", "error"),
  });

  const remove = useMutation({
    mutationFn: () => softDeleteProduct(id!),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show("Produk dihapus", "success");
      router.back();
    },
  });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="product-form-close">
          <Icon name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? "Edit Produk" : "Produk Baru"}</Text>
        {isEdit ? (
          <Pressable onPress={() => setConfirmDelete(true)} hitSlop={10} testID="product-delete">
            <Icon name="trash-can-outline" size={22} color={colors.error} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
      >
        <Input label="Nama Produk" testID="pf-name" value={name} onChangeText={setName} placeholder="Contoh: Kopi Susu" error={errors.name} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Input label="SKU" testID="pf-sku" value={sku} onChangeText={setSku} placeholder="SKU-001" autoCapitalize="characters" error={errors.sku} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>Unit</Text>
            <Pressable testID="pf-unit" onPress={() => setUnitSheet(true)} style={styles.selector}>
              <Text style={styles.selectorText}>{unit || "pcs"}</Text>
              <Icon name="chevron-down" size={20} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        <View>
          <Text style={styles.label}>Barcode</Text>
          <View style={styles.barcodeRow}>
            <View style={styles.flex}>
              <Input testID="pf-barcode" value={barcode} onChangeText={setBarcode} placeholder="Opsional" keyboardType="number-pad" />
            </View>
            <Pressable testID="pf-scan" onPress={() => router.push("/scanner?mode=search")} style={styles.scanBtn}>
              <Icon name="barcode-scan" size={22} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        </View>

        <View>
          <Text style={styles.label}>Kategori</Text>
          <Pressable testID="pf-category" onPress={() => setCatSheet(true)} style={styles.selector}>
            <Text style={[styles.selectorText, !selectedCat && styles.placeholder]}>{selectedCat?.name ?? "Pilih kategori"}</Text>
            <Icon name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        </View>

        <View style={styles.row}>
          <View style={styles.flex}>
            <Input label="Harga Beli" testID="pf-cost" keyboardType="number-pad" value={cost ? String(cost) : ""} onChangeText={(t) => setCost(parseNumber(t))} placeholder="0" />
          </View>
          <View style={styles.flex}>
            <Input label="Harga Jual" testID="pf-sell" keyboardType="number-pad" value={sell ? String(sell) : ""} onChangeText={(t) => setSell(parseNumber(t))} placeholder="0" error={errors.sell} />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.flex}>
            <Input label="Minimum Stok" testID="pf-minstock" keyboardType="number-pad" value={minStock ? String(minStock) : ""} onChangeText={(t) => setMinStock(parseNumber(t))} placeholder="0" />
          </View>
          {!isEdit ? (
            <View style={styles.flex}>
              <Input label="Stok Awal" testID="pf-initstock" keyboardType="number-pad" value={initialStock ? String(initialStock) : ""} onChangeText={(t) => setInitialStock(parseNumber(t))} placeholder="0" />
            </View>
          ) : (
            <View style={styles.flex} />
          )}
        </View>

        <Card style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.switchTitle}>Produk Aktif</Text>
            <Text style={styles.switchDesc}>Tampil di penjualan bila aktif</Text>
          </View>
          <Switch
            testID="pf-active"
            value={active}
            onValueChange={setActive}
            trackColor={{ true: colors.brandPrimary, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </Card>

        {isEdit ? <Text style={styles.editNote}>Ubah stok melalui menu Inventori.</Text> : null}
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button title="Simpan" icon="check" onPress={onSave} loading={save.isPending} testID="pf-save" />
      </View>

      <Sheet visible={catSheet} onClose={() => setCatSheet(false)} title="Pilih Kategori" scroll>
        {(categories.data ?? []).map((c) => (
          <Pressable key={c.id} testID={`cat-pick-${c.id}`} onPress={() => { setCategoryId(c.id); setCatSheet(false); }} style={styles.catRow}>
            <Text style={styles.catName}>{c.name}</Text>
            {categoryId === c.id ? <Icon name="check-circle" size={20} color={colors.success} /> : null}
          </Pressable>
        ))}
        <View style={styles.addCat}>
          <View style={styles.flex}>
            <Input testID="cat-new" value={newCat} onChangeText={setNewCat} placeholder="Kategori baru" />
          </View>
          <Button title="Tambah" fullWidth={false} onPress={() => newCat.trim() && addCategory.mutate()} testID="cat-add" />
        </View>
      </Sheet>

      <Sheet visible={unitSheet} onClose={() => setUnitSheet(false)} title="Pilih Unit" scroll>
        {(units.data ?? []).map((u) => (
          <Pressable key={u.id} testID={`unit-pick-${u.name}`} onPress={() => { setUnit(u.name); setUnitSheet(false); }} style={styles.catRow}>
            <Text style={styles.catName}>{u.name}</Text>
            {unit === u.name ? <Icon name="check-circle" size={20} color={colors.success} /> : null}
          </Pressable>
        ))}
        <Text style={styles.unitHint}>Kelola daftar unit di Pengaturan.</Text>
      </Sheet>

      <ConfirmSheet
        visible={confirmDelete}
        title="Hapus Produk?"
        message="Produk akan dinonaktifkan dan disembunyikan dari daftar. Riwayat transaksi tetap tersimpan."
        confirmLabel="Hapus"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x2l },
  row: { flexDirection: "row", gap: spacing.md },
  flex: { flex: 1 },
  label: { fontSize: 14, fontWeight: "600", color: colors.onSurface, marginBottom: spacing.xs },
  barcodeRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  scanBtn: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  selector: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50 },
  selectorText: { fontSize: 16, color: colors.onSurface },
  placeholder: { color: colors.muted },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  switchTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  switchDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  editNote: { fontSize: 13, color: colors.muted, textAlign: "center" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  catRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  catName: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  unitHint: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: spacing.sm },
  addCat: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", marginTop: spacing.sm },
}));
