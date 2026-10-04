import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, LogBox, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/src/auth/auth-context";
import { GoogleDriveProvider } from "@/src/auth/google-drive-context";
import { CartProvider } from "@/src/cart/cart-context";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/ui/toast";
import { initDatabase } from "@/src/db/database";
import { queryClient } from "@/src/query-client";
import { themes } from "@/src/theme";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    MaterialDesignIcons: require("@react-native-vector-icons/material-design-icons/fonts/MaterialDesignIcons.ttf"),
  });
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((e) => setDbError(e instanceof Error ? e.message : "Gagal memuat database"));
  }, []);

  const ready = fontsLoaded && dbReady;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <ToastProvider>
                <AuthProvider ready={ready}>
                  <GoogleDriveProvider>
                  <CartProvider>
                    {ready ? (
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="product-form" options={{ presentation: "modal" }} />
                        <Stack.Screen name="customer-form" options={{ presentation: "modal" }} />
                        <Stack.Screen name="stock-adjust" options={{ presentation: "modal" }} />
                        <Stack.Screen name="user-form" options={{ presentation: "modal" }} />
                        <Stack.Screen name="scanner" options={{ presentation: "modal" }} />
                      </Stack>
                    ) : (
                      <Boot error={dbError} />
                    )}
                  </CartProvider>
                  </GoogleDriveProvider>
                </AuthProvider>
              </ToastProvider>
            </KeyboardProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function Boot({ error }: { error: string | null }) {
  const colors = themes.light;
  return (
    <View style={{ flex: 1, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Text style={{ fontSize: 30, fontWeight: "900", color: colors.onBrandPrimary, letterSpacing: 1 }}>Sellix POS</Text>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.onBrandPrimary, opacity: 0.85, marginTop: -8 }}>Modern POS by MeO-Labs</Text>
      {error ? (
        <Text style={{ color: colors.onBrandPrimary, paddingHorizontal: 32, textAlign: "center" }}>{error}</Text>
      ) : (
        <ActivityIndicator color={colors.onBrandPrimary} />
      )}
    </View>
  );
}
