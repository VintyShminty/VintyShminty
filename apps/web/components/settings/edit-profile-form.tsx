"use client";

import { BIO_MAX, editProfileFormSchema } from "@vinty/shared";
import { Camera } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, Notice, SubmitButton, TextButton } from "@/components/auth/fields";
import { SellerAvatar } from "@/components/seller-avatar";
import { clientApi } from "@/lib/api-client";
import { uploadAvatar } from "@/lib/avatar-upload";
import { describeApiError } from "@/lib/describe-api-error";
import { fieldErrors } from "@/lib/form";

type Photo = { previewUrl: string | null; key: string | null };

/**
 * Settings, Your profile: photo, name, about you and city, like the app. The photo is uploaded as soon as it is picked
 * (resized in the browser, then straight to storage) and saved on the profile with the Save button. Username and
 * language are rows to their own pages.
 */
export function EditProfileForm({
  lang,
  initial,
}: {
  lang: string;
  initial: { name: string; bio: string; city: string; username: string | null; avatarUrl: string | null };
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const bioId = useId();
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [city, setCity] = useState(initial.city);
  // null: unchanged. { key: null }: the photo is to be removed.
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const avatarUrl = photo ? photo.previewUrl : initial.avatarUrl;
  const dirty =
    (photo !== null && !saved) || name !== initial.name || bio !== initial.bio || city !== initial.city;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBanner(null);
    setSaved(false);
    setUploading(true);
    try {
      const { upload, previewUrl } = await uploadAvatar(file);
      setPhoto({ previewUrl, key: upload.key });
    } catch {
      setBanner(t("editProfile.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBanner(null);
    setSaved(false);
    const found = fieldErrors(editProfileFormSchema, { name, bio, city });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await clientApi("/v1/me/profile", {
        method: "PATCH",
        body: {
          name: name.trim(),
          bio: bio.trim() === "" ? null : bio.trim(),
          city: city.trim() === "" ? null : city.trim(),
          ...(photo ? { avatarKey: photo.key } : {}),
        },
      });
      setSaved(true);
      // The top bar and the profile page ask the server again, so the new photo and name show up.
      router.refresh();
    } catch (error) {
      setBanner(t(describeApiError(error).key));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-lg">
      {banner ? <Notice kind="error">{banner}</Notice> : null}
      {saved ? <Notice kind="success">{t("web.settings.saved")}</Notice> : null}
      <div className="flex items-center gap-lg">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          aria-label={t("editProfile.changePhoto")}
          className="relative rounded-full"
        >
          <SellerAvatar url={avatarUrl} name={initial.username ?? name} size={96} />
          <span className="absolute bottom-0 end-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-on-accent">
            <Camera size={16} aria-hidden />
          </span>
        </button>
        <div className="flex flex-col items-start gap-xs">
          <TextButton onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? t("editProfile.uploading") : t("editProfile.changePhoto")}
          </TextButton>
          {avatarUrl ? (
            <TextButton
              onClick={() => {
                setSaved(false);
                setPhoto({ previewUrl: null, key: null });
              }}
              disabled={uploading}
            >
              {t("editProfile.removePhoto")}
            </TextButton>
          ) : null}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </div>

      <Field
        label={t("fields.displayName")}
        name="name"
        autoComplete="name"
        value={name}
        onChange={(value) => {
          setName(value);
          setSaved(false);
        }}
        error={errors.name ? t(errors.name) : undefined}
      />
      <div>
        <label htmlFor={bioId} className="mb-xs block text-body-sm font-semibold text-text-2">
          {t("fields.about")}
        </label>
        <textarea
          id={bioId}
          value={bio}
          maxLength={BIO_MAX}
          rows={5}
          placeholder={t("fields.aboutPlaceholder")}
          onChange={(e) => {
            setBio(e.target.value);
            setSaved(false);
          }}
          aria-invalid={errors.bio ? true : undefined}
          className="w-full rounded-control border border-border bg-background p-md text-body text-text-1 outline-none placeholder:text-text-4 focus:border-primary"
        />
        <p className="mt-xs text-end text-card-meta text-text-3">
          {bio.length}/{BIO_MAX}
        </p>
        {errors.bio ? <p className="text-body-sm text-error">{t(errors.bio)}</p> : null}
      </div>
      <Field
        label={t("fields.city")}
        name="city"
        autoComplete="address-level2"
        value={city}
        onChange={(value) => {
          setCity(value);
          setSaved(false);
        }}
        error={errors.city ? t(errors.city) : undefined}
      />

      <div className="flex flex-col border-y border-border-subtle">
        <Link
          href={`/${lang}/settings/account/username`}
          className="flex min-h-12 items-center justify-between gap-md text-body-sm hover:text-primary focus-visible:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        >
          <span className="font-semibold text-text-1">{t("fields.username")}</span>
          <span className="truncate text-text-3">{initial.username}</span>
        </Link>
        <Link
          href={`/${lang}/settings/language`}
          className="flex min-h-12 items-center justify-between gap-md border-t border-border-subtle text-body-sm hover:text-primary focus-visible:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        >
          <span className="font-semibold text-text-1">{t("settings.language")}</span>
          <span className="text-text-3">{t(`languages.${lang}`)}</span>
        </Link>
      </div>

      <SubmitButton busy={busy} disabled={!dirty || uploading}>
        {t("editProfile.save")}
      </SubmitButton>
    </form>
  );
}
