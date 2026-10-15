"use client";

import { addressFormSchema } from "@vinty/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, Notice, SubmitButton } from "@/components/auth/fields";
import { PlaceField } from "@/components/place-field";
import { Switch } from "@/components/switch";
import { ApiClientError } from "@/lib/api-error";
import { describeApiError } from "@/lib/describe-api-error";
import { fieldErrors } from "@/lib/form";
import { type Address, useAddAddress, useUpdateAddress } from "@/lib/order-flow-queries";

/**
 * One form for adding and editing a delivery address (same fields and checks as the app). Used in Settings and by
 * checkout. It saves itself (add or change) and tells the parent through `onSaved`.
 */
export function AddressForm({
  address,
  onSaved,
  onCancel,
  submitLabel,
  showDefault = true,
  defaultIsDefault = false,
}: {
  /** Fill the form with this address and save changes to it. Leave out to add a new one. */
  address?: Address;
  onSaved: (address: Address) => void;
  onCancel?: () => void;
  submitLabel?: string;
  showDefault?: boolean;
  defaultIsDefault?: boolean;
}) {
  const { t } = useTranslation();
  const add = useAddAddress();
  const update = useUpdateAddress();
  const [values, setValues] = useState({
    fullName: address?.fullName ?? "",
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? "",
    city: address?.city ?? "",
    postcode: address?.postcode ?? "",
    phone: address?.phone ?? "",
    label: address?.label ?? "",
  });
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? defaultIsDefault);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const pending = add.isPending || update.isPending;
  const set = (key: keyof typeof values) => (value: string) => setValues((v) => ({ ...v, [key]: value }));
  const err = (key: string) => (errors[key] ? t(errors[key]) : undefined);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBanner(null);
    const found = fieldErrors(addressFormSchema, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = {
      fullName: values.fullName.trim(),
      line1: values.line1.trim(),
      line2: values.line2.trim() || null,
      city: values.city.trim(),
      postcode: values.postcode.trim(),
      phone: values.phone.trim() || null,
      label: values.label.trim() || null,
      isDefault,
    };
    try {
      const saved = address
        ? await update.mutateAsync({ id: address.id, ...body })
        : await add.mutateAsync({ ...body, countryCode: "IL" });
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) setErrors(error.fields);
      setBanner(t(describeApiError(error).key));
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-lg">
      {banner ? <Notice kind="error">{banner}</Notice> : null}
      <Field
        label={t("address.fullName")}
        value={values.fullName}
        onChange={set("fullName")}
        error={err("fullName")}
        autoComplete="name"
        maxLength={100}
      />
      <PlaceField
        kind="address"
        onPick={(d) =>
          setValues((v) => ({
            ...v,
            line1: d.line1 || v.line1,
            city: d.city || v.city,
            postcode: d.postcode || v.postcode,
          }))
        }
        label={t("address.line1")}
        value={values.line1}
        onChange={set("line1")}
        error={err("line1")}
        autoComplete="address-line1"
        maxLength={150}
      />
      <Field
        label={t("address.line2")}
        value={values.line2}
        onChange={set("line2")}
        error={err("line2")}
        autoComplete="address-line2"
        maxLength={150}
      />
      <PlaceField
        kind="city"
        label={t("address.city")}
        value={values.city}
        onChange={set("city")}
        error={err("city")}
        autoComplete="address-level2"
        maxLength={80}
      />
      <Field
        label={t("address.postcode")}
        value={values.postcode}
        onChange={set("postcode")}
        error={err("postcode")}
        autoComplete="postal-code"
        inputMode="numeric"
        maxLength={20}
      />
      <Field
        label={t("address.phone")}
        hint={t("address.phoneHint")}
        value={values.phone}
        onChange={set("phone")}
        error={err("phone")}
        type="tel"
        autoComplete="tel"
        maxLength={30}
      />
      <Field
        label={t("address.label")}
        hint={t("address.labelHint")}
        value={values.label}
        onChange={set("label")}
        error={err("label")}
        maxLength={40}
      />
      <div className="flex items-center justify-between gap-md border-y border-border-subtle py-md">
        <span className="text-body text-text-1">{t("address.country")}</span>
        <span className="text-body text-text-3">{t("countries.IL")}</span>
      </div>
      {showDefault ? (
        <div className="flex items-center justify-between gap-md">
          <span className="min-w-0 flex-1 text-body font-medium text-text-1">{t("address.makeDefault")}</span>
          <Switch checked={isDefault} label={t("address.makeDefault")} onChange={setIsDefault} />
        </div>
      ) : null}
      <SubmitButton busy={pending}>{submitLabel ?? t("common.save")}</SubmitButton>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center justify-center rounded-control text-body-sm font-semibold text-text-2 hover:bg-pressed"
        >
          {t("common.cancel")}
        </button>
      ) : null}
    </form>
  );
}
