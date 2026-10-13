import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { AddressLines } from "@/components/checkout/address-card";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Radio } from "@/components/ui/radio";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { ApiClientError } from "@/lib/api";
import { useCheckoutStore } from "@/lib/checkout-store";
import { checkoutAddressesQuery, useCreateCheckoutAddress } from "@/lib/order-flow-queries";
import { cn } from "@/lib/utils";

type Fields = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  phone: string;
};
const EMPTY: Fields = { fullName: "", line1: "", line2: "", city: "", postcode: "", phone: "" };

/** Choose where the parcel goes, or add a new address. The choice goes back to checkout through a small store. */
export default function CheckoutAddress() {
  const { t } = useTranslation();
  const router = useRouter();
  const addresses = useQuery(checkoutAddressesQuery());
  const create = useCreateCheckoutAddress();
  const picked = useCheckoutStore((s) => s.addressId);
  const setPicked = useCheckoutStore((s) => s.setAddressId);
  const list = addresses.data ?? [];
  const current = list.find((a) => a.id === picked) ?? list.find((a) => a.isDefault) ?? list[0];
  const [adding, setAdding] = useState(false);
  const [values, setValues] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const set = (key: keyof Fields) => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = () => {
    const next: Partial<Record<keyof Fields, string>> = {};
    if (!values.fullName.trim()) next.fullName = t("checkout.fields.required");
    if (!values.line1.trim()) next.line1 = t("checkout.fields.required");
    if (!values.city.trim()) next.city = t("checkout.fields.required");
    if (!values.postcode.trim()) next.postcode = t("checkout.fields.required");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBanner(null);
    create.mutate(
      {
        fullName: values.fullName.trim(),
        line1: values.line1.trim(),
        line2: values.line2.trim() || null,
        city: values.city.trim(),
        postcode: values.postcode.trim(),
        phone: values.phone.trim() || null,
        isDefault: list.length === 0,
      },
      {
        onSuccess: (created) => {
          setPicked(created.id);
          router.back();
        },
        onError: (err) =>
          setBanner(
            err instanceof ApiClientError && err.status === 409
              ? t("checkout.fields.tooMany")
              : t("errors.general"),
          ),
      },
    );
  };

  return (
    <Screen>
      <TopBar leading="back" title={adding ? t("checkout.newAddress") : t("checkout.address")} />
      {adding ? (
        <ScreenScroll contentContainerClassName="gap-lg pt-sm">
          <Input
            label={t("checkout.fields.fullName")}
            value={values.fullName}
            onChangeText={set("fullName")}
            error={errors.fullName}
            autoComplete="name"
            textContentType="name"
          />
          <Input
            label={t("checkout.fields.line1")}
            value={values.line1}
            onChangeText={set("line1")}
            error={errors.line1}
            autoComplete="street-address"
            textContentType="streetAddressLine1"
          />
          <Input
            label={t("checkout.fields.line2")}
            value={values.line2}
            onChangeText={set("line2")}
            textContentType="streetAddressLine2"
          />
          <View className="flex-row gap-md">
            <Input
              containerClassName="flex-1"
              label={t("checkout.fields.city")}
              value={values.city}
              onChangeText={set("city")}
              error={errors.city}
              textContentType="addressCity"
            />
            <Input
              containerClassName="flex-1"
              label={t("checkout.fields.postcode")}
              value={values.postcode}
              onChangeText={set("postcode")}
              error={errors.postcode}
              keyboardType="number-pad"
              textContentType="postalCode"
            />
          </View>
          <Input
            label={t("checkout.fields.phone")}
            hint={t("checkout.fields.phoneHint")}
            value={values.phone}
            onChangeText={set("phone")}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
          {banner ? <Banner variant="error">{banner}</Banner> : null}
          <Button size="lg" loading={create.isPending} onPress={save}>
            <Text>{t("checkout.fields.save")}</Text>
          </Button>
          {list.length > 0 ? (
            <Button variant="ghost" onPress={() => setAdding(false)}>
              <Text>{t("common.cancel")}</Text>
            </Button>
          ) : null}
        </ScreenScroll>
      ) : addresses.isPending ? (
        <Spinner size="large" />
      ) : (
        <ScreenScroll contentContainerClassName="gap-md pt-sm">
          {addresses.isError ? <Banner variant="error">{t("errors.loadFailed")}</Banner> : null}
          {list.length === 0 && !addresses.isError ? (
            <Text className="text-text-2">{t("checkout.noAddresses")}</Text>
          ) : null}
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
