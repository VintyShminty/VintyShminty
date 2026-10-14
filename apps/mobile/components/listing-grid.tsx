import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import type { ListingCard as ListingCardData } from "@vinty/shared";
import { useScrollToTop } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useImpressions } from "@/lib/use-impressions";
import { colors } from "@/theme";

type ListingPage = { items: ListingCardData[]; nextCursor: string | null };

type ListingGridProps = {
  /** The result of an infinite query whose pages are `{ items, nextCursor }`. */
  query: UseInfiniteQueryResult<InfiniteData<ListingPage>, Error>;
  /** Shown above the cards and scrolls with them (chips, counts, the profile header). */
  header?: React.ReactElement | null;
  emptyTitle: string;
  emptyMessage?: string;
  /** A button or link under the empty message (Home: add your sizes, add your city). */
  emptyAction?: React.ReactElement | null;
  /** Hides the heart on every card (a list known to be the viewer's own items). */
  hideHearts?: boolean;
  /** Favourites: sold items keep their heart so they can be removed. */
  heartOnSold?: boolean;
  /** Extra space under the last row, on top of the safe area (inside a tab, that includes the floating bar). */
  bottomPadding?: number;
  onScrollBeginDrag?: () => void;
  /** Home only: count "card seen" for the cards on screen. `feedId` names the list they came from. */
  track?: { feedId: string | null };
  /** Home only: a long press on a card (see components/feed-reason-sheet.tsx). */
  onCardLongPress?: (listing: ListingCardData) => void;
  /** Replaces the plain refetch of pull to refresh (Home builds a new list from page one). */
  onRefresh?: () => Promise<unknown> | unknown;
};

type Row = { key: string; left: ListingCardData; right?: ListingCardData };

/** One card's loading placeholder: a photo block and three short lines. */
function SkeletonCard() {
  return (
    <View className="flex-1" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View className="aspect-[3/4] rounded-control bg-pressed" />
      <View className="gap-xs pt-sm">
        <View className="h-3 w-2/3 rounded-full bg-pressed" />
        <View className="h-3 w-1/2 rounded-full bg-surface" />
        <View className="h-3 w-1/3 rounded-full bg-pressed" />
      </View>
    </View>
  );
}

/**
 * The two column grid of item cards used by Home, Browse results, Search, Favourites and profiles
 * (docs/components.md, ItemCard). Infinite paging, pull to refresh, a loading skeleton, and empty and error states.
 * Cached cards stay on screen while a new page or refresh loads (never blanks).
 */
function ListingGrid({
  query,
  header,
  emptyTitle,
  emptyMessage,
  emptyAction,
  hideHearts,
  heartOnSold,
  bottomPadding,
  onScrollBeginDrag,
  track,
  onCardLongPress,
  onRefresh,
}: ListingGridProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  // Tapping the tab you are already on scrolls the list back to the top.
  const listRef = useRef<FlatList<Row>>(null);
  useScrollToTop(listRef);

  const rows = useMemo<Row[]>(() => {
    // A card never shows twice, even if two pages overlap.
    const seen = new Set<string>();
    const items = (query.data?.pages.flatMap((p) => p.items) ?? []).filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
    const out: Row[] = [];
    for (let i = 0; i < items.length; i += 2) {
      const left = items[i] as ListingCardData;
      out.push({ key: left.id, left, right: items[i + 1] });
    }
    return out;
  }, [query.data]);

  const impressions = useImpressions(Boolean(track), track?.feedId ?? null);

  const loading = query.isPending;
  const failed = query.isError && rows.length === 0;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await (onRefresh ? onRefresh() : query.refetch());
    } finally {
      setRefreshing(false);
    }
  };

  let body: React.ReactElement | null = null;
  if (loading) {
    body = (
      <View className="gap-lg px-lg pt-sm">
        {[0, 1, 2].map((n) => (
          <View key={n} className="flex-row gap-md">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ))}
      </View>
    );
  } else if (failed) {
    body = (
      <View className="items-center gap-md px-xl py-2xl">
        <Text variant="heading" className="text-center">
          {t("errors.general")}
        </Text>
        <Button variant="outline" onPress={() => query.refetch()}>
          <Text>{t("common.tryAgain")}</Text>
        </Button>
      </View>
    );
  } else if (rows.length === 0) {
    body = (
      <View className="items-center gap-sm px-xl py-2xl">
        <Text variant="heading" className="text-center">
          {emptyTitle}
        </Text>
        {emptyMessage ? (
          <Text variant="subtitle" className="text-center text-text-3">
            {emptyMessage}
          </Text>
        ) : null}
        {emptyAction}
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={body ? [] : rows}
      keyExtractor={(row) => row.key}
      ListHeaderComponent={header}
      ListEmptyComponent={body}
      renderItem={({ item }) => (
        <View className="flex-row gap-md px-lg pb-lg">
          <ListingCard
            listing={item.left}
            hideHeart={hideHearts}
            heartOnSold={heartOnSold}
            onLongPress={onCardLongPress}
          />
          {item.right ? (
            <ListingCard
              listing={item.right}
              hideHeart={hideHearts}
              heartOnSold={heartOnSold}
              onLongPress={onCardLongPress}
            />
          ) : (
            <View className="flex-1" />
          )}
        </View>
      )}
      ListFooterComponent={query.isFetchingNextPage ? <Spinner /> : null}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      onEndReachedThreshold={0.6}
      onScrollBeginDrag={onScrollBeginDrag}
      onViewableItemsChanged={track ? impressions.onViewableItemsChanged : undefined}
      viewabilityConfig={track ? impressions.viewabilityConfig : undefined}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
      }
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: insets.bottom + (bottomPadding ?? 8) }}
      showsVerticalScrollIndicator={false}
      initialNumToRender={6}
      windowSize={7}
    />
  );
}

export type { ListingGridProps };
export { ListingGrid };
