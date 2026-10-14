import { feedPageSchema } from "@vinty/shared";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { InfiniteItemGrid } from "@/components/infinite-item-grid";
import { serverApi } from "@/lib/api";
import { pagePath } from "@/lib/feed-url";
import { getT, isLang } from "@/lib/i18n";
import { requireViewer } from "@/lib/require-viewer";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Favourites (D-019): everything you hearted, with a search box. Sold items stay on the list with the Sold band and
 * keep their heart, so they can be taken off (spec, Favourites). The search is a plain form: `?q=`.
 */
export default async function FavouritesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  await requireViewer(lang, `/${lang}/favourites`);
  const t = getT(lang);
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? "";
  const endpoint = q ? `/v1/me/favourites?q=${encodeURIComponent(q)}` : "/v1/me/favourites";
  const firstPage = await serverApi(pagePath(endpoint), { lang, schema: feedPageSchema }).catch(() => null);

  return (
    <main className="mx-auto max-w-[1280px] px-lg pb-2xl pt-xl md:px-xl lg:px-[48px] xl:px-[80px]">
      <h1 className="text-title font-bold text-text-1">{t("favourites.title")}</h1>
      <form
        action={`/${lang}/favourites`}
        className="mt-lg flex h-11 max-w-[480px] items-center gap-sm rounded-full border border-border bg-surface px-md"
      >
        <Search size={17} className="shrink-0 text-text-3" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t("favourites.search")}
          aria-label={t("favourites.search")}
          className="min-w-0 flex-1 bg-transparent text-body-sm text-text-1 outline-none placeholder:text-text-3"
        />
      </form>
      <div className="mt-xl">
        <InfiniteItemGrid
          key={endpoint}
          endpoint={endpoint}
          kind="plain"
          firstPage={firstPage}
          saveOnSold
          empty={
            <EmptyState
              title={q ? t("favourites.noMatches") : t("favourites.empty")}
              message={q ? undefined : t("web.lists.favouritesEmptyNote")}
            />
          }
        />
      </div>
    </main>
  );
}
