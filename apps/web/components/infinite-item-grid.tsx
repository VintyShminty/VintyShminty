"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { feedPageSchema, homeFeedPageSchema, type ListingCard, searchPageSchema } from "@vinty/shared";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ZodType } from "zod";
import { ItemGrid, ItemGridSkeleton } from "@/components/item-grid";
import { clientApi } from "@/lib/api-client";
import { FEED_PAGE_SIZE, pagePath } from "@/lib/feed-url";

type Page = { items: ListingCard[]; nextCursor: string | null };

const SCHEMAS = { feed: homeFeedPageSchema, listings: searchPageSchema, plain: feedPageSchema } as const;

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
 * A new `endpoint` is a new list, so give the component `key={endpoint}` where it can change without a reload.
 * Cached cards stay on screen while a page loads (never blank), and errors show Try again.
 */
export function InfiniteItemGrid({
  endpoint,
  kind,
  firstPage,
  empty,
  hideHearts,
  heartOnSold,
}: {
  endpoint: string;
  kind: keyof typeof SCHEMAS;
  firstPage: Page | null;
  empty: ReactNode;
  hideHearts?: boolean;
  heartOnSold?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const query = useInfiniteQuery({
    queryKey: ["grid", kind, endpoint, i18n.language],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }): Promise<Page> =>
      clientApi(pagePath(endpoint, pageParam, FEED_PAGE_SIZE), {
        schema: SCHEMAS[kind] as unknown as ZodType<Page>,
        lang: i18n.language,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
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
      <ItemGrid items={items} hideHearts={hideHearts} heartOnSold={heartOnSold} />
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
