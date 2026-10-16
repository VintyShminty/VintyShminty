import { type InfiniteData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type FeedCard,
  type HideInput,
  type HomeFeedPage,
  hiddenItemSchema,
  hiddenListSchema,
  type OnboardingPick,
  type ShopsFor,
  shopsForSchema,
} from "@vinty/shared";
import type { z } from "zod";
import { api } from "@/lib/api";

// Home feed controls (Milestone 7): Not interested, the hidden list, Reset my recommendations and the sign up picks.
// Keys: ["feed", ...] (the feed itself, see discovery-queries.ts), ["feed-hidden"].

type HiddenList = z.infer<typeof hiddenListSchema>;

/** Cards that go away at once when the person says Not interested. */
export type HideTarget = { input: HideInput; matches: (card: FeedCard) => boolean };

/** Takes cards out of every cached feed page (Home keeps its place and nothing else moves). */
export function removeFromFeed(
  data: InfiniteData<HomeFeedPage> | undefined,
  matches: (card: FeedCard) => boolean,
): InfiniteData<HomeFeedPage> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.filter((c) => !matches(c)) })),
  };
}

export function useHideFromFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input }: HideTarget) =>
      api("/v1/feed/hide", { method: "POST", body: input, schema: hiddenItemSchema }),
    onMutate: ({ matches }) => {
      queryClient.setQueriesData<InfiniteData<HomeFeedPage>>({ queryKey: ["feed"] }, (data) =>
        removeFromFeed(data, matches),
      );
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["feed-hidden"] }),
  });
}

export const hiddenQuery = () =>
  queryOptions({
    queryKey: ["feed-hidden"],
    queryFn: () => api("/v1/feed/hidden", { schema: hiddenListSchema }),
  });

export function useUndoHide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/v1/feed/hidden/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["feed-hidden"] });
      const previous = queryClient.getQueryData<HiddenList>(["feed-hidden"]);
      if (previous) {
        queryClient.setQueryData<HiddenList>(["feed-hidden"], {
          items: previous.items.filter((item) => item.id !== id),
        });
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["feed-hidden"], context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed-hidden"] });
      // Home shows the item again the next time the list is built (pull to refresh), not in the middle of a scroll.
      void queryClient.invalidateQueries({ queryKey: ["feed"], refetchType: "none" });
    },
  });
}

/** Reset my recommendations: forgets what the app learned. Hearts, sizes, follows and hides stay. */
export function useResetRecommendations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api("/v1/me/personalisation", { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["feed"] }),
  });
}

/** Sign up question one. An empty list is a skip. */
export function useSaveOnboardingPicks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (picks: OnboardingPick[]) =>
      api("/v1/me/onboarding-picks", { method: "POST", body: { picks } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["shops-for"] });
    },
  });
}

/** What the person shops for (Women, Men, Kids), kept as a setting. Home and search show these first. */
export const shopsForQuery = () =>
  queryOptions({
    queryKey: ["shops-for"],
    queryFn: () => api("/v1/me/personalisation/shops-for", { schema: shopsForSchema }),
  });

export function useSaveShopsFor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shopsFor: OnboardingPick[]) =>
      api<ShopsFor>("/v1/me/personalisation/shops-for", {
        method: "PUT",
        body: { shopsFor },
        schema: shopsForSchema,
      }),
    onMutate: async (shopsFor) => {
      await queryClient.cancelQueries({ queryKey: ["shops-for"] });
      const previous = queryClient.getQueryData<ShopsFor>(["shops-for"]);
      queryClient.setQueryData<ShopsFor>(["shops-for"], { shopsFor });
      return { previous };
    },
    onError: (_err, _picks, context) => {
      if (context?.previous) queryClient.setQueryData(["shops-for"], context.previous);
    },
    // Home builds a new list with the new groups.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["feed"] }),
  });
}
