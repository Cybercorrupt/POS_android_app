import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { useAuth } from "@/src/auth/auth-context";
import { Badge } from "@/src/components/ui/badge";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Icon } from "@/src/components/ui/icon";
import { Screen } from "@/src/components/ui/screen";
import { qk } from "@/src/db/keys";
import { listUsers } from "@/src/db/repo/users";
import type { User } from "@/src/db/types";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function Users() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user: current } = useAuth();

  const users = useQuery({ queryKey: qk.users, queryFn: listUsers });
  useFocusEffect(useCallback(() => { users.refetch(); }, [users]));

  const renderItem = ({ item }: { item: User }) => (
    <View style={styles.row} testID={`user-row-${item.username}`}>
      <View style={styles.avatar}>
        <Icon name="account-circle-outline" size={26} color={colors.brandPrimary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.name}>{item.name}{item.id === current?.id ? " (Anda)" : ""}</Text>
        <Text style={styles.meta}>@{item.username}</Text>
      </View>
      <Badge label={item.role_name === "admin" ? "Admin" : "User"} tone={item.role_name === "admin" ? "brand" : "info"} />
    </View>
  );

  return (
    <Screen title="Pengguna" subtitle={`${users.data?.length ?? 0} akun`} showBack testID="users-screen">
      <FlatList
        data={users.data ?? []}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={users.isLoading ? null : <EmptyState icon="shield-account-outline" title="Belum ada pengguna" />}
      />
      <Pressable testID="users-fab" onPress={() => router.push("/user-form")} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
        <Icon name="plus" size={26} color={colors.onBrandPrimary} />
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  listContent: { padding: spacing.lg, paddingBottom: spacing.x2l * 2, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  sep: { height: 1, backgroundColor: colors.divider },
  fab: { position: "absolute", right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabPressed: { backgroundColor: colors.brandPrimaryPressed },
}));
