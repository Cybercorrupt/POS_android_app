import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/src/auth/auth-context";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { Icon, type IconName } from "@/src/components/ui/icon";
import { Screen } from "@/src/components/ui/screen";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function More() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user, isAdmin } = useAuth();

  const items: { label: string; icon: IconName; route: string; show: boolean; desc: string }[] = [
    { label: "Inventori", icon: "warehouse", route: "/inventory", show: true, desc: "Stok masuk, keluar & penyesuaian" },
    { label: "Pelanggan", icon: "account-multiple-outline", route: "/customers", show: true, desc: "Kelola data pelanggan" },
    { label: "Riwayat Transaksi", icon: "history", route: "/transactions", show: true, desc: "Lihat & cari transaksi" },
    { label: "Laporan Penjualan", icon: "chart-box-outline", route: "/daily-report", show: isAdmin, desc: "Harian, mingguan, bulanan & tahunan" },
    { label: "Pengguna", icon: "shield-account-outline", route: "/users", show: isAdmin, desc: "Kelola user & admin" },
    { label: "Satuan Unit", icon: "ruler", route: "/units", show: isAdmin, desc: "Kelola satuan produk" },
    { label: "Backup Data", icon: "database-arrow-down-outline", route: "/backup", show: isAdmin, desc: "Backup, ekspor penjualan & impor produk" },
    { label: "Pengaturan", icon: "cog-outline", route: "/settings", show: true, desc: "Toko, struk & aplikasi" },
  ];

  return (
    <Screen title="Lainnya" scroll testID="more-screen">
      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <Icon name="account-circle-outline" size={34} color={colors.brandPrimary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.username}>@{user?.username}</Text>
        </View>
        <Badge label={isAdmin ? "Admin" : "User"} tone={isAdmin ? "brand" : "info"} />
      </Card>

      <Card padded={false}>
        {items.filter((i) => i.show).map((item, idx) => (
          <Pressable
            key={item.route}
            testID={`more-${item.label}`}
            onPress={() => router.push(item.route as never)}
            style={({ pressed }) => [styles.row, idx > 0 && styles.rowBorder, pressed && styles.pressed]}
          >
            <View style={styles.rowIcon}>
              <Icon name={item.icon} size={22} color={colors.brandPrimary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowDesc} numberOfLines={1}>{item.desc}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        ))}
      </Card>

      <Text style={styles.version}>Sellix POS by MeO-Labs • Modern POS v1.0</Text>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  name: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  username: { fontSize: 13, color: colors.muted, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  pressed: { opacity: 0.6 },
  rowIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  rowDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  version: { textAlign: "center", color: colors.muted, fontSize: 12, marginTop: spacing.sm },
}));
