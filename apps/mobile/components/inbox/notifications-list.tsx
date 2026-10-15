import { useInfiniteQuery } from "@tanstack/react-query";
import { useScrollToTop } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Empty, LoadError, Skeleton } from "@/components/inbox/list-states";
import { NotificationRow } from "@/components/inbox/notification-row";
import { Spinner } from "@/components/ui/spinner";
import { notificationsQuery } from "@/lib/messaging-queries";
import { colors } from "@/theme";

/** The news list: sentences written from the type and values the server sends. */
export function NotificationsList() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  const { t } = useTranslation();
  const query = useInfiniteQuery(notificationsQuery());
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
  if (query.isPending) empty = <Skeleton />;
  else if (query.isError && rows.length === 0) empty = <LoadError onRetry={() => void query.refetch()} />;
  else if (rows.length === 0) {
    empty = <Empty title={t("inbox.emptyNotificationsTitle")} note={t("inbox.emptyNotificationsNote")} />;
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => <NotificationRow notification={item} />}
      ListEmptyComponent={empty}
      ListFooterComponent={query.isFetchingNextPage ? <Spinner /> : null}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} />
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom }}
    />
  );
}
