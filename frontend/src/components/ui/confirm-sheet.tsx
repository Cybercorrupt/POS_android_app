import { Text, View } from "react-native";

import { Button } from "./button";
import { Sheet } from "./sheet";
import { makeStyles, spacing } from "@/src/theme";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = "Konfirmasi",
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  const styles = useStyles();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button title="Batal" variant="outline" onPress={onClose} />
        </View>
        <View style={styles.flex}>
          <Button
            title={confirmLabel}
            variant={destructive ? "danger" : "primary"}
            loading={loading}
            onPress={onConfirm}
            testID="confirm-action"
          />
        </View>
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => ({
  message: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  flex: { flex: 1 },
}));
