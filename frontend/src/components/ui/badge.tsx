import { Text, View } from "react-native";

import { makeStyles, radius } from "@/src/theme";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const styles = useStyles();
  const toneStyle = {
    success: styles.success,
    warning: styles.warning,
    danger: styles.danger,
    info: styles.info,
    neutral: styles.neutral,
    brand: styles.brand,
  }[tone];
  const textTone = {
    success: styles.successText,
    warning: styles.warningText,
    danger: styles.dangerText,
    info: styles.infoText,
    neutral: styles.neutralText,
    brand: styles.brandText,
  }[tone];
  return (
    <View style={[styles.base, toneStyle]}>
      <Text style={[styles.text, textTone]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  base: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  text: { fontSize: 12, fontWeight: "700" },
  success: { backgroundColor: "#DCFCE7" },
  successText: { color: colors.success },
  warning: { backgroundColor: "#FEF3C7" },
  warningText: { color: colors.warning },
  danger: { backgroundColor: "#FEE2E2" },
  dangerText: { color: colors.error },
  info: { backgroundColor: "#DBEAFE" },
  infoText: { color: colors.info },
  neutral: { backgroundColor: colors.surfaceTertiary },
  neutralText: { color: colors.onSurfaceTertiary },
  brand: { backgroundColor: colors.brandTertiary },
  brandText: { color: colors.onBrandTertiary },
}));
