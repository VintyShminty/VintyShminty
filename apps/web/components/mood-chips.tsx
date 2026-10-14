"use client";

import { type FeedMood, formatPrice, UNDER_50_MINOR } from "@vinty/shared";
import { useTranslation } from "react-i18next";
import { Chip } from "@/components/chip";
import { homeHref, MOODS } from "@/lib/feed-url";

/** The Home chips. Each is a link, so the address changes (`?mood=`) and the server builds that list. */
export function MoodChips({ lang, active, signedIn }: { lang: string; active: FeedMood; signedIn: boolean }) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("web.nav.feedNavigation")}
      className="-mx-lg flex gap-sm overflow-x-auto px-lg pb-xs md:mx-0 md:flex-wrap md:px-0"
    >
      {MOODS.filter((m) => signedIn || !m.needsAccount).map((m) => (
        <Chip
          key={m.key}
          href={homeHref(lang, m.key)}
          scroll={false}
          selected={active === m.key}
          label={t(`home.moods.${m.key}`, { amount: formatPrice(UNDER_50_MINOR, "ILS") })}
        />
      ))}
    </nav>
  );
}
