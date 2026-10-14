"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type FeedMood,
  formatPrice,
  type HomeFeedPage,
  personalisationSizesSchema,
  UNDER_50_MINOR,
} from "@vinty/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { InfiniteItemGrid } from "@/components/infinite-item-grid";
import { useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import { feedPath, homeHref, MOODS } from "@/lib/feed-url";
import { gridQueryOptions } from "@/lib/grid-query";
import { homeEmptyText } from "@/lib/home-empty";

/**
 * The Home chips and the feed under them. Switching a chip is done here in the browser: the address is updated with
 * `history.replaceState` (no trip to the server), the old cards stay dimmed until the new mood's cards arrive, and the
 * other chips' first pages are loaded quietly once the page is idle, so most switches show cards at once.
 * The first page of the mood in the address still comes from the server, so it is in the HTML for Google.
 */
export function HomeFeed({
  lang,
  initialMood,
  firstPage,
  city,
}: {
  lang: string;
  initialMood: FeedMood;
  firstPage: HomeFeedPage | null;
  /** The viewer's city (null when not set), undefined for visitors. Only the empty Near you note needs it. */
  city?: string | null;
}) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const queryClient = useQueryClient();
  const [mood, setMood] = useState<FeedMood>(initialMood);
  const signedIn = Boolean(viewer);
  const moods = useMemo(() => MOODS.filter((m) => signedIn || !m.needsAccount), [signedIn]);

  const choose = useCallback(
    (next: FeedMood) => {
      setMood(next);
      window.history.replaceState(window.history.state, "", homeHref(lang, next));
    },
    [lang],
  );

  // Load the other moods' first page in the background, after the page has settled.
  useEffect(() => {
    const warm = () => {
      for (const m of moods) {
        if (m.key === initialMood) continue;
        void queryClient.prefetchInfiniteQuery({
          ...gridQueryOptions("feed", feedPath(m.key), lang),
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
  }, [queryClient, lang, initialMood, moods]);

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

  const endpoint = feedPath(mood);
  return (
    <>
      <div className="mb-xl mt-lg">
        <nav
          aria-label={t("web.nav.feedNavigation")}
          className="-mx-lg flex gap-sm overflow-x-auto px-lg pb-xs md:mx-0 md:flex-wrap md:px-0"
        >
          {moods.map((m) => (
            <Chip
              key={m.key}
              href={homeHref(lang, m.key)}
              onClick={() => choose(m.key)}
              selected={mood === m.key}
              label={t(`home.moods.${m.key}`, { amount: formatPrice(UNDER_50_MINOR, "ILS") })}
            />
          ))}
        </nav>
      </div>
      <InfiniteItemGrid
        endpoint={endpoint}
        kind="feed"
        firstPage={mood === initialMood ? firstPage : null}
        empty={<EmptyState title={empty.title} message={empty.message} />}
      />
    </>
  );
}
