"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { formatPrice, type MyListingCard, type MyListingsPage, myListingsPageSchema } from "@vinty/shared";
import { Check, Clock, EyeOff, Pencil, TrendingDown, Zap } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { GRID_CLASSES, ItemGridSkeleton } from "@/components/item-grid";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * Your own card (the app's "mini dashboard"): the photo with a state badge, then the price, views and hearts first. A
 * draft shows its title instead and opens the sell form to finish it.
 */
function OwnCard({ listing, lang }: { listing: MyListingCard; lang: string }) {
  const { t } = useTranslation();
  const sold = listing.status === "sold";
  const draft = listing.status === "draft";
  const priceDrop =
    listing.previousPriceMinor !== null &&
    listing.priceMinor !== null &&
    listing.previousPriceMinor > listing.priceMinor;
  const badge =
    listing.status === "sold" ? (
      <Badge variant="success" icon={Check} label={t("listing.sold")} />
    ) : listing.status === "reserved" ? (
      <Badge variant="warning" icon={Clock} label={t("listing.reserved")} />
    ) : listing.status === "hidden" ? (
      <Badge variant="neutral" icon={EyeOff} label={t("listing.hidden")} />
    ) : draft ? (
      <Badge variant="neutral" icon={Pencil} label={t("listing.draft")} />
    ) : listing.isBumped ? (
      <Badge variant="accent" icon={Zap} label={t("listing.bumped")} />
    ) : priceDrop ? (
      <Badge variant="accent" icon={TrendingDown} label={t("listing.priceDrop")} />
    ) : null;

  const title = listing.title || t("listing.untitled");
  const body = (
    <>
      <div className="relative aspect-[3/4] overflow-hidden rounded-control bg-pressed">
        {listing.cover ? (
          // biome-ignore lint/performance/noImgElement: no Vercel image optimisation on purpose, the card cover comes ready sized
          <img
            src={listing.cover.url}
            width={listing.cover.width}
            height={listing.cover.height}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : null}
        {sold || listing.status === "hidden" ? (
          <div className="absolute inset-0 bg-background opacity-60" />
        ) : null}
        {badge ? <div className="absolute bottom-sm start-sm">{badge}</div> : null}
      </div>
      <div className="flex flex-col gap-px pt-sm">
        <span
          className={cn(
            "truncate text-start text-[20px] font-bold leading-[24px] tracking-tight",
            sold ? "text-text-4 line-through" : "text-primary",
          )}
        >
          {listing.priceMinor === null
            ? t("listing.noPrice")
            : formatPrice(listing.priceMinor, listing.currency)}
        </span>
        {draft ? (
          <span className="line-clamp-2 text-card-desc text-text-2">{title}</span>
        ) : (
          <>
            <span className="text-card-meta text-text-3">
              {t("listing.views", { count: listing.viewCount })}
            </span>
            <span className="text-card-meta text-text-3">
              {t("listing.favourites", { count: listing.favouriteCount })}
            </span>
          </>
        )}
      </div>
    </>
  );
  return (
    <Link
      href={draft ? `/${lang}/sell/${listing.id}` : `/${lang}/item/${listing.id}`}
      prefetch={false}
      aria-label={title}
      className="min-w-0"
    >
      {body}
    </Link>
  );
}

/** Your listings in one state (the chips above choose it). The first page comes from the server, more load on scroll. */
export function OwnListings({
  lang,
  status,
  firstPage,
  empty,
}: {
  lang: string;
  status: string;
  firstPage: MyListingsPage | null;
  empty: ReactNode;
}) {
  const { t } = useTranslation();
  const query = useInfiniteQuery({
    queryKey: ["my-listings", status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }): Promise<MyListingsPage> =>
      clientApi(
        `/v1/me/listings?status=${status}&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        { schema: myListingsPageSchema },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: firstPage ? { pages: [firstPage], pageParams: [undefined] } : undefined,
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

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
      <div className={GRID_CLASSES}>
        {items.map((listing) => (
          <OwnCard key={listing.id} listing={listing} lang={lang} />
        ))}
      </div>
      {hasNextPage ? (
        <div ref={sentinel} className="py-xl text-center text-body-sm text-text-3" aria-live="polite">
          {isFetchingNextPage ? t("web.feed.loadingMore") : null}
        </div>
      ) : null}
    </>
  );
}
