import {
  type InfiniteData,
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type Brand,
  brandSchema,
  favouriteResultSchema,
  type ListingCard,
  type ListingDetail,
  type ListingDraftInput,
  listingCardSchema,
  listingDetailSchema,
  type Me,
  type MyListingStatus,
  type MyListingsPage,
  meSchema,
  myListingsPageSchema,
  type NotificationType,
  notificationPreferenceSchema,
  type PricePreview,
  type PublicProfile,
  pageSchema,
  pricePreviewSchema,
  publicProfileSchema,
  type ReferenceData,
  type ReviewsPage,
  referenceDataSchema,
  reviewsPageSchema,
  type UpdateListingStatusInput,
  type UpdateProfileInput,
  type UserSettings,
  userSettingsSchema,
} from "@vinty/shared";
import { z } from "zod";
import { api } from "@/lib/api";

// All server data goes through TanStack Query (see lib/query-client.ts). Keys are written out here once.

export const meQuery = () =>
  queryOptions({ queryKey: ["me"], queryFn: () => api("/v1/me", { schema: meSchema }) });

export const settingsQuery = () =>
  queryOptions({
    queryKey: ["settings"],
    queryFn: () => api("/v1/me/settings", { schema: userSettingsSchema }),
  });

const preferenceList = z.array(notificationPreferenceSchema);
export const preferencesQuery = () =>
  queryOptions({
    queryKey: ["notification-preferences"],
    queryFn: () => api("/v1/me/notification-preferences", { schema: preferenceList }),
  });

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: () => api<PublicProfile>(`/v1/users/${userId}`, { schema: publicProfileSchema }),
  });

const listingsPage = pageSchema(listingCardSchema);
export const userListingsQuery = (userId: string, status: "active" | "sold") =>
  infiniteQueryOptions({
    queryKey: ["listings", userId, status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<{ items: ListingCard[]; nextCursor: string | null }>(
        `/v1/users/${userId}/listings?status=${status}&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        { schema: listingsPage },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const userReviewsQuery = (userId: string, source: "all" | "member" | "automatic") =>
  infiniteQueryOptions({
    queryKey: ["reviews", userId, source],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<ReviewsPage>(
        `/v1/users/${userId}/reviews?source=${source}&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        { schema: reviewsPageSchema },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** After a profile change, everything that shows the person is refreshed. */
function useInvalidateProfile() {
  const queryClient = useQueryClient();
  return (userId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["me"] });
    if (userId) void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
  };
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const refresh = useInvalidateProfile();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api<Me>("/v1/me/profile", { method: "PATCH", body: input, schema: meSchema }),
    onSuccess: (me) => {
      queryClient.setQueryData(["me"], me);
      refresh(me.id);
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<UserSettings>) =>
      api<UserSettings>("/v1/me/settings", { method: "PATCH", body: input, schema: userSettingsSchema }),
    // The switch moves straight away, and goes back if the server says no.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["settings"] });
      const previous = queryClient.getQueryData<UserSettings>(["settings"]);
      if (previous) queryClient.setQueryData(["settings"], { ...previous, ...input });
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(["settings"], context.previous);
    },
    onSuccess: (settings) => queryClient.setQueryData(["settings"], settings),
  });
}

type Preference = z.infer<typeof notificationPreferenceSchema>;
export function useUpdatePreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pref: Preference) =>
      api<Preference[]>("/v1/me/notification-preferences", {
        method: "PUT",
        body: { preferences: [pref] },
        schema: preferenceList,
      }),
    onMutate: async (pref) => {
      await queryClient.cancelQueries({ queryKey: ["notification-preferences"] });
      const previous = queryClient.getQueryData<Preference[]>(["notification-preferences"]);
      if (previous) {
        queryClient.setQueryData(
          ["notification-preferences"],
          previous.map((p) => (p.type === pref.type && p.channel === pref.channel ? pref : p)),
        );
      }
      return { previous };
    },
    onError: (_err, _pref, context) => {
      if (context?.previous) queryClient.setQueryData(["notification-preferences"], context.previous);
    },
    onSuccess: (list) => queryClient.setQueryData(["notification-preferences"], list),
  });
}

export function isPreferenceEnabled(
  list: Preference[] | undefined,
  type: NotificationType,
  channel: "push" | "email",
) {
  return list?.find((p) => p.type === type && p.channel === channel)?.enabled ?? true;
}

// ---- Selling (Milestone 2) ----

/** Categories, sizes, conditions and the rest. Changes rarely, so it stays fresh for an hour. */
export const referenceQuery = () =>
  queryOptions({
    queryKey: ["reference"],
    queryFn: () => api<ReferenceData>("/v1/reference", { schema: referenceDataSchema }),
    staleTime: 60 * 60 * 1000,
  });

const brandsPage = pageSchema(brandSchema);
export const brandsQuery = (q: string) =>
  queryOptions({
    queryKey: ["brands", q],
    queryFn: () =>
      api<{ items: Brand[]; nextCursor: string | null }>(`/v1/brands?limit=40&q=${encodeURIComponent(q)}`, {
        schema: brandsPage,
      }),
    staleTime: 10 * 60 * 1000,
  });

export const pricePreviewQuery = (priceMinor: number) =>
  queryOptions({
    queryKey: ["price-preview", priceMinor],
    queryFn: () =>
      api<PricePreview>(`/v1/pricing/preview?priceMinor=${priceMinor}`, { schema: pricePreviewSchema }),
    staleTime: 10 * 60 * 1000,
  });

export const myListingsQuery = (status: MyListingStatus) =>
  infiniteQueryOptions({
    queryKey: ["my-listings", status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<MyListingsPage>(
        `/v1/me/listings?status=${status}&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        { schema: myListingsPageSchema },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const ownListingQuery = (id: string) =>
  queryOptions({
    queryKey: ["own-listing", id],
    queryFn: () => api<ListingDetail>(`/v1/me/listings/${id}`, { schema: listingDetailSchema }),
  });

/** After any listing change: the own list, the item page and the profile numbers are refreshed. */
function useRefreshListings() {
  const queryClient = useQueryClient();
  return (listing?: ListingDetail) => {
    if (listing) queryClient.setQueryData(["own-listing", listing.id], listing);
    void queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    void queryClient.invalidateQueries({ queryKey: ["listings"] });
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
    void queryClient.invalidateQueries({ queryKey: ["me"] });
  };
}

export function useSaveListing() {
  const refresh = useRefreshListings();
  return useMutation({
    mutationFn: ({ id, input, publish }: { id?: string; input: ListingDraftInput; publish: boolean }) => {
      if (!id) {
        return api<ListingDetail>("/v1/listings", {
          method: "POST",
          body: { ...input, publish },
          schema: listingDetailSchema,
        });
      }
      return api<ListingDetail>(`/v1/listings/${id}`, {
        method: "PATCH",
        body: input,
        schema: listingDetailSchema,
      }).then((saved) =>
        publish && saved.status === "draft"
          ? api<ListingDetail>(`/v1/listings/${id}/publish`, { method: "POST", schema: listingDetailSchema })
          : saved,
      );
    },
    onSuccess: (listing) => refresh(listing),
  });
}

export function useListingStatus() {
  const refresh = useRefreshListings();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UpdateListingStatusInput["status"] }) =>
      api<ListingDetail>(`/v1/listings/${id}/status`, {
        method: "PATCH",
        body: { status },
        schema: listingDetailSchema,
      }),
    onSuccess: (listing) => refresh(listing),
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();
  const refresh = useRefreshListings();
  return useMutation({
    mutationFn: (id: string) => api(`/v1/listings/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["own-listing", id] });
      refresh();
    },
  });
}

export function useRequestBrand() {
  return useMutation({
    mutationFn: (name: string) => api("/v1/brand-requests", { method: "POST", body: { name } }),
  });
}

// ---- Discovery (Milestone 3) ----
// Query keys: ["feed", ...], ["search", ...], ["listing", id], ["similar", id], ["favourites", q],
// ["saved-searches"], ["recent-searches"], ["members", q].

/** Hearts or un-hearts a listing. The heart itself moves straight away in the component. */
export function useToggleFavourite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favourite }: { id: string; favourite: boolean }) =>
      api(`/v1/listings/${id}/favourite`, {
        method: favourite ? "PUT" : "DELETE",
        schema: favouriteResultSchema,
      }),
    // Lists of cards are patched in place rather than reloaded, so the Home feed does not reshuffle under your finger.
    onSuccess: ({ favouriteCount }, { id, favourite }) => {
      const patch = (card: ListingCard) =>
        card.id === id ? { ...card, isFavourited: favourite, favouriteCount } : card;
      for (const key of ["feed", "search", "similar", "listings"]) {
        queryClient.setQueriesData<InfiniteData<{ items: ListingCard[] }>>({ queryKey: [key] }, (data) =>
          data?.pages
            ? { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map(patch) })) }
            : data,
        );
      }
      // Taking a heart off removes the card from the Favourites list right away.
      if (!favourite) {
        queryClient.setQueriesData<InfiniteData<{ items: ListingCard[] }>>(
          { queryKey: ["favourites"] },
          (data) =>
            data?.pages
              ? {
                  ...data,
                  pages: data.pages.map((page) => ({
                    ...page,
                    items: page.items.filter((card) => card.id !== id),
                  })),
                }
              : data,
        );
      }
    },
    onSettled: (_data, _err, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["favourites"] });
      void queryClient.invalidateQueries({ queryKey: ["listing", id] });
    },
  });
}
