import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useScrollToTop } from "expo-router";
import { Archive } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConversationRow } from "@/components/inbox/conversation-row";
import { Empty, LoadError, Skeleton } from "@/components/inbox/list-states";
import { NotificationsList } from "@/components/inbox/notifications-list";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { BackIcon, ForwardIcon } from "@/components/ui/top-bar";
import { conversationsQuery, unreadQuery, useMarkNotificationsRead } from "@/lib/messaging-queries";
import { colors } from "@/theme";

type Section = "messages" | "notifications";

/** The chats (Messages tab) or the archive. */
function MessagesList({ archived, onOpenArchive }: { archived: boolean; onOpenArchive?: () => void }) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  const { t } = useTranslation();
  const query = useInfiniteQuery(conversationsQuery(archived));
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
    empty = archived ? (
      <Empty title={t("inbox.emptyArchivedTitle")} note={t("inbox.emptyArchivedNote")} />
    ) : (
      <Empty title={t("inbox.emptyMessagesTitle")} note={t("inbox.emptyMessagesNote")} />
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(row) => row.id}
      renderItem={({ item }) => <ConversationRow row={item} />}
      ListHeaderComponent={
        onOpenArchive ? (
          <Pressable
            onPress={onOpenArchive}
            role="button"
            className="flex-row items-center gap-md border-b border-border-subtle px-lg py-md active:bg-surface"
          >
            <Icon as={Archive} size={20} className="text-text-2" />
            <Text weight={500} className="flex-1">
              {t("inbox.archived")}
            </Text>
            <ForwardIcon />
          </Pressable>
        ) : null
      }
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

export default function Inbox() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>("messages");
  const [showArchive, setShowArchive] = useState(false);
  const unread = useQuery(unreadQuery());
  const markAll = useMarkNotificationsRead();
  const notificationsUnread = (unread.data?.notifications ?? 0) > 0;

  if (showArchive) {
    return (
      <Screen bottomInset={false}>
        <View className="h-14 flex-row items-center px-sm">
          <Pressable
            onPress={() => setShowArchive(false)}
            hitSlop={8}
            role="button"
            accessibilityLabel={t("common.back")}
            className="h-11 w-11 items-center justify-center rounded-full bg-transparent active:bg-pressed"
          >
            <BackIcon />
          </Pressable>
          <Text variant="heading" className="flex-1 text-center" accessibilityRole="header">
            {t("inbox.archived")}
          </Text>
          <View className="w-11" />
        </View>
        <MessagesList archived />
      </Screen>
    );
  }

  return (
    <Screen bottomInset={false}>
      <View className="h-14 flex-row items-center justify-between px-lg">
        <Text variant="heading" accessibilityRole="header">
          {t("tabs.inbox")}
        </Text>
        {section === "notifications" && notificationsUnread ? (
          <Pressable onPress={() => markAll.mutate(undefined)} hitSlop={8} role="button">
            <Text variant="bodySmall" weight={600} className="text-primary">
              {t("inbox.markAllRead")}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Tabs
        value={section}
        onChange={setSection}
        items={[
          { key: "messages", label: t("inbox.messages"), dot: (unread.data?.messages ?? 0) > 0 },
          { key: "notifications", label: t("inbox.notifications"), dot: notificationsUnread },
        ]}
      />
      {section === "messages" ? (
        <MessagesList archived={false} onOpenArchive={() => setShowArchive(true)} />
      ) : (
        <NotificationsList />
      )}
    </Screen>
  );
}
