import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, ScrollView } from "react-native";
import { OrderRow } from "@/components/orders/order-row";
import { EmptyState, ListSkeleton, LoadError } from "@/components/orders/states";
import { Chip } from "@/components/ui/chip";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { TopBar } from "@/components/ui/top-bar";
import { type OrdersFilter, type OrdersRole, ordersQuery } from "@/lib/orders-queries";
import { colors } from "@/theme";

const FILTERS: OrdersFilter[] = ["all", "in_progress", "completed", "cancelled"];

/** My orders: what I bought and what I sold, filtered by how far along they are. */
export default function MyOrders() {
  const { t } = useTranslation();
  const [role, setRole] = useState<OrdersRole>("bought");
  const [filter, setFilter] = useState<OrdersFilter>("all");
  const query = useInfiniteQuery(ordersQuery(role, filter));
  const [refreshing, setRefreshing] = useState(false);
  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];

  const refresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  let empty: React.ReactElement | null = null;
  if (query.isPending) empty = <ListSkeleton />;
  else if (query.isError && rows.length === 0) empty = <LoadError onRetry={() => void query.refetch()} />;
  else if (rows.length === 0) {
    empty = (
      <EmptyState
        title={t(`orders.empty.${role}.${filter}.title`)}
        note={t(`orders.empty.${role}.${filter}.note`)}
      />
    );
  }

  return (
    <Screen bottomInset={false}>
      <TopBar title={t("orders.title")} />
      <Tabs
        value={role}
        onChange={setRole}
        items={[
          { key: "bought", label: t("orders.bought") },
          { key: "sold", label: t("orders.sold") },
        ]}
      />
      <FlatList
        data={rows}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <OrderRow order={item} />}
        ListHeaderComponent={
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-sm px-lg py-md"
          >
            {FILTERS.map((key) => (
              <Chip
                key={key}
                label={t(`orders.filter.${key}`)}
                selected={filter === key}
                onPress={() => setFilter(key)}
              />
            ))}
          </ScrollView>
        }
        ListEmptyComponent={empty}
        ListFooterComponent={query.isFetchingNextPage ? <Spinner /> : null}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
