"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FeedGroup, type FeedMood, type HomeFeedPage, personalisationSizesSchema } from "@vinty/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { HomePriceChip } from "@/components/home-price-chip";
import { InfiniteItemGrid } from "@/components/infinite-item-grid";
import { useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import { feedPath, GROUPS, homeHref, MOODS, type PriceRange } from "@/lib/feed-url";
import { gridQueryOptions } from "@/lib/grid-query";
import { homeEmptyText } from "@/lib/home-empty";
import { cn } from "@/lib/utils";

const samePrice = (a: PriceRange, b: PriceRange) => a.min === b.min && a.max === b.max;

/**
 * The Home chips and the feed under them. Switching a chip is done here in the browser: the address is updated with
 * `history.replaceState` (no trip to the server), the old cards stay dimmed until the new mood's cards arrive, and the
 * other chips' first pages are loaded quietly once the page is idle, so most switches show cards at once.
 * The first page of the mood in the address still comes from the server, so it is in the HTML for Google.
 */
export function HomeFeed({
  lang,
  initialMood,
  initialGroup,
  initialPrice,
  firstPage,
  city,
}: {
  lang: string;
  initialMood: FeedMood;
  initialGroup: FeedGroup | null;
  initialPrice: PriceRange;
  firstPage: HomeFeedPage | null;
  /** The viewer's city (null when not set), undefined for visitors. Only the empty Near you note needs it. */
  city?: string | null;
}) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const queryClient = useQueryClient();
  const [mood, setMood] = useState<FeedMood>(initialMood);
  const [group, setGroup] = useState<FeedGroup | null>(initialGroup);
  const [price, setPrice] = useState<PriceRange>(initialPrice);
  const signedIn = Boolean(viewer);
  const moods = useMemo(() => MOODS.filter((m) => signedIn || !m.needsAccount), [signedIn]);

  // There is no "For you" chip, it is the plain Home. Tapping the chosen mood again goes back to it.
  const choose = useCallback(
    (next: FeedMood) => {
      const value = mood === next ? "for_you" : next;
      setMood(value);
      window.history.replaceState(window.history.state, "", homeHref(lang, value, group, price));
    },
    [lang, mood, group, price],
  );

  // Women or Men: tapping the chosen one again clears it. It works together with the mood.
  const chooseGroup = useCallback(
    (next: FeedGroup) => {
      const value = group === next ? null : next;
      setGroup(value);
      window.history.replaceState(window.history.state, "", homeHref(lang, mood, value, price));
    },
    [lang, mood, group, price],
  );

  // The Price chip: a range in whole shekels, or none. It works together with the group and the mood.
  const choosePrice = useCallback(
    (next: PriceRange) => {
      setPrice(next);
      window.history.replaceState(window.history.state, "", homeHref(lang, mood, group, next));
    },
    [lang, mood, group],
  );

  // Load the other moods' first page in the background, after the page has settled.
  useEffect(() => {
    const warm = () => {
      for (const m of moods) {
        if (m.key === initialMood && group === initialGroup && samePrice(price, initialPrice)) continue;
        void queryClient.prefetchInfiniteQuery({
          ...gridQueryOptions("feed", feedPath(m.key, group, price), lang),
          pages: 1,
        });
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 800);
    return () => window.clearTimeout(id);
  }, [queryClient, lang, initialMood, initialGroup, initialPrice, group, price, moods]);

  // Only an empty "Your sizes" list needs to know whether sizes are set (the note differs).
  const sizes = useQuery({
    queryKey: ["personalisation-sizes"],
    queryFn: () => clientApi("/v1/me/personalisation/sizes", { schema: personalisationSizesSchema, lang }),
    enabled: Boolean(viewer) && mood === "your_sizes",
  });
  const empty = homeEmptyText(mood, t, {
    hasSizes: sizes.data ? sizes.data.sizeIds.length > 0 : undefined,
    city,
  });

  const chips = moods.filter((m) => m.key !== "for_you");
  const moodChip = (m: (typeof MOODS)[number]) => (
    <Chip
      key={m.key}
      href={homeHref(lang, mood === m.key ? "for_you" : m.key, group, price)}
      onClick={() => choose(m.key)}
      selected={mood === m.key}
      label={t(`home.moods.${m.key}`)}
      className={cn(
        "h-8 rounded-full px-[14px]",
        mood === m.key ? "border-text-1 bg-text-1 font-semibold" : "border-border text-text-2",
      )}
    />
  );

  const endpoint = feedPath(mood, group, price);
  return (
    <>
      <div className="mb-xl mt-lg">
        <nav
          aria-label={t("web.nav.feedNavigation")}
          className="-mx-lg flex gap-sm overflow-x-auto px-lg pb-xs md:mx-0 md:flex-wrap md:px-0"
        >
          {GROUPS.map((g) => (
            <Chip
              key={g}
              href={homeHref(lang, mood, group === g ? null : g)}
              onClick={() => chooseGroup(g)}
              selected={group === g}
              label={t(`browse.groups.${g}`)}
              // Light pills on Home (D-039): a light outline, the chosen one near black.
              className={cn(
                "h-8 rounded-full px-[14px]",
                group === g ? "border-text-1 bg-text-1 font-semibold" : "border-border text-text-2",
              )}
            />
          ))}
          <span aria-hidden className="mx-xs my-1 w-px shrink-0 self-stretch bg-border" />
          {chips.slice(0, 1).map(moodChip)}
          <HomePriceChip price={price} onChange={choosePrice} />
          {chips.slice(1).map(moodChip)}
        </nav>
      </div>
      <InfiniteItemGrid
        endpoint={endpoint}
        kind="feed"
        firstPage={
          mood === initialMood && group === initialGroup && samePrice(price, initialPrice) ? firstPage : null
        }
        empty={<EmptyState title={empty.title} message={empty.message} />}
      />
    </>
  );
}
