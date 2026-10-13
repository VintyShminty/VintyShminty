import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type Bump,
  type BumpPlans,
  bumpPlansSchema,
  bumpSchema,
  type MyBumpsPage,
  myBumpsPageSchema,
} from "@vinty/shared";
import { api } from "@/lib/api";

// Buzz (Milestone 9). Keys: ["bump-plans"], ["my-bumps"].

export const bumpPlansQuery = () =>
  queryOptions({
    queryKey: ["bump-plans"],
    queryFn: () => api<BumpPlans>("/v1/bump-plans", { schema: bumpPlansSchema }),
    staleTime: 60 * 60 * 1000,
  });

export const myBumpsQuery = () =>
  infiniteQueryOptions({
    queryKey: ["my-bumps"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<MyBumpsPage>(
        `/v1/me/bumps?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        {
          schema: myBumpsPageSchema,
        },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** Gives an item buzz, then refreshes the item, the own lists, the feed and the list of buzzes. */
export function useGiveBuzz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, planId }: { listingId: string; planId: string }) =>
      api<Bump>(`/v1/listings/${listingId}/bump`, { method: "POST", body: { planId }, schema: bumpSchema }),
    onSuccess: (_bump, { listingId }) => {
      void queryClient.invalidateQueries({ queryKey: ["own-listing", listingId] });
      void queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      void queryClient.invalidateQueries({ queryKey: ["my-bumps"] });
      void queryClient.invalidateQueries({ queryKey: ["listing"] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}
