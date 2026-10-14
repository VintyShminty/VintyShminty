import { MY_LISTING_STATUSES, type MyListingsPage, myListingsPageSchema } from "@vinty/shared";
import { Bookmark, ChevronRight, SearchCheck, Settings, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { AwayStrip } from "@/components/profile/away-strip";
import { OwnListings } from "@/components/profile/own-listings";
import { ProfileHeader } from "@/components/profile-header";
import { ReviewsList } from "@/components/reviews-list";
import { serverApi } from "@/lib/api";
import { getT, isLang } from "@/lib/i18n";
import { getReviewsFirstPage } from "@/lib/listing-data";
import { requireViewer } from "@/lib/require-viewer";

export const metadata: Metadata = { robots: { index: false } };

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Your profile (D-019 row 13, D-025): the same page others see (header, numbers, stamps) with your own tools. The Edit
 * profile button, links to Favourites, Saved searches, Your buzzes and Settings, the Away mode strip with its "I'm back" button,
 * and your listings in every state with views and saves. The tab is `?tab=reviews`, the state is `?status=draft`.
 */
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const me = await requireViewer(lang, `/${lang}/profile`);
  const sp = await searchParams;
  const t = getT(lang);
  const profile = me.profile;
  const tab = first(sp.tab) === "reviews" ? "reviews" : "listings";
  const status = MY_LISTING_STATUSES.find((s) => s === first(sp.status)) ?? "active";

  const [listingsFirst, reviewsFirst] = await Promise.all([
    tab === "listings"
      ? serverApi<MyListingsPage>(`/v1/me/listings?status=${status}&limit=20`, {
          lang,
          schema: myListingsPageSchema,
        }).catch(() => null)
      : Promise.resolve(null),
    tab === "reviews" ? getReviewsFirstPage(lang, me.id) : Promise.resolve(null),
  ]);

  const base = `/${lang}/profile`;
  const tabHref = (key: "listings" | "reviews") => (key === "reviews" ? `${base}?tab=reviews` : base);
  const statusHref = (key: string) => (key === "active" ? base : `${base}?status=${key}`);
  const rowClass =
    "flex min-h-12 items-center gap-md rounded-control px-md text-body-sm font-semibold text-text-1 hover:text-primary focus-visible:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary";
  const rows = [
    { href: `/${lang}/favourites`, icon: Bookmark, label: t("favourites.title") },
    { href: `/${lang}/saved-searches`, icon: SearchCheck, label: t("savedSearches.title") },
    { href: `/${lang}/buzzes`, icon: Zap, label: t("buzz.yourBuzzes") },
    { href: `/${lang}/settings`, icon: Settings, label: t("settings.title") },
  ];

  return (
    <main className="mx-auto max-w-[1280px] px-lg pb-2xl pt-xl md:px-xl lg:px-[48px] xl:px-[80px]">
      <ProfileHeader
        profile={profile}
        lang={lang}
        actions={
          <Link
            href={`/${lang}/settings/profile`}
            className="inline-flex h-11 items-center justify-center rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint"
          >
            {t("profile.edit")}
          </Link>
        }
        away={profile.holidayMode ? <AwayStrip endsAt={profile.holidayEndsAt} /> : undefined}
      />

      <nav
        aria-label={t("web.profile.shortcuts")}
        className="mt-lg flex flex-col md:flex-row md:flex-wrap md:gap-sm"
      >
        {rows.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className={rowClass}>
            <Icon size={18} aria-hidden className="text-text-3" />
            <span className="flex-1">{label}</span>
            <ChevronRight size={16} aria-hidden className="text-text-4 md:hidden rtl:-scale-x-100" />
          </Link>
        ))}
      </nav>

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
            <nav aria-label={t("web.seller.statusLabel")} className="mb-lg flex flex-wrap gap-sm">
              {(["active", "draft", "reserved", "sold", "hidden"] as const).map((key) => (
                <Chip
                  key={key}
                  href={statusHref(key)}
                  replace
                  scroll={false}
                  selected={status === key}
                  label={t(`profile.ownStatus.${key}`)}
                  count={listingsFirst?.counts[key]}
                />
              ))}
            </nav>
            <OwnListings
              key={status}
              lang={lang}
              status={status}
              firstPage={listingsFirst}
              empty={<EmptyState title={t(`profile.ownEmpty.${status}`)} />}
            />
          </>
        ) : (
          <ReviewsList userId={me.id} firstPage={reviewsFirst} ownLang={lang} />
        )}
      </div>
    </main>
  );
}
