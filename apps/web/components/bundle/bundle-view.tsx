"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { type Bundle, bundleSavedMinor, feedPageSchema, formatPrice, type ListingCard } from "@vinty/shared";
import { Check, ChevronLeft, Loader2, Percent } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/empty-state";
import { clientApi } from "@/lib/api-client";
import { pagePath } from "@/lib/feed-url";
import { bundleQuery, useOpenBundle, useToggleBundleItem } from "@/lib/order-flow-queries";
import { useLoadMore } from "@/lib/use-load-more";
import { cn } from "@/lib/utils";

/** Fewest items that make a bundle. */
const MIN_ITEMS = 2;

function PickCard({
  listing,
  selected,
  busy,
  onToggle,
}: {
  listing: ListingCard;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={selected}
      aria-label={t(selected ? "web.bundle.remove" : "web.bundle.add", { title: listing.title })}
      className="group flex w-full flex-col text-start disabled:opacity-70"
    >
      <span
        className={cn(
          "relative block aspect-[3/4] overflow-hidden rounded-control border-2 bg-pressed",
          selected ? "border-primary" : "border-transparent group-hover:border-border",
        )}
      >
        {listing.cover ? (
          // biome-ignore lint/performance/noImgElement: a listing cover that comes ready sized, no image optimisation on purpose
          <img
            src={listing.cover.url}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <span
          aria-hidden
          className={cn(
            "absolute end-sm top-sm flex h-6 w-6 items-center justify-center rounded-[8px] border",
            selected ? "border-primary bg-primary text-on-accent" : "border-border bg-background",
          )}
        >
          {selected ? <Check size={16} strokeWidth={3} /> : null}
        </span>
      </span>
      <span className="mt-sm flex flex-col gap-px">
        <span className="truncate text-card-brand font-semibold text-text-1">
          {listing.brandName ?? listing.title}
        </span>
        <span className="truncate text-card-desc text-text-3">{listing.title}</span>
        <span className="text-body-sm font-bold text-primary">
          {formatPrice(listing.priceMinor, listing.currency)}
        </span>
      </span>
    </button>
  );
}

/** The steps as a bar that fills as items are picked. Each step has a mark with its item count and discount. */
function StepsBar({ bundle }: { bundle: Bundle }) {
  const { t } = useTranslation();
  const top = Math.max(...bundle.tiers.map((x) => x.minItems), MIN_ITEMS);
  const fill = Math.min(100, (bundle.itemCount / top) * 100);
  return (
    <div className="mt-md pb-[44px]">
      <div
        role="progressbar"
        aria-label={t("bundle.stepsLabel")}
        aria-valuemin={0}
        aria-valuemax={top}
        aria-valuenow={Math.min(bundle.itemCount, top)}
        className="relative h-2 rounded-full bg-pressed"
      >
        <div
          className="absolute inset-y-0 start-0 rounded-full bg-primary transition-[width]"
          style={{ width: `${fill}%` }}
        />
        {bundle.tiers.map((tier) => {
          const lit = bundle.itemCount >= tier.minItems;
          return (
            <span
              key={tier.minItems}
              className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center rtl:translate-x-1/2 ltr:-translate-x-1/2"
              style={{ insetInlineStart: `${(tier.minItems / top) * 100}%` }}
            >
              <span
                className={cn(
                  "h-4 w-4 rounded-full border-2",
                  lit ? "border-primary bg-primary" : "border-border bg-background",
                )}
              />
              <span className="mt-xs whitespace-nowrap text-card-meta font-semibold text-text-1">
                {t("bundle.stepOff", { percent: tier.percentOff })}
              </span>
              <span className="whitespace-nowrap text-card-meta text-text-3">
                {t("bundle.stepItems", { count: tier.minItems })}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The bundle page (the app's bundle screen): pick several items from one seller, watch the discount grow, then go to
 * checkout with the bundle. The bundle lives on the server, so every click adds or removes one item and the totals
 * (and the tiers) come back from there.
 */
export function BundleView({ lang, sellerId }: { lang: string; sellerId: string }) {
  const { t } = useTranslation();
  const open = useOpenBundle();
  const toggle = useToggleBundleItem();
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    open.mutate(sellerId, { onSuccess: (b) => setBundleId(b.id) });
  }, [sellerId, open]);

  const bundle = useQuery({ ...bundleQuery(bundleId ?? ""), enabled: bundleId !== null });
  const endpoint = `/v1/users/${encodeURIComponent(sellerId)}/listings?status=active`;
  const listings = useInfiniteQuery({
    queryKey: ["grid", "plain", endpoint, lang, "bundle"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      clientApi(pagePath(endpoint, pageParam, 24), { schema: feedPageSchema, lang }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const more = useLoadMore(
    Boolean(listings.hasNextPage),
    listings.isFetchingNextPage,
    () => void listings.fetchNextPage(),
  );
  const items = useMemo(() => listings.data?.pages.flatMap((p) => p.items) ?? [], [listings.data]);
  const b = bundle.data;
  const live = useMemo(
    () => (b?.items ?? []).filter((i) => i.status === "active" || i.status === "reserved"),
    [b],
  );
  const chosen = useMemo(() => new Set(live.map((i) => i.listingId)), [live]);

  const flip = (listing: ListingCard) => {
    if (!bundleId || busyId) return;
    setBusyId(listing.id);
    setFailed(false);
    toggle.mutate(
      { bundleId, listingId: listing.id, add: !chosen.has(listing.id) },
      { onError: () => setFailed(true), onSettled: () => setBusyId(null) },
    );
  };

  const count = b?.itemCount ?? 0;
  let tierLine = t("bundle.pickMore", { count: MIN_ITEMS });
  if (b) {
    if (b.discountPercent > 0 && b.nextTier) {
      tierLine = t("bundle.tierNext", {
        percent: b.discountPercent,
        count: b.nextTier.addItems,
        next: b.nextTier.percentOff,
      });
    } else if (b.discountPercent > 0) {
      tierLine = t("bundle.tierTop", { percent: b.discountPercent });
    } else if (b.nextTier) {
      tierLine = t("bundle.addMore", { count: b.nextTier.addItems, percent: b.nextTier.percentOff });
    }
  }
  const saved = b ? bundleSavedMinor(b) : 0;
  const sold = (b?.items ?? []).filter((i) => i.status === "sold");
  const sellerName = b?.seller.username ?? t("profile.closedAccount");

  const spinner = (
    <div className="flex justify-center py-2xl" role="status" aria-label={t("web.inbox.loading")}>
      <Loader2 size={28} className="animate-spin text-text-3 motion-reduce:animate-none" aria-hidden />
    </div>
  );

  if (open.isError) {
    return (
      <main className="mx-auto w-full max-w-[1000px] px-lg pb-2xl pt-xl md:px-xl">
        <EmptyState
          title={t("bundle.openFailed")}
          action={
            <button
              type="button"
              onClick={() => open.mutate(sellerId, { onSuccess: (x) => setBundleId(x.id) })}
              className="inline-flex h-11 items-center rounded-control border border-border px-lg text-body-sm font-semibold text-text-1 hover:bg-pressed"
            >
              {t("common.tryAgain")}
            </button>
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-lg pb-2xl pt-lg md:px-xl">
      <Link
        href={`/${lang}/seller/${sellerId}`}
        className="mb-md inline-flex h-10 items-center gap-xs text-body-sm font-semibold text-primary hover:underline"
      >
        <ChevronLeft size={18} aria-hidden className="rtl:-scale-x-100" />
        {b ? t("web.bundle.backTo", { name: sellerName }) : t("bundle.title")}
      </Link>
      <h1 className="text-title font-bold text-text-1">{t("bundle.title")}</h1>

      <div className="mt-lg grid gap-2xl md:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <p
            role="status"
            className="flex items-center gap-sm rounded-control border border-border bg-accent-tint p-md text-body-sm font-semibold text-primary"
          >
            <Percent size={18} aria-hidden className="shrink-0" />
            {tierLine}
          </p>
          {b && b.tiers.length > 0 ? <StepsBar bundle={b} /> : null}
          {failed ? (
            <p
              role="alert"
              className="mt-sm rounded-control bg-error-tint px-md py-md text-body-sm text-error"
            >
              {t("bundle.changeFailed")}
            </p>
          ) : null}

          {listings.isPending || !b ? (
            spinner
          ) : items.length === 0 ? (
            <EmptyState title={t("profile.noListings")} />
          ) : (
            <>
              <ul className="mt-lg grid grid-cols-2 gap-x-md gap-y-lg sm:grid-cols-3">
                {items.map((listing) => (
                  <li key={listing.id}>
                    <PickCard
                      listing={listing}
                      selected={chosen.has(listing.id)}
                      busy={busyId === listing.id}
                      onToggle={() => flip(listing)}
                    />
                  </li>
                ))}
              </ul>
              <div ref={more} aria-hidden className="flex h-10 items-center justify-center">
                {listings.isFetchingNextPage ? (
                  <Loader2
                    size={18}
                    className="animate-spin text-text-3 motion-reduce:animate-none"
                    aria-hidden
                  />
                ) : null}
              </div>
            </>
          )}
        </div>

        <aside className="md:sticky md:top-28 md:self-start">
          {b ? (
            <section
              aria-label={t("web.bundle.summary")}
              className="flex flex-col gap-md rounded-window border border-border-subtle p-lg"
            >
              <h2 className="text-section-label font-bold uppercase text-text-3">
                {t("web.bundle.summary")}
              </h2>
              <p className="text-body-sm text-text-2">{t("bundle.selected", { count })}</p>
              {live.length > 0 ? (
                <ul className="flex flex-col gap-sm">
                  {live.map((i) => (
                    <li key={i.listingId} className="flex items-center justify-between gap-md text-body-sm">
                      <span className="truncate text-text-1">{i.title}</span>
                      <span className="shrink-0 font-medium text-text-1">
                        {formatPrice(i.priceMinor, b.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {sold.length > 0 ? (
                <ul className="flex flex-col gap-xs">
                  {sold.map((i) => (
                    <li key={i.listingId} className="text-card-desc text-text-4">
                      <span className="line-through">{i.title}</span> · {t("bundle.soldRemoved")}
                    </li>
                  ))}
                </ul>
              ) : null}
              <dl className="flex flex-col gap-sm border-t border-border-subtle pt-md">
                <div className="flex items-center justify-between gap-md text-body-sm">
                  <dt className="text-text-2">{t("orders.itemsSubtotal")}</dt>
                  <dd className="font-medium text-text-1">{formatPrice(b.subtotalMinor, b.currency)}</dd>
                </div>
                {b.discountMinor > 0 ? (
                  <div className="flex items-center justify-between gap-md text-body-sm">
                    <dt className="text-text-2">
                      {t("bundle.discountLine", { percent: b.discountPercent })}
                    </dt>
                    <dd dir="ltr" className="font-medium text-success">
                      -{formatPrice(b.discountMinor, b.currency)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-md text-body font-bold text-text-1">
                  <dt>{t("web.bundle.itemsTotal")}</dt>
                  <dd>{formatPrice(b.netMinor, b.currency)}</dd>
                </div>
                {b.postageTogetherMinor > 0 && count > 0 ? (
                  <div className="flex items-center justify-between gap-md text-body-sm">
                    <dt className="text-text-2">{t("bundle.postageOne")}</dt>
                    <dd className="flex items-baseline gap-sm font-medium text-text-1">
                      {b.postageSeparateMinor > b.postageTogetherMinor ? (
                        <s className="text-text-4">{formatPrice(b.postageSeparateMinor, b.currency)}</s>
                      ) : null}
                      {formatPrice(b.postageTogetherMinor, b.currency)}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {saved > 0 ? (
                <p
                  role="status"
                  className="rounded-control bg-success-tint px-md py-sm text-body-sm font-semibold text-success"
                >
                  {t("bundle.saveLine", { amount: formatPrice(saved, b.currency) })}
                </p>
              ) : null}
              {count < MIN_ITEMS || busyId !== null ? (
                <span
                  aria-disabled="true"
                  className="inline-flex h-12 w-full items-center justify-center rounded-control bg-primary px-lg text-body font-semibold text-on-accent opacity-40"
                >
                  {count < MIN_ITEMS ? t("bundle.pickMore", { count: MIN_ITEMS }) : t("bundle.continue")}
                </span>
              ) : (
                <Link
                  href={`/${lang}/checkout?bundle=${b.id}`}
                  className="inline-flex h-12 w-full items-center justify-center rounded-control bg-primary px-lg text-body font-semibold text-on-accent hover:opacity-90"
                >
                  {t("bundle.continue")}
                </Link>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
