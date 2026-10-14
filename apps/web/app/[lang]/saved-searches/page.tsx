import { brandSchema, findCategory, formatPrice, pageSchema, savedSearchListSchema } from "@vinty/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SavedSearchList, type SavedSearchRow } from "@/components/lists/saved-search-list";
import { serverApi } from "@/lib/api";
import { savedSearchHref } from "@/lib/filters";
import { getT, isLang } from "@/lib/i18n";
import { getReference } from "@/lib/reference";
import { requireViewer } from "@/lib/require-viewer";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Saved searches (spec, Saved searches): the page is ours to place. Each row says what was searched, a short line of
 * what is filtered, and opens the search page with the same words and filters. The alert switch and delete are in the list.
 */
export default async function SavedSearchesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  await requireViewer(lang, `/${lang}/saved-searches`);
  const t = getT(lang);

  const [saved, reference] = await Promise.all([
    serverApi("/v1/me/saved-searches", { lang, schema: savedSearchListSchema }).catch(() => null),
    getReference(lang).catch(() => null),
  ]);
  // The search page shows a brand chip with its name. A saved search only has the id, so names come from the popular brands.
  const needsBrands = saved?.items.some((s) => (s.filters.brandIds ?? []).length > 0) ?? false;
  const popular = needsBrands
    ? await serverApi("/v1/brands?limit=100", {
        lang,
        schema: pageSchema(brandSchema),
        anonymous: true,
        revalidate: 3600,
      }).catch(() => null)
    : null;
  const brands = Object.fromEntries((popular?.items ?? []).map((b) => [b.id, b.name]));

  const categoryName = (id: string) => {
    const node = reference ? findCategory(reference.categories, id) : null;
    return node ? node.name[lang] : undefined;
  };

  const rows: SavedSearchRow[] = (saved?.items ?? []).map((search) => {
    const { filters } = search;
    const parts: string[] = [];
    const categoryIds = [
      ...new Set([...(filters.categoryId ? [filters.categoryId] : []), ...(filters.categoryIds ?? [])]),
    ];
    const categories = Object.fromEntries(
      categoryIds.flatMap((id) => {
        const name = categoryName(id);
        return name ? [[id, name]] : [];
      }),
    );
    for (const name of Object.values(categories)) parts.push(name);
    const counts = [
      ["brands", filters.brandIds],
      ["sizes", filters.sizeIds],
      ["conditions", filters.conditionIds],
      ["colours", filters.colourIds],
      ["materials", filters.materialIds],
      ["patterns", filters.patternIds],
    ] as const;
    for (const [key, list] of counts) {
      if (list && list.length > 0) parts.push(t(`savedSearches.${key}`, { count: list.length }));
    }
    const { priceMinMinor: min, priceMaxMinor: max } = filters;
    if (min !== undefined && max !== undefined) {
      parts.push(
        t("savedSearches.priceRange", { min: formatPrice(min, "ILS"), max: formatPrice(max, "ILS") }),
      );
    } else if (min !== undefined) {
      parts.push(t("savedSearches.priceFrom", { min: formatPrice(min, "ILS") }));
    } else if (max !== undefined) {
      parts.push(t("savedSearches.priceTo", { max: formatPrice(max, "ILS") }));
    }
    const words = search.queryText ?? filters.q;
    return {
      id: search.id,
      title: words || (parts.length > 0 ? t("savedSearches.filtersOnly") : t("savedSearches.allItems")),
      summary: parts.join(" · "),
      href: savedSearchHref(lang, search, { brands, categories, brandFallback: t("filters.brand") }),
      notifyOnNew: search.notifyOnNew,
    };
  });

  return (
    <main className="mx-auto max-w-[1400px] px-lg pb-2xl pt-xl md:px-xl">
      <h1 className="mb-lg text-title font-bold text-text-1">{t("savedSearches.title")}</h1>
      {saved ? (
        <SavedSearchList initial={rows} />
      ) : (
        <p className="text-body-sm text-error">{t("errors.loadFailed")}</p>
      )}
    </main>
  );
}
