"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Bundle, bundleLadderSchema, bundleSchema } from "@vinty/shared";
import { useViewer } from "@/components/site-context";
import { clientApi } from "@/lib/api-client";

/** A seller's ladder and whether their bundles are on. Public, so visitors see the steps too. */
export const bundleLadderQuery = (sellerId: string) =>
  queryOptions({
    queryKey: ["bundle-ladder", sellerId],
    queryFn: () =>
      clientApi(`/v1/users/${encodeURIComponent(sellerId)}/bundle-ladder`, { schema: bundleLadderSchema }),
    staleTime: 60_000,
  });

/** The signed in buyer's open bundle with one seller, or null. Reading it makes nothing. */
export const openBundleQuery = (sellerId: string) =>
  queryOptions({
    queryKey: ["bundle-open", sellerId],
    queryFn: () =>
      clientApi(`/v1/bundles/open?sellerId=${encodeURIComponent(sellerId)}`, {
        schema: bundleSchema.nullable(),
      }),
  });

/** Items of the bundle the buyer can still buy. Sold ones stay listed in the bundle but do not count. */
export const liveBundleItems = (bundle: Bundle | null | undefined) =>
  (bundle?.items ?? []).filter((i) => i.status === "active" || i.status === "reserved");

/**
 * Everything the item page, the cards and the bar need about the viewer's bundle with one seller: the ladder, the open
 * bundle (null when there is none) and add and remove. Adding opens the bundle first when there is none. Every answer
 * from the server replaces the cached bundle, so the box, the cards and the bar stay in step.
 */
export function useSellerBundle(sellerId: string) {
  const viewer = useViewer();
  const queryClient = useQueryClient();
  const ladder = useQuery(bundleLadderQuery(sellerId));
  const open = useQuery({ ...openBundleQuery(sellerId), enabled: viewer !== null });
  const bundle = open.data ?? null;

  const remember = (next: Bundle) => {
    queryClient.setQueryData(["bundle-open", sellerId], next);
    queryClient.setQueryData(["bundle", next.id], next);
  };
  const change = useMutation({
    mutationFn: async ({ listingId, add }: { listingId: string; add: boolean }) => {
      let current = bundle;
      if (!current) {
        if (!add) throw new Error("No bundle to remove from");
        current = await clientApi<Bundle>("/v1/bundles", {
          method: "POST",
          body: { sellerId },
          schema: bundleSchema,
        });
      }
      return clientApi<Bundle>(`/v1/bundles/${current.id}/items/${listingId}`, {
        method: add ? "PUT" : "DELETE",
        schema: bundleSchema,
      });
    },
    onSuccess: remember,
    onError: () => void queryClient.invalidateQueries({ queryKey: ["bundle-open", sellerId] }),
  });

  return {
    ladder: ladder.data ?? null,
    ladderLoading: ladder.isPending,
    bundle,
    bundleLoading: viewer !== null && open.isPending,
    busy: change.isPending,
    failed: change.isError,
    inBundle: (listingId: string) => liveBundleItems(bundle).some((i) => i.listingId === listingId),
    add: (listingId: string) => change.mutate({ listingId, add: true }),
    remove: (listingId: string) => change.mutate({ listingId, add: false }),
  };
}
