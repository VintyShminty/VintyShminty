import {
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type AddressInput,
  addressSchema,
  type Balance,
  type BalanceEntry,
  balanceEntryPageSchema,
  balanceEntrySchema,
  balanceSchema,
  type OrderDetail,
  orderDetailSchema,
  orderPageSchema,
  type ReviewItem,
  reviewItemSchema,
} from "@vinty/shared";
import { z } from "zod";
import { ApiClientError, api } from "@/lib/api";
import { describeApiError } from "@/lib/auth-errors";

// Queries and mutations for Milestone 5 (addresses, orders, reviews, balance). Keys:
// ["addresses"], ["orders", role, status], ["order", id], ["balance"], ["balance-entries"].

// ---- Addresses ----

const addressListSchema = z.array(addressSchema);
export type Address = z.infer<typeof addressSchema>;

/** The person's saved delivery addresses, the default first. */
export const addressesQuery = () =>
  queryOptions({
    queryKey: ["addresses"],
    queryFn: () => api<Address[]>("/v1/me/addresses", { schema: addressListSchema }),
  });

/** Input of the address form. `countryCode` is left out to keep the saved one, the default is Israel. */
export type AddressDraft = Omit<AddressInput, "countryCode" | "isDefault"> &
  Partial<Pick<AddressInput, "countryCode" | "isDefault">>;

export function useAddAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressDraft) =>
      api<Address>("/v1/me/addresses", { method: "POST", body: input, schema: addressSchema }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<AddressDraft> & { id: string }) =>
      api<Address>(`/v1/me/addresses/${id}`, { method: "PATCH", body: input, schema: addressSchema }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/v1/me/addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

// ---- Orders ----

export type OrdersRole = "bought" | "sold";
export type OrdersFilter = "all" | "in_progress" | "completed" | "cancelled";

const pageQuery = (cursor: string | undefined, limit = 20) =>
  `limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;

/** My orders: one list per tab (bought or sold) and status chip. */
export const ordersQuery = (role: OrdersRole, status: OrdersFilter) =>
  infiniteQueryOptions({
    queryKey: ["orders", role, status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api(`/v1/orders?role=${role}&status=${status}&${pageQuery(pageParam)}`, { schema: orderPageSchema }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** One order with its timeline, money and the buttons this person can use. */
export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ["order", id],
    queryFn: () => api<OrderDetail>(`/v1/orders/${id}`, { schema: orderDetailSchema }),
    // Another order's page must never show while this one loads.
    placeholderData: undefined,
  });

/** After an order moved: keep the open page, refresh the lists, the balance and the chat that shows the order. */
export function refreshAfterOrderChange(queryClient: QueryClient, order?: OrderDetail) {
  if (order) queryClient.setQueryData(["order", order.id], order);
  void queryClient.invalidateQueries({ queryKey: ["orders"] });
  void queryClient.invalidateQueries({ queryKey: ["balance"] });
  void queryClient.invalidateQueries({ queryKey: ["balance-entries"] });
  void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  void queryClient.invalidateQueries({ queryKey: ["reviews"] });
  void queryClient.invalidateQueries({ queryKey: ["profile"] });
  if (order?.conversationId) {
    void queryClient.invalidateQueries({ queryKey: ["conversation", order.conversationId] });
  }
}

type OrderStep =
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
      return api<OrderDetail>(`/v1/orders/${orderId}/${input.step}`, {
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

/** Development only: the pretend delivery without waiting. */
export function useSimulateDelivery(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<OrderDetail>(`/v1/dev/orders/${orderId}/deliver`, { method: "POST", schema: orderDetailSchema }),
    onSuccess: (order) => refreshAfterOrderChange(queryClient, order),
  });
}

// ---- Reviews ----

export function useLeaveReview(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { rating: number; comment?: string }) =>
      api<ReviewItem>(`/v1/orders/${orderId}/reviews`, {
        method: "POST",
        body: input,
        schema: reviewItemSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useReplyToReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, body }: { reviewId: string; body: string }) =>
      api<ReviewItem>(`/v1/reviews/${reviewId}/reply`, {
        method: "PUT",
        body: { body },
        schema: reviewItemSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

// ---- Balance ----

export const balanceQuery = () =>
  queryOptions({
    queryKey: ["balance"],
    queryFn: () => api<Balance>("/v1/me/balance", { schema: balanceSchema }),
  });

export const balanceEntriesQuery = () =>
  infiniteQueryOptions({
    queryKey: ["balance-entries"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api(`/v1/me/balance/entries?${pageQuery(pageParam, 30)}`, { schema: balanceEntryPageSchema }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** A pretend withdrawal. The same key sent twice makes one row, so a double tap is safe. */
export function useWithdraw() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ amountMinor, key }: { amountMinor: number; key: string }) =>
      api<BalanceEntry>("/v1/me/balance/withdrawals", {
        method: "POST",
        body: { amountMinor },
        headers: { "Idempotency-Key": key },
        schema: balanceEntrySchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["balance"] });
      void queryClient.invalidateQueries({ queryKey: ["balance-entries"] });
    },
  });
}

/** A fresh Idempotency-Key for one attempt (kept while the person retries the same withdrawal). */
export function newIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Translation key for a failed order step. A 409 means the other person moved the order first. */
export function orderErrorKey(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 409) return "orders.changed";
    if (err.status === 403 || err.status === 404) return "orders.notAllowed";
  }
  return describeApiError(err).key;
}
