"use client";

import { type FeedCard, favouriteResultSchema, formatPrice, type ListingCard } from "@vinty/shared";
import { Bookmark, Check, TrendingDown, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { FeedMenu } from "@/components/feed-menu";
import { useLoginPrompt } from "@/components/login-prompt";
import { CoveredLine } from "@/components/price-pill";
import { useConditionName, useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * The item card, the price tag on photo card (D-032, the same as the app): a 3:4 photo with 12px corners. On the
 * photo: the status badge top-start, the save bookmark in a white circle top-end and the seller price on a small white
 * paper tag bottom-start (a price drop shows the muted struck old price inside the tag). Below: the title on one line,
 * size and condition, and the Covered buyer price as a tiny muted line. The whole card opens `/[lang]/item/[id]`.
 *
 * The bookmark: logged out it opens the login prompt. Logged in it calls PUT/DELETE /v1/listings/:id/favourite,
 * changes at once and goes back if the server says no. Never shown on your own items, and sold items have none unless
 * `saveOnSold` (the Favourites page, so a sold item can be taken off the list).
 * Used by the Home feed, Browse, Search and seller pages through `ItemGrid`.
 */
export function ItemCard({
  listing,
  hideSave = false,
  saveOnSold = false,
  feedPosition,
  preview = false,
}: {
  listing: ListingCard;
  /** The sell form's live preview: the same card, but not a link and with no bookmark. */
  preview?: boolean;
  /** Set where the cards are known to be the viewer's own (for example their own profile). */
  hideSave?: boolean;
  saveOnSold?: boolean;
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
  const isOwn = Boolean(viewer) && listing.seller?.id === viewer?.id;
  const showSave = !preview && !isOwn && !hideSave && (!sold || saveOnSold);

  const meta = [listing.sizeLabel, conditionName(listing.conditionSlug)].filter(Boolean).join(" · ");

  const onSave = () => {
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
      {/* The link covers the whole card. The bookmark sits above it, so it stays its own button. */}
      {preview ? null : (
        <Link
          href={`/${i18n.language}/item/${listing.id}`}
          // Opening an item page counts a view on the server, so a card scrolling past must not prefetch it.
          prefetch={false}
          aria-label={[
            listing.title,
            formatPrice(listing.priceMinor, listing.currency),
            meta,
            favourited && showSave ? t("browse.cardSaved") : "",
          ]
            .filter(Boolean)
            .join(", ")}
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
        <div className="absolute start-sm top-sm">
          {sold ? (
            <Badge variant="success" icon={Check} label={t("listing.sold")} />
          ) : priceDrop ? (
            <Badge variant="accent" icon={TrendingDown} label={t("listing.priceDrop")} />
          ) : listing.isBumped ? (
            <Badge variant="accent" icon={Zap} label={t("listing.bumped")} />
          ) : null}
        </div>
        {showSave ? (
          <button
            type="button"
            onClick={onSave}
            aria-label={favourited ? t("browse.unfavourite") : t("browse.favourite")}
            aria-pressed={favourited}
            className="absolute end-sm top-sm z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background hover:bg-pressed"
          >
            <Bookmark
              size={18}
              aria-hidden
              className={favourited ? "text-primary" : "text-text-1"}
              fill={favourited ? "currentColor" : "none"}
            />
          </button>
        ) : null}
        <div className="absolute bottom-sm start-sm flex max-w-[90%] items-baseline gap-xs rounded-[6px] border border-border-subtle bg-background px-sm py-[3px]">
          {priceDrop && !sold ? (
            <span className="truncate text-card-meta text-text-4 line-through">
              {formatPrice(listing.previousPriceMinor as number, listing.currency)}
            </span>
          ) : null}
          <span
            className={cn(
              "shrink-0 text-[15px] font-semibold leading-[20px]",
              sold ? "text-text-4 line-through" : "text-primary",
            )}
          >
            {formatPrice(listing.priceMinor, listing.currency)}
          </span>
        </div>
      </div>
      {feedPosition !== undefined && viewer && !isOwn ? <FeedMenu card={listing as FeedCard} /> : null}
      <div className="flex flex-col gap-[3px] pt-sm">
        <span className="truncate text-start text-body-sm font-semibold text-text-1">{listing.title}</span>
        {meta ? <span className="truncate text-card-meta text-text-3">{meta}</span> : null}
        <CoveredLine amountMinor={listing.buyerPriceMinor} currency={listing.currency} muted={sold} />
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
