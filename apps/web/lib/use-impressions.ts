"use client";

import { type RefObject, useEffect, useRef } from "react";
import { trackImpression } from "@/lib/events";
import { ImpressionTracker } from "@/lib/impressions";

/**
 * Counts "card seen" on Home like the app: a card at least half visible for one second, once per feed list. The cards
 * inside `container` carry `data-card-id` and `data-position`. `feedId` names the list they came from. The clock stops
 * while the tab is hidden. `count` is the number of cards, so new ones are picked up as more pages load.
 */
export function useImpressions(
  container: RefObject<HTMLElement | null>,
  enabled: boolean,
  feedId: string | null,
  count: number,
) {
  const tracker = useRef<ImpressionTracker | null>(null);
  if (!tracker.current) tracker.current = new ImpressionTracker(trackImpression);
  const current = tracker.current;
  const observer = useRef<IntersectionObserver | null>(null);
  const visible = useRef(new Map<string, number>());

  useEffect(() => current.setFeed(feedId), [current, feedId]);

  useEffect(() => {
    const onVisibility = () => (document.visibilityState === "hidden" ? current.pause() : current.resume());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      current.dispose();
    };
  }, [current]);

  // One observer for the whole grid.
  useEffect(() => {
    if (!enabled) {
      current.setVisible([]);
      return;
    }
    const seen = visible.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const id = el.dataset.cardId;
          if (!id) continue;
          if (entry.isIntersecting) seen.set(id, Number(el.dataset.position ?? 0));
          else seen.delete(id);
        }
        current.setVisible([...seen].map(([listingId, position]) => ({ listingId, position })));
      },
      { threshold: 0.5 },
    );
    observer.current = io;
    return () => {
      io.disconnect();
      observer.current = null;
      seen.clear();
      current.setVisible([]);
    };
  }, [current, enabled]);

  // Cards that arrived with a new page start being watched.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `count` is the signal that new cards are in the grid
  useEffect(() => {
    const io = observer.current;
    const root = container.current;
    if (!io || !root) return;
    for (const el of root.querySelectorAll("[data-card-id]")) io.observe(el);
  }, [container, count, enabled]);
}
