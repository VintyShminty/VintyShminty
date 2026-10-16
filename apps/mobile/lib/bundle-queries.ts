import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Bundle, type BundleLadder, bundleLadderSchema, bundleSchema } from "@vinty/shared";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

/** A seller's ladder and whether their bundles are on. Public. */
export const bundleLadderQuery = (sellerId: string) =>
  queryOptions({
    queryKey: ["bundle-ladder", sellerId],
    queryFn: () => api(`/v1/users/${sellerId}/bundle-ladder`, { schema: bundleLadderSchema }),
    staleTime: 60_000,
  });

/** The signed in buyer's open bundle with one seller, or null. Reading it makes nothing. */
export const openBundleQuery = (sellerId: string) =>
  queryOptions({
    queryKey: ["bundle-open", sellerId],
    queryFn: () =>
      api(`/v1/bundles/open?sellerId=${sellerId}`, {
        schema: bundleSchema.nullable(),
      }),
  });

/** Your own ladder for Settings, Bundles. It keeps the saved steps while the switch is off. */
export const ownBundleLadderQuery = () =>
  queryOptions({
    queryKey: ["own-bundle-ladder"],
    queryFn: () => api("/v1/me/bundle-ladder", { schema: bundleLadderSchema }),
  });

/** Saves the switch and the steps together. */
export function useSaveBundleLadder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { on: boolean; tiers: BundleLadder["tiers"] }) =>
      api("/v1/me/bundle-ladder", { method: "PUT", body: input, schema: bundleLadderSchema }),
    onSuccess: (ladder) => {
      queryClient.setQueryData(["own-bundle-ladder"], ladder);
      void queryClient.invalidateQueries({ queryKey: ["bundle-ladder"] });
    },
  });
}

/** Items of the bundle the buyer can still buy. Sold ones stay listed in the bundle but do not count. */
export const liveBundleItems = (bundle: Bundle | null | undefined) =>
  (bundle?.items ?? []).filter((i) => i.status === "active" || i.status === "reserved");

/**
 * Everything the item page, the cards and the bar need about the viewer's bundle with one seller: the ladder, the open
 * bundle (null when there is none) and add and remove. Adding opens the bundle first when there is none. Every answer
 * from the server replaces the cached bundle, so the box, the cards and the bar stay in step.
 */
export function useSellerBundle(sellerId: string) {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session);
  const queryClient = useQueryClient();
  const ladder = useQuery(bundleLadderQuery(sellerId));
  const open = useQuery({ ...openBundleQuery(sellerId), enabled: signedIn });
  const bundle = open.data ?? null;

  const change = useMutation({
    mutationFn: async ({ listingId, add }: { listingId: string; add: boolean }) => {
      let current = bundle;
      if (!current) {
        if (!add) throw new Error("No bundle to remove from");
        current = await api<Bundle>("/v1/bundles", {
          method: "POST",
          body: { sellerId },
          schema: bundleSchema,
        });
      }
      return api<Bundle>(`/v1/bundles/${current.id}/items/${listingId}`, {
        method: add ? "PUT" : "DELETE",
        schema: bundleSchema,
      });
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["bundle-open", sellerId], next);
      queryClient.setQueryData(["bundle", next.id], next);
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: ["bundle-open", sellerId] }),
  });

  return {
    signedIn,
    ladder: ladder.data ?? null,
    bundle,
    busy: change.isPending,
    failed: change.isError,
    inBundle: (listingId: string) => liveBundleItems(bundle).some((i) => i.listingId === listingId),
    add: (listingId: string) => change.mutate({ listingId, add: true }),
    remove: (listingId: string) => change.mutate({ listingId, add: false }),
  };
}
