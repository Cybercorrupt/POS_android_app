import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Icon } from "./icon";
import { makeStyles, spacing, useTheme } from "@/src/theme";

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  headerRight?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  refreshControl?: React.ComponentProps<typeof KeyboardAwareScrollView>["refreshControl"];
  testID?: string;
}

export function Screen({
  title,
  subtitle,
  showBack = false,
  headerRight,
  children,
  scroll = false,
  footer,
  refreshControl,
  testID,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.root} testID={testID}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {showBack ? (
              <Pressable
                testID="header-back"
                onPress={() => router.back()}
                hitSlop={10}
                style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              >
                <Icon name="arrow-left" size={22} color={colors.onSurface} />
              </Pressable>
            ) : null}
            <View style={styles.titleWrap}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
          {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
        </View>
      </View>

      {scroll ? (
        <KeyboardAwareScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={20}
          refreshControl={refreshControl}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <View style={styles.flex}>{children}</View>
      )}

      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>{footer}</View> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
  titleWrap: { flex: 1 },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.x2l, gap: spacing.md },
  footer: {
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
}));
