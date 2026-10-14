"use client";

import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type Bump,
  type BumpPlans,
  bumpPlansSchema,
  bumpSchema,
  type ListingDetail,
  listingDetailSchema,
  type MyBumpsPage,
  myBumpsPageSchema,
  type UpdateListingStatusInput,
} from "@vinty/shared";
import { clientApi } from "@/lib/api-client";

// Your own listings and Buzz on the website. Same keys as the app: ["my-listings"], ["bump-plans"], ["my-bumps"].

export const bumpPlansQuery = () =>
  queryOptions({
    queryKey: ["bump-plans"],
    queryFn: () => clientApi<BumpPlans>("/v1/bump-plans", { schema: bumpPlansSchema }),
    staleTime: 60 * 60 * 1000,
  });

export const myBumpsQuery = () =>
  infiniteQueryOptions({
    queryKey: ["my-bumps"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      clientApi<MyBumpsPage>(
        `/v1/me/bumps?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        { schema: myBumpsPageSchema },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** After any change to a listing, the own lists, the feed and the numbers on the profile are asked for again. */
function useRefreshListings() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ["my-listings", "listings", "profile", "me", "my-bumps", "feed"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

/** Hide, show again, reserve, unreserve, mark as sold. */
export function useListingStatus() {
  const refresh = useRefreshListings();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UpdateListingStatusInput["status"] }) =>
      clientApi<ListingDetail>(`/v1/listings/${id}/status`, {
        method: "PATCH",
        body: { status },
        schema: listingDetailSchema,
      }),
    onSuccess: refresh,
  });
}

export function useDeleteListing() {
  const refresh = useRefreshListings();
  return useMutation({
    mutationFn: (id: string) => clientApi(`/v1/listings/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useGiveBuzz() {
  const refresh = useRefreshListings();
  return useMutation({
    mutationFn: ({ listingId, planId }: { listingId: string; planId: string }) =>
      clientApi<Bump>(`/v1/listings/${listingId}/bump`, {
        method: "POST",
        body: { planId },
        schema: bumpSchema,
      }),
    onSuccess: refresh,
  });
}
