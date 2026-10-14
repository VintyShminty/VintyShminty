import { feedPageSchema, type PublicProfile } from "@vinty/shared";
import { Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { FollowButton } from "@/components/follow-button";
import { InfiniteItemGrid } from "@/components/infinite-item-grid";
import { ProfileHeader } from "@/components/profile-header";
import { ReportButton } from "@/components/report-dialog";
import { ReviewsList } from "@/components/reviews-list";
import { ApiClientError, getViewer, serverApi } from "@/lib/api";
import { pagePath } from "@/lib/feed-url";
import { getT, isLang } from "@/lib/i18n";
import { getProfile, getReviewsFirstPage } from "@/lib/listing-data";
import { alternatesFor } from "@/lib/seo";

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
      <ProfileHeader
        profile={profile}
        lang={lang}
        actions={
          isSelf ? (
            <p className="rounded-control bg-surface px-md py-sm text-body-sm text-text-2">
              {t("web.seller.you")}
            </p>
          ) : (
            <>
              <FollowButton userId={profile.id} name={name} initial={profile.viewer?.isFollowing ?? false} />
              {profile.activeListingCount >= 2 ? (
                <Link
                  href={`/${lang}/bundle/${profile.id}`}
                  className="inline-flex h-11 items-center justify-center gap-sm rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint"
                >
                  <Layers size={18} aria-hidden />
                  {t("bundle.shop")}
                </Link>
              ) : null}
            </>
          )
        }
      />

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
              hideSaves={isSelf}
              saveOnSold={false}
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
          <ReportButton label={t("seller.report")} targetType="user" targetId={profile.id} />
        </div>
      )}
    </main>
  );
}
