import type { PublicProfile } from "@vinty/shared";
import { MapPin, Moon } from "lucide-react";
import type { ReactNode } from "react";
import { SellerAvatar } from "@/components/seller-avatar";
import { SellerStamp } from "@/components/seller-stamp";
import { StarRating } from "@/components/star-rating";
import { getT, type Lang } from "@/lib/i18n";
import { formatDay, timeAgo } from "@/lib/time";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col-reverse items-center py-md">
      <dt className="mt-px text-card-meta text-text-3">{label}</dt>
      <dd className="text-heading font-bold text-text-1">{value}</dd>
    </div>
  );
}

/**
 * The top of a seller's page and of your own profile (D-019 row 13): photo, name, rating, place, bio, stamps, and at the
 * end the `actions` (Follow, or Edit profile) above the three numbers. Both pages use it so they always look alike.
 * `away` adds the Away mode strip below the header (the seller page shows it as a line, your own profile with a button).
 */
export function ProfileHeader({
  profile,
  lang,
  actions,
  away,
}: {
  profile: PublicProfile;
  lang: Lang;
  actions: ReactNode;
  away?: ReactNode;
}) {
  const t = getT(lang);
  const name = profile.username ?? t("profile.closedAccount");
  const location = [
    profile.city,
    t(`countries.${profile.countryCode}`, { defaultValue: profile.countryCode }),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
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
          {actions}
          <dl className="flex rounded-control border border-border-subtle">
            <Stat value={profile.activeListingCount} label={t("profile.listings")} />
            <div className="my-sm w-px bg-border-subtle" />
            <Stat value={profile.followerCount} label={t("profile.followers")} />
            <div className="my-sm w-px bg-border-subtle" />
            <Stat value={profile.followingCount} label={t("profile.following")} />
          </dl>
        </div>
      </header>
      {away ??
        (profile.holidayMode ? (
          <div className="mt-lg flex items-start gap-sm rounded-control border border-warning bg-warning-tint p-md">
            <Moon size={18} aria-hidden className="mt-px shrink-0 text-warning" />
            <p className="flex-1 text-body-sm text-warning">
              {profile.holidayEndsAt
                ? t("item.away", { name, date: formatDay(profile.holidayEndsAt, lang) })
                : t("item.awayNoDate", { name })}
            </p>
          </div>
        ) : null)}
    </>
  );
}
