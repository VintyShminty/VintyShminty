"use client";

import { type ConversationDetail, formatPrice } from "@vinty/shared";
import { Check, ChevronRight, Clock, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { PricePill } from "@/components/price-pill";
import { SellerAvatar } from "@/components/seller-avatar";
import { StarRating } from "@/components/star-rating";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

/** The item pinned under the chat header: photo, title, price, what the buyer pays. A click opens the item. */
export function ItemStrip({ lang, listing }: { lang: string; listing: ConversationDetail["listing"] }) {
  const { t } = useTranslation();
  const sold = listing.status === "sold";
  return (
    <Link
      href={`/${lang}/item/${listing.id}`}
      aria-label={`${t("chat.openItem")}: ${listing.title}`}
      className="flex items-center gap-md border-y border-border-subtle bg-surface px-lg py-sm hover:bg-pressed"
    >
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-control bg-pressed">
        {listing.photoUrl ? (
          // biome-ignore lint/performance/noImgElement: a small thumbnail, no image optimisation on purpose
          <img src={listing.photoUrl} alt="" width={48} height={48} className="h-full w-full object-cover" />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-body font-semibold text-text-1">{listing.title}</span>
        <span className="flex flex-wrap items-center gap-x-sm gap-y-xs">
          <span className={cn("text-body-sm font-bold", sold ? "text-text-4 line-through" : "text-primary")}>
            {formatPrice(listing.priceMinor, listing.currency)}
          </span>
          {sold ? null : <PricePill amountMinor={listing.buyerPriceMinor} currency={listing.currency} />}
        </span>
      </span>
      {listing.status === "sold" ? (
        <Badge variant="success" icon={Check} label={t("listing.sold")} />
      ) : listing.status === "reserved" ? (
        <Badge variant="warning" icon={Clock} label={t("listing.reserved")} />
      ) : null}
      <ChevronRight size={18} className="shrink-0 text-text-3 rtl:rotate-180" aria-hidden />
    </Link>
  );
}

/** The other person's card at the very top of a chat: who they are, where, when they were last around. */
export function IntroCard({ lang, person }: { lang: string; person: ConversationDetail["otherUser"] }) {
  const { t } = useTranslation();
  const name = person.username ?? t("profile.closedAccount");
  const body = (
    <>
      <SellerAvatar url={person.avatarUrl} name={name} size={64} />
      <span className="text-heading font-semibold text-text-1">{name}</span>
      {person.reviewCount > 0 ? (
        <span className="flex items-center gap-sm">
          <StarRating rating={person.ratingAverage} label={`${person.ratingAverage?.toFixed(1) ?? 0} / 5`} />
          <span className="text-card-meta text-text-3">
            {t("profile.reviewCount", { count: person.reviewCount })}
          </span>
        </span>
      ) : (
        <span className="text-card-meta text-text-3">{t("item.noReviews")}</span>
      )}
      {person.city ? (
        <span className="flex items-center gap-xs text-body-sm text-text-2">
          <MapPin size={13} className="text-text-3" aria-hidden />
          {person.city}
        </span>
      ) : null}
      {person.lastSeenAt ? (
        <span className="text-card-meta text-text-3">
          {t("profile.about.lastSeen", { when: timeAgo(person.lastSeenAt, t) })}
        </span>
      ) : null}
    </>
  );
  const classes =
    "mx-auto my-lg flex w-full max-w-[320px] flex-col items-center gap-sm rounded-window border border-border-subtle bg-surface p-lg";
  return person.username ? (
    <Link
      href={`/${lang}/seller/${person.id}`}
      aria-label={t("chat.openProfile", { name })}
      className={classes}
    >
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

/** Three quiet dots in a bubble: the other person is typing. They hold still for people who ask for less motion. */
export function TypingDots({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <div className="px-lg pt-md">
      <div
        role="status"
        aria-label={t("chat.typing", { name })}
        className="flex w-fit items-center gap-xs rounded-window rounded-es-[6px] border border-border-subtle bg-background px-md py-md"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{ animationDelay: `${i * 160}ms` }}
            className="h-2 w-2 animate-pulse rounded-full bg-text-3 motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}

/** A photo from the chat at full size, in the browser's own modal dialog (Escape or a click outside closes it). */
export function usePhotoViewer(): [open: (url: string) => void, viewer: React.ReactElement] {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const open = (url: string) => {
    if (image.current) image.current.src = url;
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  };
  const viewer = (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click only closes on the dim area, Escape already closes the dialog natively
    <dialog
      ref={dialog}
      aria-label={t("chat.photo")}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close();
      }}
      className="m-auto max-h-[92dvh] max-w-[92vw] overflow-visible border-0 bg-transparent p-0 backdrop:bg-backdrop"
    >
      {/* biome-ignore lint/performance/noImgElement: the full size photo from storage */}
      <img
        ref={image}
        alt={t("chat.photo")}
        className="max-h-[88dvh] max-w-[92vw] rounded-control object-contain"
      />
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={() => dialog.current?.close()}
        className="absolute -top-md end-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background text-text-1 hover:bg-pressed"
      >
        <X size={20} aria-hidden />
      </button>
    </dialog>
  );
  return [open, viewer];
}
