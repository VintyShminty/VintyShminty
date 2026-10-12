import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateReportInput,
  feedPageSchema,
  type ListingDetail,
  listingDetailSchema,
  type PersonalisationSizes,
  personalisationSizesSchema,
  type SavedSearch,
  savedSearchListSchema,
  savedSearchSchema,
} from "@vinty/shared";
import { api } from "@/lib/api";

// Queries for the item page, seller profile, favourites, saved searches, reports and personalisation (Milestone 3).
// Keys agreed with the browse screens: ["listing", id], ["similar", id], ["favourites", q], ["saved-searches"].

const pageQuery = (cursor: string | undefined) =>
  `limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;

/** The item page for anyone. Counts a view on the server, so it is not refetched on every focus. */
export const listingQuery = (id: string) =>
  queryOptions({
    queryKey: ["listing", id],
    queryFn: () => api<ListingDetail>(`/v1/listings/${id}`, { schema: listingDetailSchema }),
    // Another item's page must never show while this one loads.
    placeholderData: undefined,
  });

/** More like this. */
export const similarQuery = (id: string) =>
  infiniteQueryOptions({
    queryKey: ["similar", id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api(`/v1/listings/${id}/similar?${pageQuery(pageParam)}`, { schema: feedPageSchema }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** The hearted items, newest heart first. `q` filters by words. */
export const favouritesQuery = (q: string) =>
  infiniteQueryOptions({
    queryKey: ["favourites", q],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api(`/v1/me/favourites?${pageQuery(pageParam)}${q ? `&q=${encodeURIComponent(q)}` : ""}`, {
        schema: feedPageSchema,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const savedSearchesQuery = () =>
  queryOptions({
    queryKey: ["saved-searches"],
    queryFn: () => api("/v1/me/saved-searches", { schema: savedSearchListSchema }),
  });

export function useUpdateSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notifyOnNew }: { id: string; notifyOnNew: boolean }) =>
      api<SavedSearch>(`/v1/me/saved-searches/${id}`, {
        method: "PATCH",
        body: { notifyOnNew },
        schema: savedSearchSchema,
      }),
    // The switch moves straight away and goes back if the server says no.
    onMutate: async ({ id, notifyOnNew }) => {
      await queryClient.cancelQueries({ queryKey: ["saved-searches"] });
      const previous = queryClient.getQueryData<{ items: SavedSearch[] }>(["saved-searches"]);
      if (previous) {
        queryClient.setQueryData(["saved-searches"], {
          items: previous.items.map((s) => (s.id === id ? { ...s, notifyOnNew } : s)),
        });
      }
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(["saved-searches"], context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/v1/me/saved-searches/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["saved-searches"] });
      const previous = queryClient.getQueryData<{ items: SavedSearch[] }>(["saved-searches"]);
      if (previous) {
        queryClient.setQueryData(["saved-searches"], { items: previous.items.filter((s) => s.id !== id) });
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["saved-searches"], context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
}

/** POST /v1/reports. Sending the same report twice is fine on the server (204 both times). */
export function useReport() {
  return useMutation({
    mutationFn: (input: CreateReportInput) => api("/v1/reports", { method: "POST", body: input }),
  });
}

export const personalisationSizesQuery = () =>
  queryOptions({
    queryKey: ["personalisation-sizes"],
    queryFn: () => api("/v1/me/personalisation/sizes", { schema: personalisationSizesSchema }),
  });

export function useSavePersonalisationSizes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sizeIds: string[]) =>
      api<PersonalisationSizes>("/v1/me/personalisation/sizes", {
        method: "PUT",
        body: { sizeIds },
        schema: personalisationSizesSchema,
      }),
    onMutate: async (sizeIds) => {
      await queryClient.cancelQueries({ queryKey: ["personalisation-sizes"] });
      const previous = queryClient.getQueryData<PersonalisationSizes>(["personalisation-sizes"]);
      queryClient.setQueryData(["personalisation-sizes"], { sizeIds });
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(["personalisation-sizes"], context.previous);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["personalisation-sizes"], data);
      // Your feed is ordered with your sizes in mind.
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}
