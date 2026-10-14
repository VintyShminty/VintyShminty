"use client";

import {
  type InfiniteData,
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type AddressInput,
  addressSchema,
  type CheckoutQuote,
  checkoutQuoteSchema,
  type DeliveryMethod,
  type Offer,
  type OfferQuota,
  type OrderDetail,
  offerQuotaSchema,
  offerSchema,
  orderDetailSchema,
  orderPageSchema,
} from "@vinty/shared";
import { z } from "zod";
import { clientApi } from "@/lib/api-client";
import { ApiClientError } from "@/lib/api-error";
import { describeApiError } from "@/lib/describe-api-error";
import { orderQuery, patchMessageOffer } from "@/lib/messaging-queries";

// Offers, checkout, addresses and orders on the website. Same keys as the app: ["offer-quota"],
// ["checkout-quote", target, method], ["addresses"], ["orders", role, status], ["order", id].

export { orderQuery };

// ---- Addresses ----

export type Address = z.infer<typeof addressSchema>;
const addressListSchema = z.array(addressSchema);

/** The person's saved delivery addresses, the default first. */
export const addressesQuery = () =>
  queryOptions({
    queryKey: ["addresses"],
    queryFn: () => clientApi<Address[]>("/v1/me/addresses", { schema: addressListSchema }),
  });

/** Input of the address form. `countryCode` is left out to keep the saved one, the default is Israel. */
export type AddressDraft = Omit<AddressInput, "countryCode" | "isDefault"> &
  Partial<Pick<AddressInput, "countryCode" | "isDefault">>;

export function useAddAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressDraft) =>
      clientApi<Address>("/v1/me/addresses", { method: "POST", body: input, schema: addressSchema }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<AddressDraft> & { id: string }) =>
      clientApi<Address>(`/v1/me/addresses/${id}`, { method: "PATCH", body: input, schema: addressSchema }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientApi(`/v1/me/addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

// ---- Offers ----

export const offerQuotaQuery = () =>
  queryOptions({
    queryKey: ["offer-quota"],
    queryFn: () => clientApi<OfferQuota>("/v1/offers/quota", { schema: offerQuotaSchema }),
    staleTime: 10_000,
  });

/** After any offer move: the bubbles, the chat header (the item may be reserved now) and the daily count. */
function refreshAfterOffer(queryClient: QueryClient, offer: Offer) {
  void queryClient.invalidateQueries({ queryKey: ["messages", offer.conversationId] });
  void queryClient.invalidateQueries({ queryKey: ["conversation", offer.conversationId] });
  void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  void queryClient.invalidateQueries({ queryKey: ["offer-quota"] });
}

/** The buyer sends an offer in a chat. */
export function useSendOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, amountMinor }: { conversationId: string; amountMinor: number }) =>
      clientApi<Offer>(`/v1/conversations/${conversationId}/offers`, {
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
      clientApi<Offer>(`/v1/offers/${offerId}/${answer}`, { method: "POST", schema: offerSchema }),
    onSuccess: (offer) => {
      patchMessageOffer(queryClient, offer.conversationId, offer.id, {
        status: offer.status,
        expiresAt: offer.reservedUntil ?? offer.expiresAt,
      });
      refreshAfterOffer(queryClient, offer);
    },
    // A stale bubble (the offer moved on while the page was open) is repaired by reloading it.
    onError: () => void queryClient.invalidateQueries({ queryKey: ["messages"] }),
  });
}

export function useCounterOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, amountMinor }: { offerId: string; amountMinor: number }) =>
      clientApi<Offer>(`/v1/offers/${offerId}/counter`, {
        method: "POST",
        body: { amountMinor },
        schema: offerSchema,
      }),
    onSuccess: (offer) => refreshAfterOffer(queryClient, offer),
    onError: () => void queryClient.invalidateQueries({ queryKey: ["messages"] }),
  });
}

/** Translation key for a refused offer. */
export function offerErrorKey(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === "network") return "errors.network";
    if (err.code === "offer_limit_reached" || err.status === 429) return "offer.errors.limit";
    if (err.code === "listing_unavailable") return "offer.errors.unavailable";
    if (err.code === "conflict") return "offer.errors.pending";
    if (err.code === "invalid_transition") return "offer.errors.closed";
    if (err.code === "forbidden") return "offer.errors.forbidden";
    if (err.fields?.amountMinor === "validation.offer.belowPrice") return "offer.errors.belowPrice";
    if (err.fields?.amountMinor === "validation.offer.positive") return "offer.errors.positive";
  }
  return "errors.general";
}

// ---- Checkout ----

/** What checkout is about: one item, an accepted offer, or a bundle. */
export type CheckoutTarget = { listingId: string } | { offerId: string } | { bundleId: string };

export const targetKey = (target: CheckoutTarget) => Object.entries(target).flat().join(":");

export const checkoutQuoteQuery = (target: CheckoutTarget, deliveryMethod: DeliveryMethod) =>
  queryOptions({
    queryKey: ["checkout-quote", targetKey(target), deliveryMethod],
    queryFn: () =>
      clientApi<CheckoutQuote>("/v1/checkout/quote", {
        method: "POST",
        body: { ...target, deliveryMethod },
        schema: checkoutQuoteSchema,
      }),
    // Money and availability: always ask again when checkout opens.
    staleTime: 0,
    retry: false,
  });

/** After an order was paid: the order, lists, chat and the item pages all change. */
function refreshAfterPay(queryClient: QueryClient, order: OrderDetail) {
  queryClient.setQueryData(["order", order.id], order);
  void queryClient.invalidateQueries({ queryKey: ["orders"] });
  void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  if (order.conversationId) {
    void queryClient.invalidateQueries({ queryKey: ["messages", order.conversationId] });
    void queryClient.invalidateQueries({ queryKey: ["conversation", order.conversationId] });
  }
}

/**
 * Creates the order and pays it. Both calls carry the same Idempotency-Key, so a second click, a retry after a lost
 * answer or two tabs cannot make two orders: the server returns the order that already exists.
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
      const order = await clientApi<OrderDetail>("/v1/orders", {
        method: "POST",
        body: { ...input.target, deliveryMethod: input.deliveryMethod, addressId: input.addressId },
        headers: { "Idempotency-Key": input.key },
        schema: orderDetailSchema,
      });
      if (order.status !== "pending_payment") return order;
      return clientApi<OrderDetail>(`/v1/orders/${order.id}/pay`, {
        method: "POST",
        headers: { "Idempotency-Key": `${input.key}-pay` },
        schema: orderDetailSchema,
      });
    },
    onSuccess: (order) => refreshAfterPay(queryClient, order),
    // Someone else may have bought it, or the price moved: show the truth next time.
    onError: () => void queryClient.invalidateQueries({ queryKey: ["checkout-quote"] }),
  });
}

/** Pays an order that already exists and waits for payment (opened from the order page). */
export function usePayOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, key }: { orderId: string; key: string }) =>
      clientApi<OrderDetail>(`/v1/orders/${orderId}/pay`, {
        method: "POST",
        headers: { "Idempotency-Key": `${key}-pay` },
        schema: orderDetailSchema,
      }),
    onSuccess: (order) => refreshAfterPay(queryClient, order),
    onError: (_err, { orderId }) => void queryClient.invalidateQueries({ queryKey: ["order", orderId] }),
  });
}

// ---- Orders ----

export type OrdersRole = "bought" | "sold";
export type OrdersFilter = "all" | "in_progress" | "completed" | "cancelled";
export type OrdersData = InfiniteData<z.infer<typeof orderPageSchema>, string | undefined>;

/** My orders: one list per tab (bought or sold) and status chip. */
export const ordersQuery = (role: OrdersRole, status: OrdersFilter) =>
  infiniteQueryOptions({
    queryKey: ["orders", role, status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      clientApi(
        `/v1/orders?role=${role}&status=${status}&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        { schema: orderPageSchema },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** After an order moved: keep the open page, refresh the lists and the chat that shows the order. */
export function refreshAfterOrderChange(queryClient: QueryClient, order?: OrderDetail) {
  if (order) queryClient.setQueryData(["order", order.id], order);
  void queryClient.invalidateQueries({ queryKey: ["orders"] });
  void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  if (order?.conversationId) {
    void queryClient.invalidateQueries({ queryKey: ["conversation", order.conversationId] });
    void queryClient.invalidateQueries({ queryKey: ["messages", order.conversationId] });
  }
}

export type OrderStep =
  | { step: "ship" }
  | { step: "confirm-received" }
  | { step: "cancel"; reason?: string }
  | { step: "dispute"; details: string };

/** Ship, confirm, cancel or dispute one order. The answer is the order, which replaces what the page shows. */
export function useOrderStep(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OrderStep) => {
      const body =
        input.step === "cancel"
          ? { reason: input.reason || undefined }
          : input.step === "dispute"
            ? { details: input.details }
            : undefined;
      return clientApi<OrderDetail>(`/v1/orders/${orderId}/${input.step}`, {
        method: "POST",
        body,
        schema: orderDetailSchema,
      });
    },
    onSuccess: (order) => refreshAfterOrderChange(queryClient, order),
    // A refused step (someone else moved the order first) shows the real state again.
    onError: () => void queryClient.invalidateQueries({ queryKey: ["order", orderId] }),
  });
}

/** Translation key for a failed order step. A 409 means the other person moved the order first. */
export function orderErrorKey(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 409) return "orders.changed";
    if (err.status === 403 || err.status === 404) return "orders.notAllowed";
  }
  return describeApiError(err).key;
}

/** A fresh Idempotency-Key for one checkout. */
export function newIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
