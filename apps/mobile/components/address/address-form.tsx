import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";
import { z } from "zod";
import { FormInput } from "@/components/form-input";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/ui/row";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { ApiClientError } from "@/lib/api";
import { describeApiError } from "@/lib/auth-errors";
import { type Address, useAddAddress, useUpdateAddress } from "@/lib/orders-queries";

// Messages are translation keys, FormInput translates them.
const addressFormSchema = z.object({
  fullName: z.string().trim().min(1, "validation.address.fullName").max(100, "validation.address.tooLong"),
  line1: z.string().trim().min(1, "validation.address.line1").max(150, "validation.address.tooLong"),
  line2: z.string().trim().max(150, "validation.address.tooLong"),
  city: z.string().trim().min(1, "validation.address.city").max(80, "validation.address.tooLong"),
  postcode: z.string().trim().min(1, "validation.address.postcode").max(20, "validation.address.tooLong"),
  phone: z.string().trim().max(30, "validation.address.tooLong"),
  label: z.string().trim().max(40, "validation.address.tooLong"),
});
type AddressFormValues = z.infer<typeof addressFormSchema>;

type AddressFormProps = {
  /** Fill the form with this address and save changes to it. Leave out to add a new one. */
  address?: Address;
  /** Called with the saved address, after the server said yes. */
  onSaved: (address: Address) => void;
  /** Label of the save button. Defaults to Save. */
  submitLabel?: string;
  /** Shows the "Use as my default address" switch. */
  showDefault?: boolean;
  /** Start the new address as the default one (checkout may want this for a first address). */
  defaultIsDefault?: boolean;
};

/**
 * One form for adding and editing a delivery address. Used in Settings and by checkout. It saves
 * itself (add or change) and tells the parent through `onSaved`.
 */
export function AddressForm({
  address,
  onSaved,
  submitLabel,
  showDefault = true,
  defaultIsDefault = false,
}: AddressFormProps) {
  const { t } = useTranslation();
  const add = useAddAddress();
  const update = useUpdateAddress();
  const [banner, setBanner] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? defaultIsDefault);
  const { control, handleSubmit, setError, formState } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    mode: "onTouched",
    defaultValues: {
      fullName: address?.fullName ?? "",
      line1: address?.line1 ?? "",
      line2: address?.line2 ?? "",
      city: address?.city ?? "",
      postcode: address?.postcode ?? "",
      phone: address?.phone ?? "",
      label: address?.label ?? "",
    },
  });
  const line1 = useRef<TextInput>(null);
  const line2 = useRef<TextInput>(null);
  const city = useRef<TextInput>(null);
  const postcode = useRef<TextInput>(null);
  const phone = useRef<TextInput>(null);
  const label = useRef<TextInput>(null);
  const pending = add.isPending || update.isPending;
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    const body = {
      fullName: values.fullName,
      line1: values.line1,
      line2: values.line2 || null,
      city: values.city,
      postcode: values.postcode,
      phone: values.phone || null,
      label: values.label || null,
      isDefault,
    };
    try {
      const saved = address
        ? await update.mutateAsync({ id: address.id, ...body })
        : await add.mutateAsync({ ...body, countryCode: "IL" });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiClientError && err.fields) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field in addressFormSchema.shape) setError(field as keyof AddressFormValues, { message });
        }
      }
      if (mounted.current) setBanner(t(describeApiError(err).key));
    }
  });

  return (
    <View className="gap-lg">
      {banner ? <Banner variant="error">{banner}</Banner> : null}
      <FormInput
        control={control}
        name="fullName"
        label={t("address.fullName")}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => line1.current?.focus()}
        maxLength={100}
      />
      <FormInput
        control={control}
        name="line1"
        label={t("address.line1")}
        autoComplete="street-address"
        textContentType="streetAddressLine1"
        returnKeyType="next"
        inputRef={line1}
        onSubmitEditing={() => line2.current?.focus()}
        maxLength={150}
      />
      <FormInput
        control={control}
        name="line2"
        label={t("address.line2")}
        textContentType="streetAddressLine2"
        returnKeyType="next"
        inputRef={line2}
        onSubmitEditing={() => city.current?.focus()}
        maxLength={150}
      />
      <FormInput
        control={control}
        name="city"
        label={t("address.city")}
        textContentType="addressCity"
        returnKeyType="next"
        inputRef={city}
        onSubmitEditing={() => postcode.current?.focus()}
        maxLength={80}
      />
      <FormInput
        control={control}
        name="postcode"
        label={t("address.postcode")}
        textContentType="postalCode"
        keyboardType="numbers-and-punctuation"
        returnKeyType="next"
        inputRef={postcode}
        onSubmitEditing={() => phone.current?.focus()}
        maxLength={20}
      />
      <FormInput
        control={control}
        name="phone"
        label={t("address.phone")}
        hint={t("address.phoneHint")}
        textContentType="telephoneNumber"
        keyboardType="phone-pad"
        returnKeyType="next"
        inputRef={phone}
        onSubmitEditing={() => label.current?.focus()}
        maxLength={30}
      />
      <FormInput
        control={control}
        name="label"
        label={t("address.label")}
        hint={t("address.labelHint")}
        returnKeyType="done"
        inputRef={label}
        onSubmitEditing={onSubmit}
        maxLength={40}
      />
      <Row label={t("address.country")} value={t("countries.IL")} chevron={false} last />
      {showDefault ? (
        <View className="flex-row items-center justify-between gap-md">
          <Text weight={500} className="flex-1">
            {t("address.makeDefault")}
          </Text>
          <Switch
            checked={isDefault}
            onCheckedChange={setIsDefault}
            accessibilityLabel={t("address.makeDefault")}
          />
        </View>
      ) : null}
      <Button
        size="lg"
        loading={pending}
        disabled={Boolean(address) && !formState.isDirty && isDefault === address?.isDefault}
        onPress={onSubmit}
      >
        <Text>{submitLabel ?? t("common.save")}</Text>
      </Button>
    </View>
  );
}
