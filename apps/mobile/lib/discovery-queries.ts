import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateSavedSearchInput,
  type FeedMood,
  homeFeedPageSchema,
  membersPageSchema,
  recentSearchListSchema,
  type SearchFilters,
  type SearchPage,
  savedSearchSchema,
  searchCountSchema,
  searchPageSchema,
  suggestionsSchema,
} from "@vinty/shared";
import type { z } from "zod";
import { api } from "@/lib/api";

// Discovery queries for Home, Browse, Search and Filters (Milestone 3). Keys: ["feed", ...], ["search", ...],
// ["members", q], ["recent-searches"], ["saved-searches"]. Cursors are opaque, pass them back unchanged.

const PAGE = 20;

function paging(cursor: string | undefined) {
  return `limit=${PAGE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
}

/** The filters as a query string: id lists as `a,b`, empty values left out. */
export function filtersToQuery(filters: Partial<SearchFilters>): string {
  const parts: string[] = [];
  const add = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== "") parts.push(`${key}=${encodeURIComponent(String(value))}`);
  };
  add("q", filters.q?.trim());
  add("categoryId", filters.categoryId);
  if (filters.categoryIds?.length) add("categoryIds", filters.categoryIds.join(","));
  for (const key of [
    "brandIds",
    "sizeIds",
    "conditionIds",
    "colourIds",
    "materialIds",
    "patternIds",
  ] as const) {
    const ids = filters[key];
    if (ids && ids.length > 0) add(key, ids.join(","));
  }
  add("priceMinMinor", filters.priceMinMinor);
  add("priceMaxMinor", filters.priceMaxMinor);
  add("sellerId", filters.sellerId);
  add("sort", filters.sort);
  return parts.join("&");
}

export type FeedParams = { categoryId?: string; trending?: boolean; mood?: FeedMood };

export const feedQuery = ({ categoryId, trending, mood }: FeedParams) =>
  infiniteQueryOptions({
    queryKey: ["feed", categoryId ?? null, trending ?? false, mood ?? null],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api(
        `/v1/feed?${paging(pageParam)}${categoryId ? `&categoryId=${categoryId}` : ""}${trending ? "&trending=true" : ""}${mood ? `&mood=${mood}` : ""}`,
        { schema: homeFeedPageSchema },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const searchQuery = (filters: Partial<SearchFilters>) =>
  infiniteQueryOptions({
    queryKey: ["search", filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<SearchPage>(`/v1/listings?${filtersToQuery(filters)}&${paging(pageParam)}`, {
        schema: searchPageSchema,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** The number on the Show results button, without loading cards. */
export const searchCountQuery = (filters: Partial<SearchFilters>) =>
  queryOptions({
    queryKey: ["search-count", filters],
    queryFn: () => api(`/v1/listings/count?${filtersToQuery(filters)}`, { schema: searchCountSchema }),
  });

export const suggestionsQuery = (q: string) =>
  queryOptions({
    queryKey: ["suggestions", q],
    queryFn: () => api(`/v1/search/suggestions?q=${encodeURIComponent(q)}`, { schema: suggestionsSchema }),
    enabled: q.length > 0,
    staleTime: 5 * 60 * 1000,
  });

export const membersQuery = (q: string) =>
  infiniteQueryOptions({
    queryKey: ["members", q],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api(`/v1/users?q=${encodeURIComponent(q)}&${paging(pageParam)}`, { schema: membersPageSchema }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: q.length > 0,
  });

export const recentSearchesQuery = () =>
  queryOptions({
    queryKey: ["recent-searches"],
    queryFn: () => api("/v1/me/recent-searches", { schema: recentSearchListSchema }),
    staleTime: 0,
  });

/** Written when a search is submitted. Duplicates move to the top on the server. */
export function useAddRecentSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { queryText: string; filters: Partial<SearchFilters>; resultCount?: number }) =>
      api("/v1/me/recent-searches", {
        method: "POST",
        body: { ...input, filters: { sort: "relevance", ...input.filters, q: undefined } },
      }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["recent-searches"] }),
  });
}

export function useClearRecentSearches() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api("/v1/me/recent-searches", { method: "DELETE" }),
    onMutate: () => {
      queryClient.setQueryData<z.infer<typeof recentSearchListSchema>>(["recent-searches"], { items: [] });
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["recent-searches"] }),
  });
}

/** The bookmark next to the search field. */
export function useSaveSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSavedSearchInput) =>
      api("/v1/me/saved-searches", { method: "POST", body: input, schema: savedSearchSchema }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
}
