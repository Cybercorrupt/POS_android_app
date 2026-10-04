import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";

import { useAuth } from "@/src/auth/auth-context";
import { Icon, type IconName } from "@/src/components/ui/icon";
import { useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();

  if (!user) return <Redirect href="/login" />;

  const tab = (name: IconName) => {
    const TabBarIcon = ({ color, size }: { color: string; size: number }) => (
      <Icon name={name} size={size} color={color} />
    );
    TabBarIcon.displayName = `TabBarIcon(${name})`;
    return TabBarIcon;
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: tab("view-dashboard") }} />
      <Tabs.Screen name="pos" options={{ title: "Penjualan", tabBarIcon: tab("cart") }} />
      <Tabs.Screen name="products" options={{ title: "Produk", tabBarIcon: tab("package-variant") }} />
      <Tabs.Screen name="more" options={{ title: "Lainnya", tabBarIcon: tab("dots-horizontal") }} />
    </Tabs>
  );
}
