"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type { MyBump } from "@vinty/shared";
import { ChevronRight, Clock, Zap } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { myBumpsQuery } from "@/lib/own-listing-queries";
import { formatDateTime } from "@/lib/time";

/** One buzz: the item photo, the plan, and when it ends or ended. A click opens the item. */
function BuzzRow({ bump, lang }: { bump: MyBump; lang: "en" | "he" }) {
  const { t, i18n } = useTranslation();
  const when = formatDateTime(bump.endsAt, i18n.language);
  const title = bump.listing.title || t("listing.untitled");
  return (
    <li>
      <Link
        href={`/${lang}/item/${bump.listing.id}`}
        prefetch={false}
        aria-label={`${title}, ${bump.plan.name[lang]}`}
        className="flex items-center gap-md border-b border-border-subtle py-md hover:bg-surface"
      >
        <span className="h-16 w-12 shrink-0 overflow-hidden rounded-control bg-pressed">
          {bump.listing.cover ? (
            // biome-ignore lint/performance/noImgElement: the card cover comes ready sized from storage
            <img src={bump.listing.cover.url} alt="" className="h-full w-full object-cover" />
          ) : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-xs text-start">
          <span className="truncate text-body font-semibold text-text-1">{title}</span>
          <span className="truncate text-body-sm text-text-3">{bump.plan.name[lang]}</span>
          <span suppressHydrationWarning className="text-body-sm text-text-3">
            {bump.isActive ? t("buzz.endsOn", { date: when }) : t("buzz.endedOn", { date: when })}
          </span>
        </span>
        {bump.isActive ? (
          <Badge variant="accent" icon={Zap} label={t("buzz.buzzing")} />
        ) : (
          <Badge variant="neutral" icon={Clock} label={t("buzz.ended")} />
        )}
        <ChevronRight size={18} aria-hidden className="shrink-0 text-text-3 rtl:rotate-180" />
      </Link>
    </li>
  );
}

/** Your buzzes: every time you gave an item buzz, newest first. */
export function BuzzList({ lang }: { lang: "en" | "he" }) {
  const { t } = useTranslation();
  const query = useInfiniteQuery(myBumpsQuery());
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (query.isPending) {
    return (
      <p role="status" className="py-xl text-body-sm text-text-3">
        {t("web.feed.loading")}
      </p>
    );
  }
  if (query.isError && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-md py-2xl text-center">
        <p className="text-heading text-text-1">{t("errors.general")}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="inline-flex h-10 items-center rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint"
        >
          {t("common.tryAgain")}
        </button>
      </div>
    );
  }
  if (items.length === 0) return <EmptyState title={t("buzz.empty")} message={t("buzz.emptyNote")} />;
  return (
    <>
      <ul>
        {items.map((bump) => (
          <BuzzRow key={bump.id} bump={bump} lang={lang} />
        ))}
      </ul>
      {query.hasNextPage ? (
        <button
          type="button"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="mt-lg inline-flex h-10 items-center rounded-control border border-border px-lg text-body-sm font-semibold text-text-1 hover:bg-pressed disabled:opacity-60"
        >
          {query.isFetchingNextPage ? t("web.feed.loadingMore") : t("web.item.loadMore")}
        </button>
      ) : null}
    </>
  );
}
