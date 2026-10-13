import { create } from "zustand";

// The address picked on the address screen travels back to checkout through here (small app state).
type CheckoutState = {
  addressId: string | null;
  setAddressId: (id: string | null) => void;
};

export const useCheckoutStore = create<CheckoutState>((set) => ({
  addressId: null,
  setAddressId: (addressId) => set({ addressId }),
}));
