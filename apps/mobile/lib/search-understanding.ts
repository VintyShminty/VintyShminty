import { applyUnderstanding, type SearchUnderstanding } from "@vinty/shared";
import { activeFilters, type SearchState } from "./search-store";

/** The category name a chip needs (brand names come with the answer). A missing name falls back to the generic chip label. */
export type UnderstandingNames = {
  categoryName: (id: string) => string | undefined;
};

/**
 * Turns the AI's reading of the words into the next search state, plus the state to go back to for "Search the exact
 * words". The next state keeps the filters already chosen (a kind the words name replaces what was there) and holds
 * only the left over words in `q`. The way back is the state from before, with `q` as the person's own words.
 */
export function applyUnderstandingToState(
  before: SearchState,
  original: string,
  understanding: SearchUnderstanding,
  names: UnderstandingNames,
): { next: SearchState; undo: SearchState } {
  const undo: SearchState = { ...before, q: original };
  const merged = applyUnderstanding(activeFilters(undo), understanding);
  const { q, ...filters } = merged;

  const fromAnswer = new Map(understanding.brands.map((b) => [b.id, b.name]));
  const brandNames: Record<string, string> = {};
  for (const id of filters.brandIds ?? []) {
    const name = before.brandNames[id] ?? fromAnswer.get(id);
    if (name) brandNames[id] = name;
  }
  const categoryName = understanding.categoryId
    ? (names.categoryName(understanding.categoryId) ?? null)
    : before.categoryName;

  return {
    next: {
      q: q ?? "",
      filters: { ...filters, sort: filters.sort ?? "relevance" },
      brandNames,
      categoryName,
    },
    undo,
  };
}
