import type { SearchFilters } from "@vinty/shared";
import { create } from "zustand";

/** The filters a person can change. Brand names are kept so rows and chips can show them without a lookup. */
export type SearchState = {
  /** The words typed in the search field. */
  q: string;
  filters: Omit<SearchFilters, "q">;
  brandNames: Record<string, string>;
  /** Name of the chosen category for rows and chips. */
  categoryName: string | null;
};

/** Each results screen has its own scope ("search" or "browse"), so one cannot change the other beneath it. */
export type Scope = "search" | "browse";

export const EMPTY_STATE: SearchState = {
  q: "",
  filters: { sort: "relevance" },
  brandNames: {},
  categoryName: null,
};

type Store = {
  scopes: Record<Scope, SearchState>;
  /** Replaces a whole scope, for example when a category is opened or Clear all is pressed. */
  reset: (scope: Scope, next?: Partial<SearchState>) => void;
  setQuery: (scope: Scope, q: string) => void;
  setFilters: (scope: Scope, patch: Partial<SearchState["filters"]>) => void;
  setBrands: (scope: Scope, brands: { id: string; name: string }[]) => void;
  setCategory: (scope: Scope, category: { id: string; name: string } | null) => void;
};

export const useSearchStore = create<Store>((set) => {
  const update = (scope: Scope, fn: (s: SearchState) => SearchState) =>
    set((state) => ({ scopes: { ...state.scopes, [scope]: fn(state.scopes[scope]) } }));
  return {
    scopes: { search: EMPTY_STATE, browse: EMPTY_STATE },
    reset: (scope, next) => update(scope, () => ({ ...EMPTY_STATE, ...next })),
    setQuery: (scope, q) => update(scope, (s) => ({ ...s, q })),
    setFilters: (scope, patch) => update(scope, (s) => ({ ...s, filters: { ...s.filters, ...patch } })),
    setBrands: (scope, brands) =>
      update(scope, (s) => ({
        ...s,
        filters: { ...s.filters, brandIds: brands.length > 0 ? brands.map((b) => b.id) : undefined },
        brandNames: Object.fromEntries(brands.map((b) => [b.id, b.name])),
      })),
    setCategory: (scope, category) =>
      update(scope, (s) => ({
        ...s,
        filters: { ...s.filters, categoryId: category?.id },
        categoryName: category?.name ?? null,
      })),
  };
});

/** The filters that go to the server for one scope: the words plus the chosen filters, empty lists removed. */
export function activeFilters(state: SearchState): Partial<SearchFilters> {
  const out: Partial<SearchFilters> = { ...state.filters };
  const q = state.q.trim();
  if (q) out.q = q;
  for (const key of [
    "brandIds",
    "sizeIds",
    "conditionIds",
    "colourIds",
    "materialIds",
    "patternIds",
  ] as const) {
    if (!out[key]?.length) delete out[key];
  }
  return out;
}

/** How many filter groups are on (sort and the words do not count). */
export function activeFilterCount(state: SearchState): number {
  const f = state.filters;
  let n = 0;
  if (f.categoryId) n++;
  for (const key of [
    "brandIds",
    "sizeIds",
    "conditionIds",
    "colourIds",
    "materialIds",
    "patternIds",
  ] as const) {
    if (f[key]?.length) n++;
  }
  if (f.priceMinMinor !== undefined || f.priceMaxMinor !== undefined) n++;
  return n;
}
