import type { SearchState } from "@/lib/search-store";

/**
 * The search a brand name opens. A brand on our list becomes the brand filter (so it shows as a chip on the
 * results). A brand the seller only typed has no id, so it becomes a search for the name as words.
 */
export function brandSearchState(brand: { id?: string | null; name: string }): Partial<SearchState> {
  if (brand.id) {
    return { filters: { sort: "relevance", brandIds: [brand.id] }, brandNames: { [brand.id]: brand.name } };
  }
  return { q: brand.name };
}
