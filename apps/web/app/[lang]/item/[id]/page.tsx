import { formatPrice, type ListingDetail } from "@vinty/shared";
import { Check, Clock, Moon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { FavouriteButton } from "@/components/favourite-button";
import { BuyBar, BuyButtons, MessageChip } from "@/components/item-actions";
import { ItemCard } from "@/components/item-card";
import { ItemDwell } from "@/components/item-dwell";
import { ItemGrid } from "@/components/item-grid";
import { PhotoGallery } from "@/components/photo-gallery";
import { PricePill } from "@/components/price-pill";
import { ReportButton } from "@/components/report-dialog";
import { SellerAvatar } from "@/components/seller-avatar";
import { SellerStamp } from "@/components/seller-stamp";
import { StarRating } from "@/components/star-rating";
import { ApiClientError } from "@/lib/api";
import { hasBuyActions } from "@/lib/buy-actions";
import { getT, isLang, type Lang } from "@/lib/i18n";
import { getListing, getProfile, getSellerItems, getSimilar } from "@/lib/listing-data";
import { alternatesFor } from "@/lib/seo";
import { formatDay, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

type Params = Promise<{ lang: string; id: string }>;

const localName = (name: { en: string; he: string } | null | undefined, lang: Lang) => name?.[lang] ?? "";

function detailsLine(listing: ListingDetail, lang: Lang) {
  return [listing.brand?.name, listing.size?.label, localName(listing.condition?.name, lang)]
    .filter(Boolean)
    .join(" · ");
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLang(lang)) return { title: "Vinty" };
  const t = getT(lang);
  let listing: ListingDetail;
  try {
    listing = await getListing(lang, id);
  } catch (error) {
    // A missing item is Next's own not found page (notFound throws). Any other failure keeps a plain title.
    if (error instanceof ApiClientError) return { title: "Vinty", robots: { index: false } };
    throw error;
  }
  const price = formatPrice(listing.priceMinor ?? 0, listing.currency);
  const title = `${listing.title} · ${price} · Vinty`;
  const description =
    listing.description.trim().replace(/\s+/g, " ").slice(0, 200) ||
    t("web.item.metaFallback", {
      details: [listing.title, detailsLine(listing, lang)].filter(Boolean).join(", "),
    });
  const cover = listing.photos[0] ?? listing.cover;
  const images = cover
    ? [{ url: cover.url, width: cover.width, height: cover.height, alt: listing.title }]
    : undefined;
  const path = `/item/${id}`;
  return {
    title: { absolute: title },
    description,
    alternates: alternatesFor(lang, path),
    robots:
      listing.status === "active" || listing.status === "reserved" || listing.status === "sold"
        ? undefined
        : { index: false },
    // og:type "product" is written in the page itself, Next's own list of types has no product.
    openGraph: {
      title,
      description,
      url: `/${lang}${path}`,
      siteName: "Vinty",
      images,
      locale: lang === "he" ? "he_IL" : "en_US",
    },
    twitter: { card: "summary_large_image", title, description, images: cover ? [cover.url] : undefined },
  };
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-md border-b border-border-subtle py-sm">
      <dt className="w-[40%] shrink-0 text-body-sm text-text-3">{label}</dt>
      <dd className="min-w-0 flex-1 text-body-sm text-text-1">{value}</dd>
    </div>
  );
}

function BreakdownLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-md py-px",
        strong ? "text-body font-bold" : "text-body-sm",
      )}
    >
      <dt className="text-text-1">{label}</dt>
      <dd className="text-text-1">{value}</dd>
    </div>
  );
}

export default async function ItemPage({ params }: { params: Params }) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const t = getT(lang);

  let listing: ListingDetail;
  try {
    listing = await getListing(lang, id);
  } catch (error) {
    if (!(error instanceof ApiClientError)) throw error;
    return (
      <main className="mx-auto max-w-[1400px] px-lg pb-2xl pt-xl md:px-xl">
        <EmptyState
          title={t("web.item.loadFailed")}
          action={
            <Link
              href={`/${lang}/item/${id}`}
              className="inline-flex h-10 items-center rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint"
            >
              {t("common.tryAgain")}
            </Link>
          }
        />
      </main>
    );
  }

  const seller = listing.seller;
  const [profile, sellerItems, similar] = await Promise.all([
    getProfile(lang, seller.id).catch(() => null),
    getSellerItems(lang, seller.id, 12),
    getSimilar(lang, listing.id),
  ]);

  const sold = listing.status === "sold";
  const reserved = listing.status === "reserved";
  const isOwner = listing.viewer.isOwner;
  const price = listing.priceMinor ?? 0;
  const buyerPrice = listing.buyerPriceMinor ?? price;
  const priceDrop = listing.previousPriceMinor !== null && listing.previousPriceMinor > price;
  const percentOff = priceDrop ? Math.round((1 - price / (listing.previousPriceMinor as number)) * 100) : 0;
  const sellerName = seller.username ?? t("profile.closedAccount");
  const showBar = hasBuyActions(listing);
  const moreFromSeller = sellerItems.filter((c) => c.id !== listing.id).slice(0, 10);
  const similarItems = similar.filter((c) => c.id !== listing.id);
  const meta = detailsLine(listing, lang);
  const cover = listing.photos[0] ?? listing.cover;

  const buyProps = {
    listingId: listing.id,
    lang,
    conversationId: listing.viewer.conversationId,
    priceMinor: price,
    reserved,
    canBuy: listing.viewer.canBuy,
    canOffer: listing.viewer.canOffer,
    buyerPriceMinor: buyerPrice,
    currency: listing.currency,
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description || undefined,
    image: listing.photos.map((p) => p.url),
    brand: listing.brand ? { "@type": "Brand", name: listing.brand.name } : undefined,
    offers: {
      "@type": "Offer",
      price: (price / 100).toFixed(2),
      priceCurrency: listing.currency,
      availability: sold || reserved ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
    },
  };

  return (
    <main
      className={cn(
        "mx-auto max-w-[1400px] px-lg pt-lg md:px-xl lg:pt-xl",
        showBar ? "pb-40 lg:pb-2xl" : "pb-2xl",
      )}
    >
      {/* React puts these meta tags into the head. Next has no og:type "product", so it is written here. */}
      <meta property="og:type" content="product" />
      <meta property="product:price:amount" content={(price / 100).toFixed(2)} />
      <meta property="product:price:currency" content={listing.currency} />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: our own JSON, with < escaped so nothing can close the tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <ItemDwell listingId={listing.id} />
      <div className="grid gap-x-2xl gap-y-lg lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <PhotoGallery
            photos={listing.photos.length ? listing.photos : cover ? [cover] : []}
            title={listing.title}
            sold={sold}
          />
        </div>

        {/* The card: it flows under the photos on a phone and stays in view beside them on a laptop (D-030, 4). */}
        <aside aria-label={listing.title} className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="flex flex-col gap-lg lg:sticky lg:top-28 lg:rounded-window lg:border lg:border-border lg:p-xl">
            {sold ? (
              <div className="flex items-center gap-sm">
                <Badge variant="success" icon={Check} label={t("listing.sold")} />
                <p className="flex-1 text-body-sm text-text-3">{t("item.soldNote")}</p>
              </div>
            ) : reserved ? (
              <div className="flex items-center gap-sm">
                <Badge variant="warning" icon={Clock} label={t("listing.reserved")} />
                <p className="flex-1 text-body-sm text-text-3">{t("item.reservedNote")}</p>
              </div>
            ) : null}

            <div className="flex items-start gap-md">
              <div className="min-w-0 flex-1">
                <h1 className="text-[24px] font-bold leading-[28px] text-text-1">{listing.title}</h1>
                {meta ? (
                  <p className="mt-xs text-card-meta font-semibold uppercase tracking-wide text-text-3">
                    {meta}
                  </p>
                ) : null}
              </div>
              {sold || isOwner ? null : (
                <FavouriteButton
                  listingId={listing.id}
                  initial={listing.viewer.isFavourited}
                  count={listing.favouriteCount}
                />
              )}
            </div>

            <div className="flex flex-col gap-xs">
              <p className={cn("text-title font-bold", sold ? "text-text-4 line-through" : "text-primary")}>
                {formatPrice(price, listing.currency)}
              </p>
              {priceDrop && !sold ? (
                <p className="text-body-sm text-text-3">
                  {t("listing.was", {
                    price: formatPrice(listing.previousPriceMinor as number, listing.currency),
                  })}
                  {` · ${t("listing.percentOff", { percent: percentOff })}`}
                </p>
              ) : null}
              <PricePill
                className="mt-xs self-start"
                amountMinor={buyerPrice}
                currency={listing.currency}
                muted={sold}
              />
            </div>

            {sold ? null : (
              <dl aria-label={t("web.item.breakdownLabel")} className="rounded-control bg-accent-tint p-md">
                <BreakdownLine
                  label={t("item.breakdown.item")}
                  value={formatPrice(price, listing.currency)}
                />
                <BreakdownLine
                  label={t("protectionName")}
                  value={formatPrice(Math.max(0, buyerPrice - price), listing.currency)}
                />
                <div className="my-xs h-px bg-border-subtle" />
                <BreakdownLine
                  strong
                  label={t("item.breakdown.total")}
                  value={formatPrice(buyerPrice, listing.currency)}
                />
                <div className="flex items-start gap-xs pt-xs">
                  <Check size={14} aria-hidden className="mt-px shrink-0 text-primary" />
                  <p className="text-card-desc text-text-1">{t("item.breakdown.note")}</p>
                </div>
              </dl>
            )}

            {isOwner ? (
              <div className="rounded-control border border-border-subtle bg-surface p-md">
                <p className="text-body-sm font-semibold text-text-1">{t("web.item.yours")}</p>
                <p className="mt-xs text-body-sm text-text-3">{t("web.item.yoursNote")}</p>
              </div>
            ) : showBar ? (
              <div className="max-lg:hidden">
                <BuyButtons {...buyProps} />
              </div>
            ) : null}

            {listing.sellerOnHoliday ? (
              <div className="flex items-start gap-sm rounded-control border border-warning bg-warning-tint p-md">
                <Moon size={18} aria-hidden className="mt-px shrink-0 text-warning" />
                <p className="flex-1 text-body-sm text-warning">
                  {listing.sellerAwayUntil
                    ? t("item.away", { name: sellerName, date: formatDay(listing.sellerAwayUntil, lang) })
                    : t("item.awayNoDate", { name: sellerName })}
                </p>
              </div>
            ) : null}

            <section
              aria-label={t("item.seller")}
              className="flex flex-col gap-md rounded-control border border-border-subtle p-md"
            >
              <div className="flex items-center gap-md">
                <Link href={`/${lang}/seller/${seller.id}`} className="shrink-0" tabIndex={-1} aria-hidden>
                  <SellerAvatar url={seller.avatarUrl} name={sellerName} size={48} />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-xs">
                  <Link
                    href={`/${lang}/seller/${seller.id}`}
                    className="truncate text-body font-semibold text-text-1 hover:underline"
                  >
                    {sellerName}
                  </Link>
                  {seller.reviewCount > 0 ? (
                    <div className="flex items-center gap-sm">
                      <StarRating
                        rating={seller.ratingAverage}
                        label={t("web.seller.rating", { rating: seller.ratingAverage?.toFixed(1) ?? 0 })}
                      />
                      <span className="text-card-meta text-text-3">
                        {t("profile.reviewCount", { count: seller.reviewCount })}
                      </span>
                    </div>
                  ) : (
                    <span className="text-card-meta text-text-3">{t("item.noReviews")}</span>
                  )}
                </div>
                {isOwner || (sold && !listing.viewer.conversationId) ? null : (
                  <MessageChip sellerName={sellerName} listingId={listing.id} lang={lang} />
                )}
              </div>
              {profile && profile.badges.length > 0 ? (
                <ul className="flex flex-wrap gap-sm">
                  {profile.badges.map((b) => (
                    <li key={b.slug}>
                      <SellerStamp icon={b.icon} label={b.name[lang]} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-xl lg:col-start-1 lg:row-start-2">
          {listing.description ? (
            <section className="flex flex-col gap-xs">
              <h2 className="text-section-label font-semibold uppercase tracking-wide text-text-3">
                {t("listing.description")}
              </h2>
              <p className="whitespace-pre-line text-body text-text-1">{listing.description}</p>
            </section>
          ) : null}

          <section>
            <h2 className="pb-xs text-section-label font-semibold uppercase tracking-wide text-text-3">
              {t("listing.details")}
            </h2>
            <dl>
              <Row
                label={t("sell.category")}
                value={listing.category?.breadcrumb.map((b) => localName(b.name, lang)).join(", ")}
              />
              <Row label={t("sell.brand")} value={listing.brand?.name} />
              <Row label={t("sell.size")} value={listing.size?.label} />
              <Row label={t("sell.condition")} value={localName(listing.condition?.name, lang)} />
              <Row
                label={t("sell.colours")}
                value={listing.colours.map((c) => localName(c.name, lang)).join(", ")}
              />
              <Row label={t("sell.material")} value={localName(listing.material?.name, lang)} />
              <Row label={t("sell.pattern")} value={localName(listing.pattern?.name, lang)} />
              <Row
                label={t("listing.uploaded")}
                value={listing.publishedAt ? timeAgo(listing.publishedAt, t) : null}
              />
              <Row label={t("item.views")} value={String(listing.viewCount)} />
            </dl>
          </section>

          {isOwner ? null : (
            <ReportButton label={t("item.reportItem")} targetType="listing" targetId={listing.id} />
          )}
        </div>
      </div>

      {moreFromSeller.length > 0 ? (
        <section className="mt-2xl">
          <div className="mb-md flex items-baseline justify-between gap-md">
            <h2 className="text-heading font-bold text-text-1">
              {t("web.item.moreFromSeller", { name: sellerName })}
            </h2>
            <Link
              href={`/${lang}/seller/${seller.id}`}
              className="shrink-0 text-body-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t("web.item.seeAll")}
            </Link>
          </div>
          <ul className="-mx-lg flex gap-lg overflow-x-auto px-lg pb-sm md:mx-0 md:px-0">
            {moreFromSeller.map((card) => (
              <li key={card.id} className="w-[160px] shrink-0 md:w-[200px]">
                <ItemCard listing={card} hideHeart={isOwner} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-2xl">
        <h2 className="mb-md text-heading font-bold text-text-1">{t("web.item.similar")}</h2>
        {similarItems.length > 0 ? (
          <ItemGrid items={similarItems} />
        ) : (
          <p className="text-body-sm text-text-3">{t("item.noSimilar")}</p>
        )}
      </section>

      {showBar ? <BuyBar {...buyProps} /> : null}
    </main>
  );
}
