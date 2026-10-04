import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { EmptyState } from "@/src/components/ui/empty-state";
import { Icon } from "@/src/components/ui/icon";
import { Screen } from "@/src/components/ui/screen";
import { SearchBar } from "@/src/components/ui/search-bar";
import { qk } from "@/src/db/keys";
import { listCustomers } from "@/src/db/repo/customers";
import type { Customer } from "@/src/db/types";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function Customers() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const customers = useQuery({ queryKey: qk.customers(search), queryFn: () => listCustomers(search) });

  useFocusEffect(useCallback(() => { customers.refetch(); }, [customers]));

  const renderItem = ({ item }: { item: Customer }) => (
    <Pressable
      testID={`customer-row-${item.id}`}
      onPress={() => router.push(`/customer-form?id=${item.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <Icon name="account-outline" size={22} color={colors.brandPrimary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{item.phone || "Tanpa nomor HP"}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <Screen title="Pelanggan" subtitle={`${customers.data?.length ?? 0} pelanggan`} showBack testID="customers-screen">
      <View style={styles.searchWrap}>
        <SearchBar testID="customers-search" value={search} onChangeText={setSearch} placeholder="Cari nama / HP" />
      </View>
      <FlatList
        data={customers.data ?? []}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={customers.isLoading ? null : <EmptyState icon="account-multiple-outline" title="Belum ada pelanggan" message="Tap tombol + untuk menambah pelanggan." />}
      />
      <Pressable testID="customers-fab" onPress={() => router.push("/customer-form")} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
        <Icon name="plus" size={26} color={colors.onBrandPrimary} />
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.x2l * 2, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  pressed: { opacity: 0.6 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  sep: { height: 1, backgroundColor: colors.divider },
  fab: { position: "absolute", right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabPressed: { backgroundColor: colors.brandPrimaryPressed },
}));
