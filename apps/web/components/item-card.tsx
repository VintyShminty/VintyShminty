"use client";

import { type FeedCard, favouriteResultSchema, formatPrice, type ListingCard } from "@vinty/shared";
import { Check, Heart, TrendingDown, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { FeedMenu } from "@/components/feed-menu";
import { useLoginPrompt } from "@/components/login-prompt";
import { PricePill } from "@/components/price-pill";
import { useConditionName, useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * The item card, the price tag card of D-019, the same as the app: a 3:4 photo with 12px corners and the badge at
 * the bottom start, then the seller price big with the heart at the end of that row, BRAND · SIZE · CONDITION in
 * small capitals, and the buyer price pill. The whole card opens `/[lang]/item/[id]`.
 *
 * The heart: logged out it opens the login prompt. Logged in it calls PUT/DELETE /v1/listings/:id/favourite, changes
 * at once and goes back if the server says no. Never shown on your own items, and sold items have none unless
 * `heartOnSold` (the Favourites page, so a sold item can be taken off the list).
 * Used by the Home feed, Browse, Search and seller pages through `ItemGrid`.
 */
export function ItemCard({
  listing,
  hideHeart = false,
  heartOnSold = false,
  feedPosition,
  preview = false,
}: {
  listing: ListingCard;
  /** The sell form's live preview: the same card, but not a link and with no heart. */
  preview?: boolean;
  /** Set where the cards are known to be the viewer's own (for example their own profile). */
  hideHeart?: boolean;
  heartOnSold?: boolean;
  /** Set on the Home feed: the card's place in the list. It then counts as seen after a second, and logged in people get the "..." menu (Why you see this, Not interested). */
  feedPosition?: number;
}) {
  const { t, i18n } = useTranslation();
  const viewer = useViewer();
  const conditionName = useConditionName();
  const { ask } = useLoginPrompt();
  const [favourited, setFavourited] = useState(listing.isFavourited ?? false);
  useEffect(() => setFavourited(listing.isFavourited ?? false), [listing.isFavourited]);

  const sold = listing.status === "sold";
  const priceDrop = listing.previousPriceMinor !== null && listing.previousPriceMinor > listing.priceMinor;
  const percentOff = priceDrop
    ? Math.round((1 - listing.priceMinor / (listing.previousPriceMinor as number)) * 100)
    : 0;
  const isOwn = Boolean(viewer) && listing.seller?.id === viewer?.id;
  const showHeart = !preview && !isOwn && !hideHeart && (!sold || heartOnSold);

  const meta = [listing.brandName ?? listing.title, listing.sizeLabel, conditionName(listing.conditionSlug)]
    .filter(Boolean)
    .join(" · ");

  const onHeart = () => {
    if (!viewer) {
      ask();
      return;
    }
    const next = !favourited;
    setFavourited(next);
    clientApi(`/v1/listings/${listing.id}/favourite`, {
      method: next ? "PUT" : "DELETE",
      schema: favouriteResultSchema,
    }).catch(() => setFavourited(!next));
  };

  return (
    <article
      className="group relative min-w-0"
      data-card-id={feedPosition === undefined ? undefined : listing.id}
      data-position={feedPosition}
    >
      {/* The link covers the whole card. The heart sits above it, so it stays its own button. */}
      {preview ? null : (
        <Link
          href={`/${i18n.language}/item/${listing.id}`}
          // Opening an item page counts a view on the server, so a card scrolling past must not prefetch it.
          prefetch={false}
          aria-label={listing.title}
          className="absolute inset-0 z-0 rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
      )}
      <div className="relative aspect-[3/4] overflow-hidden rounded-control bg-pressed">
        {listing.cover ? (
          // biome-ignore lint/performance/noImgElement: no Vercel image optimisation on purpose, the card cover comes ready sized
          <img
            src={listing.cover.url}
            width={listing.cover.width}
            height={listing.cover.height}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : null}
        {sold ? <div className="absolute inset-0 bg-background opacity-60" /> : null}
        <div className="absolute bottom-sm start-sm">
          {sold ? (
            <Badge variant="success" icon={Check} label={t("listing.sold")} />
          ) : priceDrop ? (
            <Badge variant="accent" icon={TrendingDown} label={t("listing.priceDrop")} />
          ) : listing.isBumped ? (
            <Badge variant="accent" icon={Zap} label={t("listing.bumped")} />
          ) : null}
        </div>
      </div>
      {feedPosition !== undefined && viewer && !isOwn ? <FeedMenu card={listing as FeedCard} /> : null}
      <div className="flex flex-col gap-px pt-sm">
        <div className="flex min-h-7 items-center gap-xs">
          <span
            className={cn(
              "flex-1 truncate text-start text-[20px] font-bold leading-[24px] tracking-tight",
              sold ? "text-text-4 line-through" : "text-primary",
            )}
          >
            {formatPrice(listing.priceMinor, listing.currency)}
          </span>
          {showHeart ? (
            <button
              type="button"
              onClick={onHeart}
              aria-label={favourited ? t("browse.unfavourite") : t("browse.favourite")}
              aria-pressed={favourited}
              className="relative z-10 -me-1 flex h-8 w-8 items-center justify-center rounded-full hover:bg-pressed"
            >
              <Heart
                size={20}
                aria-hidden
                className={favourited ? "text-error" : "text-text-1"}
                fill={favourited ? "currentColor" : "none"}
              />
            </button>
          ) : null}
        </div>
        {meta ? (
          <span className="truncate text-card-meta font-semibold uppercase tracking-wide text-text-3">
            {meta}
          </span>
        ) : null}
        {priceDrop && !sold ? (
          <span className="text-card-meta text-text-3">
            {t("listing.was", { price: formatPrice(listing.previousPriceMinor as number, listing.currency) })}
            {` · ${t("listing.percentOff", { percent: percentOff })}`}
          </span>
        ) : null}
        <PricePill
          className="mt-xs self-start"
          amountMinor={listing.buyerPriceMinor}
          currency={listing.currency}
          muted={sold}
        />
      </div>
    </article>
  );
}

/** One card's loading placeholder: a photo block and three short lines. */
export function ItemCardSkeleton() {
  return (
    <div aria-hidden className="min-w-0">
      <div className="aspect-[3/4] rounded-control bg-pressed" />
      <div className="flex flex-col gap-xs pt-sm">
        <div className="h-3 w-2/3 rounded-full bg-pressed" />
        <div className="h-3 w-1/2 rounded-full bg-surface" />
        <div className="h-3 w-1/3 rounded-full bg-pressed" />
      </div>
    </div>
  );
}
