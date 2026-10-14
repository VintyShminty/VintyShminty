import type { CategoryNode, SavedSearch } from "@vinty/shared";
import { useTranslation } from "react-i18next";
import { formatMoney } from "@/lib/money";
import { useLocalName, useReference } from "@/lib/reference";
import { useSearchStore } from "@/lib/search-store";

export function findCategory(nodes: CategoryNode[] | undefined, id: string): CategoryNode | undefined {
  for (const node of nodes ?? []) {
    if (node.id === id) return node;
    const inside = findCategory(node.children, id);
    if (inside) return inside;
  }
  return undefined;
}

/**
 * How a saved search reads in a list: the words (or "Filters only" / "All items") and a short line of what is
 * filtered. `load` puts the saved search in the search store, which the search screen reads its words and filters from.
 */
export function useSavedSearchSummary(search: SavedSearch) {
  const { t } = useTranslation();
  const reference = useReference();
  const name = useLocalName();
  const { filters } = search;

  // Money is shown in the currency of the app (shekels).
  const parts: string[] = [];
  const category = filters.categoryId
    ? findCategory(reference.data?.categories, filters.categoryId)
    : undefined;
  if (category) parts.push(name(category.name));
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
    parts.push(t("savedSearches.priceRange", { min: formatMoney(min, "ILS"), max: formatMoney(max, "ILS") }));
  } else if (min !== undefined) {
    parts.push(t("savedSearches.priceFrom", { min: formatMoney(min, "ILS") }));
  } else if (max !== undefined) {
    parts.push(t("savedSearches.priceTo", { max: formatMoney(max, "ILS") }));
  }
  const words = search.queryText ?? filters.q;
  const title = words || (parts.length > 0 ? t("savedSearches.filtersOnly") : t("savedSearches.allItems"));

  const load = () => {
    const { q, ...rest } = filters;
    useSearchStore.getState().reset("search", {
      q: search.queryText ?? q ?? "",
      filters: { ...rest, sort: rest.sort ?? "relevance" },
      categoryName: category ? name(category.name) : null,
    });
  };

  return { title, parts, load };
}
