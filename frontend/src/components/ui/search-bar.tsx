import { Pressable, TextInput, View } from "react-native";

import { Icon } from "./icon";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  onScan?: () => void;
  testID?: string;
}

export function SearchBar({ value, onChangeText, placeholder = "Cari...", onScan, testID }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Icon name="magnify" size={20} color={colors.muted} />
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable testID="search-clear" onPress={() => onChangeText("")} hitSlop={8}>
          <Icon name="close" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
      {onScan ? (
        <Pressable testID="search-scan" onPress={onScan} hitSlop={8} style={styles.scanBtn}>
          <Icon name="barcode-scan" size={20} color={colors.brandPrimary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  input: { flex: 1, fontSize: 15, color: colors.onSurface, padding: 0 },
  scanBtn: { paddingLeft: spacing.xs },
}));
