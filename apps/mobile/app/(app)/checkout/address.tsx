import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { AddressForm } from "@/components/address/address-form";
import { AddressLines } from "@/components/checkout/address-card";
import { Banner } from "@/components/ui/banner";
import { Icon } from "@/components/ui/icon";
import { Radio } from "@/components/ui/radio";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { useCheckoutStore } from "@/lib/checkout-store";
import { addressesQuery } from "@/lib/orders-queries";
import { cn } from "@/lib/utils";

/**
 * Choose where the parcel goes, or add a new address with the same form Settings uses. Both read the same saved list
 * ("addresses"), so an address added here shows in Settings and the other way round. The choice goes back to checkout
 * through a small store.
 */
export default function CheckoutAddress() {
  const { t } = useTranslation();
  const router = useRouter();
  const addresses = useQuery(addressesQuery());
  const picked = useCheckoutStore((s) => s.addressId);
  const setPicked = useCheckoutStore((s) => s.setAddressId);
  const list = addresses.data ?? [];
  const current = list.find((a) => a.id === picked) ?? list.find((a) => a.isDefault) ?? list[0];
  const [adding, setAdding] = useState(false);

  return (
    <Screen>
      <TopBar leading="back" title={adding ? t("address.addTitle") : t("checkout.address")} />
      {adding || (addresses.isSuccess && list.length === 0) ? (
        <ScreenScroll contentContainerClassName="pt-sm">
          <AddressForm
            defaultIsDefault={list.length === 0}
            onSaved={(created) => {
              setPicked(created.id);
              router.back();
            }}
          />
        </ScreenScroll>
      ) : addresses.isPending ? (
        <Spinner size="large" />
      ) : (
        <ScreenScroll contentContainerClassName="gap-md pt-sm">
          {addresses.isError ? <Banner variant="error">{t("errors.loadFailed")}</Banner> : null}
          {list.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                setPicked(a.id);
                router.back();
              }}
              role="radio"
              accessibilityState={{ checked: current?.id === a.id }}
              className={cn(
                "flex-row items-center gap-md rounded-control border p-md",
                current?.id === a.id ? "border-primary bg-accent-tint" : "border-border active:bg-surface",
              )}
            >
              <View className="flex-1">
                <AddressLines address={a} />
              </View>
              <Radio checked={current?.id === a.id} />
            </Pressable>
          ))}
          <Pressable
            onPress={() => setAdding(true)}
            role="button"
            className="flex-row items-center gap-sm rounded-control border border-dashed border-text-4 p-md active:bg-surface"
          >
            <Icon as={Plus} size={20} className="text-primary" />
            <Text weight={600} className="text-primary">
              {t("checkout.newAddress")}
            </Text>
          </Pressable>
        </ScreenScroll>
      )}
    </Screen>
  );
}
