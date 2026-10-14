"use client";

import { favouriteResultSchema, formatPrice, type ListingCard } from "@vinty/shared";
import { Bookmark, Check, ChevronLeft, ChevronRight, TrendingDown, Zap } from "lucide-react";
import Link from "next/link";
import { type MouseEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { useLoginPrompt } from "@/components/login-prompt";
import { CoveredLine } from "@/components/price-pill";
import { useConditionName, useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * The item card, the price tag on photo card (D-032, the same as the app): a 3:4 photo with 12px corners. On the
 * photo: the status badge top-start, the save bookmark in a white circle top-end and the seller price on a small white
 * paper tag bottom-start (a price drop shows the muted struck old price inside the tag). Below: the title on one line,
 * size and condition, and the Coverage buyer price as a tiny muted line. The whole card opens `/[lang]/item/[id]`.
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
  priority = false,
}: {
  listing: ListingCard;
  /** The first cards of a grid are in view when the page opens, so their photos load at once instead of lazily. */
  priority?: boolean;
  /** The sell form's live preview: the same card, but not a link and with no bookmark. */
  preview?: boolean;
  /** Set where the cards are known to be the viewer's own (for example their own profile). */
  hideSave?: boolean;
  saveOnSold?: boolean;
  /** Set on the Home feed: the card's place in the list. It then counts as seen after a second,  */
  feedPosition?: number;
}) {
  const { t, i18n } = useTranslation();
  const viewer = useViewer();
  const conditionName = useConditionName();
  const { ask } = useLoginPrompt();
  const [favourited, setFavourited] = useState(listing.isFavourited ?? false);
  useEffect(() => setFavourited(listing.isFavourited ?? false), [listing.isFavourited]);
  const photos = listing.photos && listing.photos.length > 1 ? listing.photos : null;
  const [photoIndex, setPhotoIndex] = useState(0);
  // The slot of a photo is rendered only once it was shown, so later photos load lazily.
  const [seen, setSeen] = useState(1);
  const showArrows = !preview && photos !== null;
  const goTo = (e: MouseEvent, next: number) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoIndex(next);
    setSeen((s) => Math.max(s, next + 1));
  };

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
      <div className="pointer-events-none relative aspect-[3/4] overflow-hidden rounded-control bg-pressed">
        {showArrows && photos ? (
          photos.slice(0, seen).map((p, i) => (
            // biome-ignore lint/performance/noImgElement: no Vercel image optimisation on purpose, the card photos come ready sized
            <img
              key={p.url}
              src={p.url}
              width={p.width}
              height={p.height}
              alt={i === photoIndex ? listing.title : ""}
              loading={i === 0 && priority ? "eager" : "lazy"}
              fetchPriority={i === 0 && priority ? "high" : undefined}
              decoding="async"
              className={cn("absolute inset-0 h-full w-full object-cover", i === photoIndex ? "" : "hidden")}
            />
          ))
        ) : listing.cover ? (
          // biome-ignore lint/performance/noImgElement: no Vercel image optimisation on purpose, the card cover comes ready sized
          <img
            src={listing.cover.url}
            width={listing.cover.width}
            height={listing.cover.height}
            alt={listing.title}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
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
            className="pointer-events-auto absolute end-sm top-sm z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background hover:bg-pressed"
          >
            <Bookmark
              size={18}
              aria-hidden
              className={favourited ? "text-primary" : "text-text-1"}
              fill={favourited ? "currentColor" : "none"}
            />
          </button>
        ) : null}
        {showArrows && photos ? (
          <>
            {photoIndex > 0 ? (
              <button
                type="button"
                onClick={(e) => goTo(e, photoIndex - 1)}
                aria-label={t("web.item.previousPhoto")}
                className="pointer-events-auto absolute start-sm top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background text-text-1 opacity-0 transition-opacity hover:bg-pressed focus-visible:opacity-100 group-hover:opacity-100"
              >
                <ChevronLeft size={18} aria-hidden className="rtl:-scale-x-100" />
              </button>
            ) : null}
            {photoIndex < photos.length - 1 ? (
              <button
                type="button"
                onClick={(e) => goTo(e, photoIndex + 1)}
                aria-label={t("web.item.nextPhoto")}
                className="pointer-events-auto absolute end-sm top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background text-text-1 opacity-0 transition-opacity hover:bg-pressed focus-visible:opacity-100 group-hover:opacity-100"
              >
                <ChevronRight size={18} aria-hidden className="rtl:-scale-x-100" />
              </button>
            ) : null}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-[3px] flex justify-center gap-xs opacity-0 transition-opacity group-hover:opacity-100"
            >
              {photos.map((p, i) => (
                <span
                  key={p.url}
                  className={cn(
                    "h-[5px] w-[5px] rounded-full",
                    i === photoIndex ? "bg-background" : "bg-background/50",
                  )}
                />
              ))}
            </div>
          </>
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
