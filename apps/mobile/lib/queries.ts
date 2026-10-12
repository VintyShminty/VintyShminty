import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ListingCard,
  listingCardSchema,
  type Me,
  meSchema,
  type NotificationType,
  notificationPreferenceSchema,
  type PublicProfile,
  pageSchema,
  publicProfileSchema,
  type ReviewsPage,
  reviewsPageSchema,
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
