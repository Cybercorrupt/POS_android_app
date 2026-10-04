import { forwardRef } from "react";
import { Text, TextInput, type TextInputProps, View } from "react-native";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, hint, style, ...rest },
  ref,
) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={colors.muted}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const useStyles = makeStyles((colors) => ({
  wrap: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 50,
    fontSize: 16,
    color: colors.onSurface,
  },
  inputError: { borderColor: colors.error },
  error: { fontSize: 12, color: colors.error },
  hint: { fontSize: 12, color: colors.muted },
}));
