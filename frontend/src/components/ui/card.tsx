import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";

import { makeStyles, radius, spacing } from "@/src/theme";

interface Props {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
  testID?: string;
}

export function Card({ children, style, padded = true, testID }: Props) {
  const styles = useStyles();
  return <View testID={testID} style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  padded: { padding: spacing.lg },
}));
