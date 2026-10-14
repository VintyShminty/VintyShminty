"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ItemGrid, ItemGridSkeleton } from "@/components/item-grid";
import { useViewer } from "@/components/site-context";
import { type GridKind, type GridPage, gridQueryOptions } from "@/lib/grid-query";
import { useImpressions } from "@/lib/use-impressions";

type Page = GridPage;

/**
 * A grid of item cards that keeps loading as the visitor scrolls (TanStack `useInfiniteQuery` and an
 * IntersectionObserver near the bottom). The first page comes from the server page, so it is in the HTML for Google.
 *
 * - `endpoint` is the address without paging, for example `/v1/feed?mood=new_today` or `/v1/listings?categoryId=..`.
 *   Paging (`limit`, `cursor`) is added here. The cursor keeps the order, so a card never repeats.
 * - `kind` picks how the answer is read: `feed` for `/v1/feed`, `listings` for `/v1/listings`, `plain` for a page
 *   of cards without a total (`/v1/users/:id/listings`).
 * - `firstPage` is that endpoint's first page as the server got it (`null` if the server could not, the browser then
 *   asks itself).
 * - `empty` is shown when there are no items at all.
 * A new `endpoint` is a new list. The old cards stay on screen, dimmed, until the new ones arrive (never blank).
 * Errors show Try again.
 */
export function InfiniteItemGrid({
  endpoint,
  kind,
  firstPage,
  empty,
  hideSaves,
  saveOnSold,
}: {
  endpoint: string;
  kind: GridKind;
  firstPage: Page | null;
  empty: ReactNode;
  hideSaves?: boolean;
  saveOnSold?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const query = useInfiniteQuery({
    ...gridQueryOptions(kind, endpoint, i18n.language),
    initialData: firstPage ? { pages: [firstPage], pageParams: [undefined] } : undefined,
  });

  // A card never shows twice, even if two pages overlap.
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages.flatMap((p) => p.items) ?? []).filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [query.data]);

  // Home counts a card as seen after a second half in view (the same signal as the app), for logged in people.
  const viewer = useViewer();
  const gridBox = useRef<HTMLDivElement>(null);
  const feedId = (query.data?.pages[0] as { feedId?: string | null } | undefined)?.feedId ?? null;
  useImpressions(gridBox, kind === "feed" && Boolean(viewer), feedId, items.length);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (query.isPending) {
    return (
      <div role="status" aria-label={t("web.feed.loading")}>
        <ItemGridSkeleton />
      </div>
    );
  }
  if (query.isError && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-md py-2xl text-center">
        <p className="text-heading text-text-1">{t("errors.general")}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="inline-flex h-10 items-center rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint"
        >
          {t("common.tryAgain")}
        </button>
      </div>
    );
  }
  if (items.length === 0) return <>{empty}</>;

  return (
    <>
      <div
        ref={gridBox}
        aria-busy={query.isPlaceholderData}
        className={query.isPlaceholderData ? "opacity-50 transition-opacity" : "transition-opacity"}
      >
        <ItemGrid items={items} hideSaves={hideSaves} saveOnSold={saveOnSold} feed={kind === "feed"} />
      </div>
      {hasNextPage ? (
        <div ref={sentinel} className="py-xl text-center text-body-sm text-text-3" aria-live="polite">
          {isFetchingNextPage ? t("web.feed.loadingMore") : null}
        </div>
      ) : null}
      {query.isError ? (
        <div className="flex justify-center py-lg">
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            className="inline-flex h-10 items-center rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint"
          >
            {t("common.tryAgain")}
          </button>
        </div>
      ) : null}
    </>
  );
}
