import { queryOptions, useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Bundle, type BundleLadder, bundleLadderSchema, bundleSchema } from "@vinty/shared";
import { create } from "zustand";
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
 * Sellers the buyer added an item for since the app opened. The bundle bar shows only for these, so an old bundle
 * never pops a bar up by itself: it appears after an add tap and goes away when the bundle is empty again.
 */
const useBundleBarSellers = create<{ ids: string[]; set: (sellerId: string, on: boolean) => void }>(
  (set) => ({
    ids: [],
    set: (sellerId, on) =>
      set((s) => ({ ids: on ? [...new Set([...s.ids, sellerId])] : s.ids.filter((id) => id !== sellerId) })),
  }),
);

/**
 * Everything the item page, the cards and the bar need about the viewer's bundle with one seller: the ladder, the open
 * bundle (null when there is none) and add and remove. Adding opens the bundle first when there is none. Every answer
 * from the server replaces the cached bundle, so the box, the cards and the bar stay in step. While a change is on its
 * way, inBundle and count already show the result (from any copy of this hook, so a card tap moves the box and the
 * bar at once). Only the bar's saving waits for the server, because it needs the real prices.
 */
export function useSellerBundle(sellerId: string) {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session);
  const queryClient = useQueryClient();
  const ladder = useQuery(bundleLadderQuery(sellerId));
  const open = useQuery({ ...openBundleQuery(sellerId), enabled: signedIn });
  const bundle = open.data ?? null;
  const barArmed = useBundleBarSellers((s) => s.ids.includes(sellerId));
  const setBar = useBundleBarSellers((s) => s.set);

  type Change = { listingId: string; add: boolean };
  const mutationKey = ["bundle-change", sellerId];
  const pending = useMutationState({
    filters: { mutationKey, status: "pending" },
    select: (m) => m.state.variables as Change,
  });

  const change = useMutation({
    mutationKey,
    // The bar shows from the tap, together with the box, not when the server answers.
    onMutate: ({ add }) => {
      if (add) setBar(sellerId, true);
    },
    mutationFn: async ({ listingId, add }: Change) => {
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
    onSuccess: (next, { add }) => {
      if (!add && liveBundleItems(next).length === 0) setBar(sellerId, false);
      queryClient.setQueryData(["bundle-open", sellerId], next);
      queryClient.setQueryData(["bundle", next.id], next);
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: ["bundle-open", sellerId] }),
  });

  const serverHas = (listingId: string) => liveBundleItems(bundle).some((i) => i.listingId === listingId);
  const inBundle = (listingId: string) => {
    const last = pending.filter((c) => c.listingId === listingId).at(-1);
    return last ? last.add : serverHas(listingId);
  };
  const changed = new Set(pending.map((c) => c.listingId));
  let count = liveBundleItems(bundle).length;
  for (const id of changed) count += Number(inBundle(id)) - Number(serverHas(id));

  return {
    signedIn,
    ladder: ladder.data ?? null,
    bundle,
    /** True once the buyer added an item for this seller in this app session, until the bundle is empty. */
    barShown: barArmed && count > 0,
    /** Items in the bundle, counting changes still on their way. */
    count,
    busy: pending.length > 0,
    failed: change.isError,
    inBundle,
    add: (listingId: string) => change.mutate({ listingId, add: true }),
    remove: (listingId: string) => change.mutate({ listingId, add: false }),
  };
}
