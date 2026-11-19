import { parseCategories, parseFilters } from "./filters";

/**
 * What the website tells the server about a search by words (`POST /v1/me/recent-searches`): the words and the
 * filters in the address, the same shape the app sends. `query` is the address query. One category goes as
 * `categoryId`, which is what Home learns from directly (docs/plans/home-feed.md section 17).
 */
export function recentSearchBody(q: string, query: string) {
  const params = new URLSearchParams(query);
  const filters = parseFilters(params, "relevance");
  const categories = parseCategories(params);
  return {
    queryText: q,
    filters: {
      sort: "relevance" as const,
      ...(filters.brands.length ? { brandIds: filters.brands.map((b) => b.id) } : {}),
      ...(filters.sizeIds.length ? { sizeIds: filters.sizeIds } : {}),
      ...(filters.conditionIds.length ? { conditionIds: filters.conditionIds } : {}),
      ...(filters.colourIds.length ? { colourIds: filters.colourIds } : {}),
      ...(filters.min !== undefined ? { priceMinMinor: filters.min * 100 } : {}),
      ...(filters.max !== undefined ? { priceMaxMinor: filters.max * 100 } : {}),
      ...(categories.length === 1 ? { categoryId: categories[0]?.id } : {}),
      ...(categories.length > 1 ? { categoryIds: categories.map((c) => c.id) } : {}),
    },
  };
}
