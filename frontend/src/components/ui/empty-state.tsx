import { Text, View } from "react-native";

import { Icon, type IconName } from "./icon";
import { makeStyles, spacing, useTheme } from "@/src/theme";

interface Props {
  icon: IconName;
  title: string;
  message?: string;
}

export function EmptyState({ icon, title, message }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} testID="empty-state">
      <View style={styles.iconWrap}>
        <Icon name={icon} size={34} color={colors.muted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.x2l * 1.5, paddingHorizontal: spacing.xl, gap: spacing.sm },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.xs,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.onSurface, textAlign: "center" },
  message: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
}));
