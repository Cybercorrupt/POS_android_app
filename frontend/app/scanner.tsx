import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCart } from "@/src/cart/cart-context";
import { Button } from "@/src/components/ui/button";
import { Icon } from "@/src/components/ui/icon";
import { useToast } from "@/src/components/ui/toast";
import { findByCode } from "@/src/db/repo/products";
import { scanBus } from "@/src/lib/scan-bus";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Scanner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const cart = useCart();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const locked = useRef(false);

  const onScanned = async (code: string) => {
    if (locked.current) return;
    locked.current = true;
    if (mode === "pos") {
      const product = await findByCode(code);
      if (!product) {
        toast.show("Produk tidak ditemukan", "error");
        setTimeout(() => (locked.current = false), 1200);
        return;
      }
      if (product.current_stock <= 0) {
        toast.show(`${product.name} stok habis`, "error");
        setTimeout(() => (locked.current = false), 1200);
        return;
      }
      cart.addProduct(product);
      toast.show(`${product.name} ditambahkan`, "success");
      router.back();
    } else {
      scanBus.set(code);
      router.back();
    }
  };

  if (!permission) {
    return <View style={styles.permWrap} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permWrap, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
        <Pressable style={styles.closeTop} onPress={() => router.back()} hitSlop={10} testID="scanner-close">
          <Icon name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={styles.permBody}>
          <View style={styles.permIcon}>
            <Icon name="barcode-scan" size={40} color={colors.brandPrimary} />
          </View>
          <Text style={styles.permTitle}>Izin Kamera Diperlukan</Text>
          <Text style={styles.permText}>Aktifkan kamera untuk memindai barcode produk dengan cepat.</Text>
          {permission.canAskAgain ? (
            <Button title="Izinkan Kamera" icon="camera" onPress={requestPermission} testID="scanner-request" />
          ) : (
            <Button title="Buka Pengaturan" icon="cog-outline" onPress={() => Linking.openSettings()} testID="scanner-settings" />
          )}
          <Button title="Nanti Saja" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
        }}
        onBarcodeScanned={({ data }) => onScanned(data)}
      />
      <View style={[styles.overlay, { paddingTop: insets.top + spacing.md }]} pointerEvents="box-none">
        <Pressable style={styles.closeCam} onPress={() => router.back()} hitSlop={10} testID="scanner-close">
          <Icon name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.frame} />
        <Text style={styles.hint}>Arahkan kamera ke barcode</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  permWrap: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  closeTop: { alignSelf: "flex-end", width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  permBody: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
  permIcon: { width: 88, height: 88, borderRadius: radius.xl, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  permTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  permText: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 21, marginBottom: spacing.md, paddingHorizontal: spacing.md },
  cameraWrap: { flex: 1, backgroundColor: "#000000" },
  camera: { flex: 1 },
  overlay: { ...StyleSheetFill(), alignItems: "center" },
  closeCam: { position: "absolute", left: spacing.lg, top: spacing.x2l, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  frame: { marginTop: "40%", width: 240, height: 160, borderRadius: radius.lg, borderWidth: 3, borderColor: "#FFFFFF" },
  hint: { color: "#FFFFFF", marginTop: spacing.lg, fontSize: 15, fontWeight: "600" },
}));

function StyleSheetFill() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
}
