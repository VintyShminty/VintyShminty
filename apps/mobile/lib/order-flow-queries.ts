import {
  type InfiniteData,
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type Bundle,
  bundleSchema,
  type CheckoutQuote,
  checkoutQuoteSchema,
  type DeliveryMethod,
  type ListingDetail,
  type MessageOffer,
  type Offer,
  type OfferQuota,
  type OrderDetail,
  offerQuotaSchema,
  offerSchema,
  orderDetailSchema,
} from "@vinty/shared";
import { api } from "@/lib/api";
import type { MessagesData } from "@/lib/messaging-queries";

// Queries for offers, checkout and bundles (Milestone 5, buying side). Keys:
// ["offer-quota"], ["checkout-quote", target, method], ["bundle", id].

// ---- Offers ----

export const offerQuotaQuery = () =>
  queryOptions({
    queryKey: ["offer-quota"],
    queryFn: () => api<OfferQuota>("/v1/offers/quota", { schema: offerQuotaSchema }),
    staleTime: 10_000,
  });

/** Changes the offer inside its bubble, in the open thread's cache. Returns nothing when the thread is not loaded. */
export function patchMessageOffer(
  queryClient: QueryClient,
  conversationId: string,
  offerId: string,
  patch: Partial<MessageOffer>,
) {
  queryClient.setQueryData<MessagesData>(
    ["messages", conversationId],
    (old) =>
      old && {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((m) =>
            m.offer?.id === offerId ? { ...m, offer: { ...m.offer, ...patch } } : m,
          ),
        })),
      },
  );
}

/** After any offer move: the bubbles, the chat header (item may be reserved now) and the daily count. */
function refreshAfterOffer(queryClient: QueryClient, offer: Offer) {
  void queryClient.invalidateQueries({ queryKey: ["messages", offer.conversationId] });
  void queryClient.invalidateQueries({ queryKey: ["conversation", offer.conversationId] });
  void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  void queryClient.invalidateQueries({ queryKey: ["offer-quota"] });
  void queryClient.invalidateQueries({ queryKey: ["listing", offer.listingId] });
}

/** The buyer sends an offer in a chat. */
export function useSendOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, amountMinor }: { conversationId: string; amountMinor: number }) =>
      api<Offer>(`/v1/conversations/${conversationId}/offers`, {
        method: "POST",
        body: { amountMinor },
        schema: offerSchema,
      }),
    onSuccess: (offer) => refreshAfterOffer(queryClient, offer),
  });
}

export type OfferAnswer = "accept" | "decline" | "withdraw";

/** Accept, decline or withdraw. The bubble changes straight away from the answer. */
export function useAnswerOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, answer }: { offerId: string; answer: OfferAnswer }) =>
      api<Offer>(`/v1/offers/${offerId}/${answer}`, { method: "POST", schema: offerSchema }),
    onSuccess: (offer) => {
      patchMessageOffer(queryClient, offer.conversationId, offer.id, {
        status: offer.status,
        expiresAt: offer.reservedUntil ?? offer.expiresAt,
      });
      refreshAfterOffer(queryClient, offer);
    },
    // A stale bubble (the offer moved on while the screen was open) is repaired by reloading it.
    onError: () => void queryClient.invalidateQueries({ queryKey: ["messages"] }),
  });
}

export function useCounterOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, amountMinor }: { offerId: string; amountMinor: number }) =>
      api<Offer>(`/v1/offers/${offerId}/counter`, {
        method: "POST",
        body: { amountMinor },
        schema: offerSchema,
      }),
    onSuccess: (offer) => refreshAfterOffer(queryClient, offer),
    onError: () => void queryClient.invalidateQueries({ queryKey: ["messages"] }),
  });
}

// ---- Checkout ----

/** What checkout is about: one item, an accepted offer, or a bundle. */
export type CheckoutTarget = { listingId: string } | { offerId: string } | { bundleId: string };

export const targetKey = (target: CheckoutTarget) => Object.entries(target).flat().join(":");

export const checkoutQuoteQuery = (target: CheckoutTarget, deliveryMethod: DeliveryMethod) =>
  queryOptions({
    queryKey: ["checkout-quote", targetKey(target), deliveryMethod],
    queryFn: () =>
      api<CheckoutQuote>("/v1/checkout/quote", {
        method: "POST",
        body: { ...target, deliveryMethod },
        schema: checkoutQuoteSchema,
      }),
    // Money and availability: always ask again when checkout opens.
    staleTime: 0,
    retry: false,
  });

/** After an order was paid: the order, lists, balance, chat and the item pages all change. */
function refreshAfterPay(queryClient: QueryClient, order: OrderDetail) {
  queryClient.setQueryData(["order", order.id], order);
  void queryClient.invalidateQueries({ queryKey: ["orders"] });
  void queryClient.invalidateQueries({ queryKey: ["balance"] });
  void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  for (const item of order.items) {
    if (item.listingId) void queryClient.invalidateQueries({ queryKey: ["listing", item.listingId] });
  }
  if (order.conversationId) {
    void queryClient.invalidateQueries({ queryKey: ["messages", order.conversationId] });
    void queryClient.invalidateQueries({ queryKey: ["conversation", order.conversationId] });
  }
}

/**
 * Creates the order and pays it. Both calls carry the same Idempotency-Key, so a second tap, a retry after a lost
 * answer or two phones cannot make two orders: the server returns the order that already exists.
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      target: CheckoutTarget;
      deliveryMethod: DeliveryMethod;
      addressId: string | null;
      key: string;
    }) => {
      const order = await api<OrderDetail>("/v1/orders", {
        method: "POST",
        body: { ...input.target, deliveryMethod: input.deliveryMethod, addressId: input.addressId },
        headers: { "Idempotency-Key": input.key },
        schema: orderDetailSchema,
      });
      if (order.status !== "pending_payment") return order;
      return api<OrderDetail>(`/v1/orders/${order.id}/pay`, {
        method: "POST",
        headers: { "Idempotency-Key": `${input.key}-pay` },
        schema: orderDetailSchema,
      });
    },
    onSuccess: (order) => refreshAfterPay(queryClient, order),
    onError: () => {
      // Someone else may have bought it, or the price moved: show the truth next time.
      void queryClient.invalidateQueries({ queryKey: ["checkout-quote"] });
    },
  });
}

/** Pays an order that already exists and waits for payment (opened from the order page). Same key rules as above. */
export function usePayOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, key }: { orderId: string; key: string }) =>
      api<OrderDetail>(`/v1/orders/${orderId}/pay`, {
        method: "POST",
        headers: { "Idempotency-Key": `${key}-pay` },
        schema: orderDetailSchema,
      }),
    onSuccess: (order) => refreshAfterPay(queryClient, order),
    onError: (_err, { orderId }) => void queryClient.invalidateQueries({ queryKey: ["order", orderId] }),
  });
}

// ---- Bundles ----

export const bundleQuery = (id: string) =>
  queryOptions({
    queryKey: ["bundle", id],
    queryFn: () => api<Bundle>(`/v1/bundles/${id}`, { schema: bundleSchema }),
  });

/** Opens the buyer's bundle with this seller (or the one already open). */
export function useOpenBundle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sellerId: string) =>
      api<Bundle>("/v1/bundles", { method: "POST", body: { sellerId }, schema: bundleSchema }),
    onSuccess: (bundle) => {
      queryClient.setQueryData(["bundle", bundle.id], bundle);
      queryClient.setQueryData(["bundle-open", bundle.seller.id], bundle);
    },
  });
}

/** Adds or removes one item. The bundle in the cache is replaced by the server's new totals. */
export function useToggleBundleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bundleId, listingId, add }: { bundleId: string; listingId: string; add: boolean }) =>
      api<Bundle>(`/v1/bundles/${bundleId}/items/${listingId}`, {
        method: add ? "PUT" : "DELETE",
        schema: bundleSchema,
      }),
    onSuccess: (bundle) => {
      queryClient.setQueryData(["bundle", bundle.id], bundle);
      queryClient.setQueryData(["bundle-open", bundle.seller.id], bundle);
    },
    onError: (_err, { bundleId }) => void queryClient.invalidateQueries({ queryKey: ["bundle", bundleId] }),
  });
}

// ---- Live item changes ----

type Walk = { changed: boolean };

/** Rewrites every listing with this id inside a cached value, whatever list it is in. Keeps untouched parts as is. */
function patchValue(
  value: unknown,
  listingId: string,
  patch: { status: string; priceMinor: number | null },
  w: Walk,
) {
  if (Array.isArray(value)) {
    let out: unknown[] | null = null;
    value.forEach((v, i) => {
      const next = patchValue(v, listingId, patch, w);
      if (next !== v) {
        out ??= [...value];
        out[i] = next;
      }
    });
    return out ?? value;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    let out: Record<string, unknown> | null = null;
    const set = (key: string, v: unknown) => {
      out ??= { ...obj };
      out[key] = v;
    };
    if (obj.id === listingId && typeof obj.status === "string" && "title" in obj) {
      if (obj.status !== patch.status) set("status", patch.status);
      if (
        patch.priceMinor !== null &&
        typeof obj.priceMinor === "number" &&
        obj.priceMinor !== patch.priceMinor
      ) {
        set("priceMinor", patch.priceMinor);
      }
    }
    for (const key of Object.keys(obj)) {
      if (key === "photos" || key === "cover" || key === "seller") continue;
      const next = patchValue(obj[key], listingId, patch, w);
      if (next !== obj[key]) set(key, next);
    }
    if (out) w.changed = true;
    return out ?? value;
  }
  return value;
}

/**
 * The server says an item was reserved, sold, released or repriced (`listing:updated`). Every cached list that shows
 * the item (feed, search, favourites, profiles, similar items, chat headers) is patched in place, and the item page is
 * asked again because what the viewer may do (buy, offer) depends on the new state.
 */
export function applyListingUpdate(
  queryClient: QueryClient,
  update: { listingId: string; status: string; priceMinor: number | null },
) {
  const patch = { status: update.status, priceMinor: update.priceMinor };
  for (const query of queryClient.getQueryCache().getAll()) {
    const key = query.queryKey[0];
    if (key === "listing" || typeof key !== "string") continue;
    const data = query.state.data as InfiniteData<unknown> | undefined;
    if (!data) continue;
    const w: Walk = { changed: false };
    const next = patchValue(data, update.listingId, patch, w);
    if (w.changed) queryClient.setQueryData(query.queryKey, next);
  }
  queryClient.setQueryData<ListingDetail>(["listing", update.listingId], (old) =>
    old
      ? {
          ...old,
          status: update.status as ListingDetail["status"],
          priceMinor: update.priceMinor ?? old.priceMinor,
        }
      : old,
  );
  void queryClient.invalidateQueries({ queryKey: ["listing", update.listingId] });
}
