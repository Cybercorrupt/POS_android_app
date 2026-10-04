import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Image } from "expo-image";

import { useAuth } from "@/src/auth/auth-context";
import { Button } from "@/src/components/ui/button";
import { Icon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!username.trim() || !password) {
      setError("Lengkapi username dan password");
      return;
    }
    setError(null);
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);
    if (res.ok) {
      router.replace("/(tabs)");
    } else {
      setError(res.error ?? "Gagal masuk");
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.x2l, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrap}>
          <Image source={require("../assets/images/icon.png")} style={styles.logo} contentFit="cover" />
          <Text style={styles.appName}>Sellix POS</Text>
          <Text style={styles.byline}>by MeO-Labs</Text>
          <View style={styles.taglinePill}>
            <Text style={styles.tagline}>Modern POS</Text>
          </View>
        </View>

        <View style={styles.form}>
          <Input
            label="Username"
            testID="login-username"
            value={username}
            onChangeText={setUsername}
            placeholder="admin"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View>
            <Input
              label="Password"
              testID="login-password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPass}
              autoCapitalize="none"
            />
            <Pressable style={styles.eye} onPress={() => setShowPass((v) => !v)} hitSlop={8} testID="login-toggle-pass">
              <Icon name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBox} testID="login-error">
              <Icon name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button title="Masuk" onPress={onLogin} loading={loading} testID="login-submit" icon="login" />

          <View style={styles.hint}>
            <Text style={styles.hintText}>Default admin: admin / admin123</Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, justifyContent: "center", gap: spacing.x2l },
  logoWrap: { alignItems: "center", gap: spacing.xs },
  logo: {
    width: 96, height: 96, borderRadius: radius.xl,
    marginBottom: spacing.sm,
  },
  appName: { fontSize: 30, fontWeight: "900", color: colors.onSurface, letterSpacing: 1 },
  byline: { fontSize: 14, color: colors.brandPrimary, fontWeight: "700" },
  taglinePill: { marginTop: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.brandTertiary },
  tagline: { fontSize: 12, color: colors.onBrandTertiary, fontWeight: "700", letterSpacing: 0.5 },
  form: { gap: spacing.lg },
  eye: { position: "absolute", right: spacing.md, top: 34 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: "#FEE2E2", borderRadius: radius.md, padding: spacing.md,
  },
  errorText: { color: colors.error, fontSize: 14, flex: 1 },
  hint: { alignItems: "center", marginTop: spacing.xs },
  hintText: { color: colors.muted, fontSize: 13 },
}));
