import { feedPageSchema, type PublicProfile } from "@vinty/shared";
import { MapPin, Moon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { FollowButton } from "@/components/follow-button";
import { InfiniteItemGrid } from "@/components/infinite-item-grid";
import { ReportButton } from "@/components/item-actions";
import { ReviewsList } from "@/components/reviews-list";
import { SellerAvatar } from "@/components/seller-avatar";
import { SellerStamp } from "@/components/seller-stamp";
import { StarRating } from "@/components/star-rating";
import { ApiClientError, getViewer, serverApi } from "@/lib/api";
import { pagePath } from "@/lib/feed-url";
import { getT, isLang } from "@/lib/i18n";
import { getProfile, getReviewsFirstPage } from "@/lib/listing-data";
import { alternatesFor } from "@/lib/seo";
import { formatDay, timeAgo } from "@/lib/time";

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLang(lang)) return { title: "Vinty" };
  const t = getT(lang);
  let profile: PublicProfile;
  try {
    profile = await getProfile(lang, id);
  } catch (error) {
    if (error instanceof ApiClientError) return { title: "Vinty", robots: { index: false } };
    throw error;
  }
  const sp = await searchParams;
  const name = profile.username ?? profile.name;
  const title = `${name} · Vinty`;
  const description = t("web.seller.metaDescription", { name, count: profile.activeListingCount });
  const path = `/seller/${id}`;
  return {
    title: { absolute: title },
    description,
    alternates: alternatesFor(lang, path),
    // The base page is the one for Google. The Sold and Reviews views are the same seller again.
    robots: first(sp.tab) || first(sp.status) ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      url: `/${lang}${path}`,
      siteName: "Vinty",
      type: "profile",
      images: profile.avatarUrl ? [{ url: profile.avatarUrl, alt: name }] : undefined,
      locale: lang === "he" ? "he_IL" : "en_US",
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: profile.avatarUrl ? [profile.avatarUrl] : undefined,
    },
  };
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col-reverse items-center py-md">
      <dt className="mt-px text-card-meta text-text-3">{label}</dt>
      <dd className="text-heading font-bold text-text-1">{value}</dd>
    </div>
  );
}

/**
 * A seller's page (D-019 row 13, same content as the app profile): the header with the rating, stamps, numbers and
 * Follow, then the Listings and Reviews tabs. The tab is `?tab=reviews`, Active or Sold is `?status=sold`.
 * About lives in the header here (bio, city, last seen), so there is no About tab.
 */
export default async function SellerPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const t = getT(lang);
  const tab = first(sp.tab) === "reviews" ? "reviews" : "listings";
  const status = first(sp.status) === "sold" ? "sold" : "active";

  let profile: PublicProfile;
  try {
    profile = await getProfile(lang, id);
  } catch (error) {
    if (!(error instanceof ApiClientError)) throw error;
    return (
      <main className="mx-auto max-w-[1400px] px-lg pb-2xl pt-xl md:px-xl">
        <EmptyState title={t("web.seller.loadFailed")} />
      </main>
    );
  }
  const me = await getViewer(lang);
  const isSelf = me?.id === profile.id;
  const name = profile.username ?? t("profile.closedAccount");
  const location = [
    profile.city,
    t(`countries.${profile.countryCode}`, { defaultValue: profile.countryCode }),
  ]
    .filter(Boolean)
    .join(", ");

  const base = `/${lang}/seller/${id}`;
  const tabHref = (key: "listings" | "reviews") => (key === "reviews" ? `${base}?tab=reviews` : base);
  const statusHref = (key: "active" | "sold") => (key === "sold" ? `${base}?status=sold` : base);

  const endpoint = `/v1/users/${encodeURIComponent(id)}/listings?status=${status}`;
  const [listingsFirst, reviewsFirst] = await Promise.all([
    tab === "listings"
      ? serverApi(pagePath(endpoint), { lang, schema: feedPageSchema }).catch(() => null)
      : Promise.resolve(null),
    tab === "reviews" ? getReviewsFirstPage(lang, id) : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto max-w-[1400px] px-lg pb-2xl pt-xl md:px-xl">
      <header className="flex flex-col gap-lg md:flex-row md:items-start md:gap-xl">
        <SellerAvatar url={profile.avatarUrl} name={name} size={96} />
        <div className="flex min-w-0 flex-1 flex-col gap-sm">
          <div>
            <h1 className="truncate text-title font-bold text-text-1">{name}</h1>
            {profile.name && profile.name !== profile.username ? (
              <p className="text-body-sm text-text-3">{profile.name}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-sm">
            {profile.reviewCount > 0 ? (
              <>
                <StarRating
                  rating={profile.ratingAverage}
                  label={t("web.seller.rating", { rating: profile.ratingAverage?.toFixed(1) ?? 0 })}
                />
                <span className="text-card-meta text-text-3">
                  {t("profile.reviewCount", { count: profile.reviewCount })}
                </span>
              </>
            ) : (
              <span className="text-card-meta text-text-3">{t("profile.noReviewsYet")}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-md gap-y-xs text-card-meta text-text-3">
            {location ? (
              <span className="inline-flex items-center gap-xs">
                <MapPin size={13} aria-hidden />
                {location}
              </span>
            ) : null}
            {profile.lastSeenAt ? (
              <span>{t("profile.about.lastSeen", { when: timeAgo(profile.lastSeenAt, t) })}</span>
            ) : null}
          </div>
          {profile.bio ? (
            <p className="max-w-[640px] whitespace-pre-line text-body text-text-1">{profile.bio}</p>
          ) : null}
          {profile.badges.length > 0 ? (
            <ul className="flex flex-wrap gap-sm pt-xs">
              {profile.badges.map((b) => (
                <li key={b.slug}>
                  <SellerStamp icon={b.icon} label={b.name[lang]} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-col gap-md md:w-[280px] md:shrink-0">
          {isSelf ? (
            <p className="rounded-control bg-surface px-md py-sm text-body-sm text-text-2">
              {t("web.seller.you")}
            </p>
          ) : (
            <FollowButton userId={profile.id} name={name} initial={profile.viewer?.isFollowing ?? false} />
          )}
          <dl className="flex rounded-control border border-border-subtle">
            <Stat value={profile.activeListingCount} label={t("profile.listings")} />
            <div className="my-sm w-px bg-border-subtle" />
            <Stat value={profile.followerCount} label={t("profile.followers")} />
            <div className="my-sm w-px bg-border-subtle" />
            <Stat value={profile.followingCount} label={t("profile.following")} />
          </dl>
        </div>
      </header>

      {profile.holidayMode ? (
        <div className="mt-lg flex items-start gap-sm rounded-control border border-warning bg-warning-tint p-md">
          <Moon size={18} aria-hidden className="mt-px shrink-0 text-warning" />
          <p className="flex-1 text-body-sm text-warning">
            {profile.holidayEndsAt
              ? t("item.away", { name, date: formatDay(profile.holidayEndsAt, lang) })
              : t("item.awayNoDate", { name })}
          </p>
        </div>
      ) : null}

      <nav
        aria-label={t("web.seller.tabsLabel")}
        className="mt-xl flex gap-sm border-b border-border-subtle pb-md"
      >
        <Chip
          href={tabHref("listings")}
          replace
          scroll={false}
          selected={tab === "listings"}
          label={t("profile.tabs.listings")}
        />
        <Chip
          href={tabHref("reviews")}
          replace
          scroll={false}
          selected={tab === "reviews"}
          label={t("profile.tabs.reviews")}
        />
      </nav>

      <div className="mt-lg">
        {tab === "listings" ? (
          <>
            <nav aria-label={t("web.seller.statusLabel")} className="mb-lg flex gap-sm">
              <Chip
                href={statusHref("active")}
                replace
                scroll={false}
                selected={status === "active"}
                label={t("profile.active")}
              />
              <Chip
                href={statusHref("sold")}
                replace
                scroll={false}
                selected={status === "sold"}
                label={t("profile.sold")}
              />
            </nav>
            <InfiniteItemGrid
              key={endpoint}
              endpoint={endpoint}
              kind="plain"
              firstPage={listingsFirst}
              hideHearts={isSelf}
              heartOnSold={false}
              empty={
                <EmptyState title={status === "active" ? t("profile.noListings") : t("profile.noSold")} />
              }
            />
          </>
        ) : (
          <ReviewsList userId={profile.id} firstPage={reviewsFirst} />
        )}
      </div>

      {isSelf ? null : (
        <div className="mt-2xl">
          <ReportButton label={t("seller.report")} />
        </div>
      )}
    </main>
  );
}
