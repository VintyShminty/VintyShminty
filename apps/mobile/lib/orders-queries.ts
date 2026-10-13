import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { type AddressInput, addressSchema } from "@vinty/shared";
import { z } from "zod";
import { api } from "@/lib/api";

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
