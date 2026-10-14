import { membersPageSchema, searchPageSchema } from "@vinty/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { FilterBar, FilterProvider, PendingFade } from "@/components/filter-bar";
import { InfiniteItemGrid } from "@/components/infinite-item-grid";
import { SaveSearchButton } from "@/components/lists/save-search-button";
import { serverApi } from "@/lib/api";
import { pagePath } from "@/lib/feed-url";
import { buildFilterOptions, listingQuery, paramValue, parseCategories, parseFilters } from "@/lib/filters";
import { getT, isLang, type Lang } from "@/lib/i18n";
import { getReference } from "@/lib/reference";
import { alternatesFor } from "@/lib/seo";

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Vinty" };
  const sp = await searchParams;
  // Results for a word or with filters are not pages for Google. Plain /search is.
  const hasQuery = Object.values(sp).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  return {
    title: `${getT(lang)("search.items")} | Vinty`,
    alternates: alternatesFor(lang, "/search"),
    robots: hasQuery ? { index: false, follow: true } : undefined,
  };
}

/**
 * Search (D-030): the Items and Sellers switch, then for Items the same filter pills and grid as a Browse tile.
 * The words are `?q=`, the tab is `?view=sellers` (items otherwise), and the filters are in the address too.
 */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const t = getT(lang);
  const q = paramValue(sp, "q")?.trim().slice(0, 100) ?? "";
  const sellers = paramValue(sp, "view") === "sellers";

  const tabHref = (view: "items" | "sellers") => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (view === "sellers") next.set("view", "sellers");
    const qs = next.toString();
    return `/${lang}/search${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="mx-auto max-w-[1280px] px-lg pb-2xl pt-xl md:px-xl lg:px-[48px] xl:px-[80px]">
      <div className="flex flex-col gap-md md:flex-row md:items-start md:justify-between">
        <h1 className="text-title font-bold text-text-1">
          {q ? t("web.search.resultsFor", { q }) : t("web.search.allItems")}
        </h1>
        {sellers ? null : <SaveSearchButton q={q} query={queryString(sp)} />}
      </div>
      <nav aria-label={t("web.search.tabsLabel")} className="mt-lg flex gap-sm">
        <Chip href={tabHref("items")} replace selected={!sellers} label={t("search.items")} />
        <Chip href={tabHref("sellers")} replace selected={sellers} label={t("search.sellers")} />
      </nav>
      <div className="mt-lg">
        {sellers ? <Sellers lang={lang} q={q} /> : <Items lang={lang} q={q} sp={sp} />}
      </div>
    </main>
  );
}

/** The address query as text, for the Save button to read the words and filters from. */
function queryString(sp: SearchParams) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) next.append(key, v);
  }
  return next.toString();
}

/** The search address with one category taken off. */
function withoutCategory(lang: Lang, sp: SearchParams, id: string) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      if (key === "category" && v.split("~")[0] === id) continue;
      next.append(key, v);
    }
  }
  const qs = next.toString();
  return `/${lang}/search${qs ? `?${qs}` : ""}`;
}

async function Items({ lang, q, sp }: { lang: Lang; q: string; sp: SearchParams }) {
  const t = getT(lang);
  const filters = parseFilters(sp, "relevance");
  // A saved search can limit the words to a category. It shows as a chip that takes it off.
  const categories = parseCategories(sp);
  const categoryIds = categories.map((c) => c.id);
  const endpoint = `/v1/listings?${listingQuery(filters, { q, categoryIds })}`;
  const [firstPage, reference] = await Promise.all([
    serverApi(pagePath(endpoint), { lang, schema: searchPageSchema }).catch(() => null),
    getReference(lang).catch(() => null),
  ]);
  const options = reference
    ? buildFilterOptions(reference, lang, null)
    : { sizeGroups: [], sizeLabels: {}, conditions: [], colours: [] };
  const count = firstPage
    ? firstPage.totalCapped
      ? t("search.resultsCapped", { count: firstPage.total })
      : t("search.results", { count: firstPage.total })
    : null;
  return (
    <>
      {count ? (
        <p className="mb-md text-body-sm text-text-3" aria-live="polite">
          {count}
        </p>
      ) : null}
      {categories.length > 0 ? (
        <div className="mb-md flex flex-wrap gap-sm">
          {categories.map((category) => (
            <Chip
              key={category.id}
              applied
              replace
              scroll={false}
              href={withoutCategory(lang, sp, category.id)}
              label={category.name}
              ariaLabel={t("filters.removeFilter", { name: category.name })}
            />
          ))}
        </div>
      ) : null}
      <FilterProvider>
        <FilterBar defaultSort="relevance" options={options} q={q} categoryIds={categoryIds} />
        <div className="mt-xl">
          <PendingFade>
            <InfiniteItemGrid
              key={endpoint}
              endpoint={endpoint}
              kind="listings"
              firstPage={firstPage}
              empty={<EmptyState title={t("search.noResults")} message={t("search.noResultsHint")} />}
            />
          </PendingFade>
        </div>
      </FilterProvider>
    </>
  );
}

async function Sellers({ lang, q }: { lang: Lang; q: string }) {
  const t = getT(lang);
  if (!q) return <EmptyState title={t("search.sellersHint")} />;
  const page = await serverApi(`/v1/users?limit=30&q=${encodeURIComponent(q.slice(0, 40))}`, {
    lang,
    schema: membersPageSchema,
  }).catch(() => null);
  if (!page) return <EmptyState title={t("errors.general")} />;
  if (page.items.length === 0) return <EmptyState title={t("search.noSellers")} />;
  return (
    <ul className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
      {page.items.map((seller) => {
        const name = seller.username ?? "";
        return (
          <li key={seller.id}>
            <Link
              href={`/${lang}/seller/${seller.id}`}
              className="flex items-center gap-md rounded-control border border-border-subtle p-md hover:bg-pressed"
            >
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pressed text-body font-bold text-primary">
                {seller.avatarUrl ? (
                  // biome-ignore lint/performance/noImgElement: a small avatar, no image optimisation on purpose
                  <img
                    src={seller.avatarUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  name.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-body font-semibold text-text-1">{name}</span>
                {seller.reviewCount > 0 && seller.ratingAverage !== null ? (
                  <span className="block text-body-sm text-text-3">
                    {seller.ratingAverage.toFixed(1)} ·{" "}
                    {t("web.search.reviews", { count: seller.reviewCount })}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
