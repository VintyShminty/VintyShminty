"use client";

import type { AdminListingRow } from "@vinty/shared";
import { Search } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { inputClass, LoadFailed, Loading, PageTitle, quietButton } from "@/components/admin/ui";
import { useAdminListings } from "@/lib/admin-queries";
import { formatDate } from "@/lib/time";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

function money(minor: number | null, currency: string, language: string): string | null {
  if (minor === null) return null;
  try {
    return new Intl.NumberFormat(language, { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${minor / 100} ${currency}`;
  }
}

function ListingRow({ item, lang }: { item: AdminListingRow; lang: string }) {
  const { t, i18n } = useTranslation();
  const price = money(item.priceMinor, item.currency, i18n.language);
  const quiet = item.status === "hidden" || item.status === "removed";
  return (
    <li className="flex items-center gap-md rounded-window border border-border bg-surface p-md">
      {item.photoUrl ? (
        <img
          src={item.photoUrl}
          alt=""
          className="h-16 w-16 shrink-0 rounded-control bg-pressed object-cover"
        />
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-control bg-pressed" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-semibold text-text-1" dir="auto">
          {item.title}
        </p>
        <p className="truncate text-body-sm text-text-3" dir="auto">
          {t("admin.listings.by", { name: item.sellerUsername ?? "" })}
          {" · "}
          {price ?? t("admin.listings.noPrice")}
          {" · "}
          {formatDate(item.createdAt, i18n.language)}
        </p>
        <span
          className={cn(
            "mt-xs inline-block rounded-full px-sm py-px text-badge font-semibold",
            quiet ? "bg-warning-tint text-warning" : "bg-chip-selected text-on-chip",
          )}
        >
          {t(`admin.listings.status.${item.status}`)}
        </span>
      </div>
      <Link href={`/${lang}/admin/listings/${item.id}`} className={quietButton}>
        {t("admin.listings.edit")}
      </Link>
    </li>
  );
}

/** Every listing, newest first, found by title or seller username, each with an Edit button. */
export function ListingsView() {
  const { t } = useTranslation();
  const { lang } = useParams<{ lang: string }>();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const query = useAdminListings(q);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageTitle title={t("admin.nav.listings")} />
      <label className="relative mb-lg block md:w-96">
        <span className="sr-only">{t("admin.listings.search")}</span>
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute start-md top-1/2 -translate-y-1/2 text-text-3"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.listings.search")}
          className={cn(inputClass, "w-full ps-[38px]")}
        />
      </label>

      {query.data === undefined ? (
        query.isError ? (
          <LoadFailed onRetry={() => void query.refetch()} />
        ) : (
          <Loading />
        )
      ) : items.length === 0 ? (
        <p className="py-2xl text-center text-body-sm text-text-3">{t("admin.listings.empty")}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-sm">
            {items.map((item) => (
              <ListingRow key={item.id} item={item} lang={lang} />
            ))}
          </ul>
          {query.hasNextPage ? (
            <div className="mt-lg flex justify-center">
              <button
                type="button"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
                className={quietButton}
              >
                {t("admin.listings.loadMore")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
