import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import type { ViewToken } from "react-native";
import { trackImpression } from "@/lib/events";
import { ImpressionTracker } from "@/lib/impressions";

/** The grid shows two cards per row, so a row at index `i` holds positions `2i` and `2i + 1`. */
type PairRow = { left: { id: string }; right?: { id: string } };

/**
 * Counts "card seen" on Home: a card half visible for one second, once per feed list. Give the result to the
 * FlatList (`onViewableItemsChanged` and `viewabilityConfig`). The clock stops while Home is not the screen in front.
 */
export function useImpressions(enabled: boolean, feedId: string | null) {
  const tracker = useRef<ImpressionTracker | null>(null);
  if (!tracker.current) tracker.current = new ImpressionTracker(trackImpression);
  const current = tracker.current;

  useEffect(() => {
    current.setFeed(feedId);
  }, [current, feedId]);

  useEffect(() => () => current.dispose(), [current]);

  useFocusEffect(
    useCallback(() => {
      current.resume();
      return () => current.pause();
    }, [current]),
  );

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (!enabledRef.current) return current.setVisible([]);
    const cards: { listingId: string; position: number }[] = [];
    for (const token of viewableItems) {
      if (token.index === null) continue;
      const row = token.item as PairRow;
      cards.push({ listingId: row.left.id, position: token.index * 2 });
      if (row.right) cards.push({ listingId: row.right.id, position: token.index * 2 + 1 });
    }
    current.setVisible(cards);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  return { onViewableItemsChanged, viewabilityConfig };
}
