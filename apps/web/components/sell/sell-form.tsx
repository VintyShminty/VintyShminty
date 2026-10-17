"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  attributeMode,
  type CategoryNode,
  categoryGuesses,
  categoryTrail,
  conditionWords,
  findCategory,
  formatPrice,
  LISTING_COLOURS_MAX,
  LISTING_DESCRIPTION_MAX,
  LISTING_TITLE_MAX,
  type ListingCard,
  type ListingDetail,
  type ListingField,
  type ListingFieldErrors,
  listingDetailSchema,
  listingLimits,
  mergeGuesses,
  photoAssistStatusSchema,
  pricePreviewSchema,
  priceTextToMinor,
  type ReferenceData,
  SELL_HIDDEN_ROOTS,
  type SellGuesses,
  stripHiddenAttributes,
  validateListing,
} from "@vinty/shared";
import { ChevronRight, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, Notice } from "@/components/auth/fields";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ItemCard } from "@/components/item-card";
import { PricePill } from "@/components/price-pill";
import { CategoryDialog } from "@/components/sell/category-dialog";
import { ConditionSlider } from "@/components/sell/condition-slider";
import { ParcelSizes } from "@/components/sell/parcel-sizes";
import { PhotoUploader } from "@/components/sell/photo-uploader";
import { BrandDialog, ColourDialog, type Option, OptionDialog } from "@/components/sell/pickers";
import { clientApi } from "@/lib/api-client";
import { describeApiError } from "@/lib/describe-api-error";
import {
  categoryChoicePatch,
  EMPTY_SELL_VALUES,
  type SellPhoto,
  type SellValues,
  toListingInput,
  valuesFromListing,
} from "@/lib/sell-state";
import { useDebounced } from "@/lib/use-debounced";
import { useSellAssist } from "@/lib/use-sell-assist";
import { cn } from "@/lib/utils";

type Lang = "en" | "he";
type PickerKey = "category" | "brand" | "size" | "colour" | "material" | "pattern";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-md pt-xl first:pt-0">
      <h2 className="text-section-label font-bold uppercase text-text-3">{title}</h2>
      {children}
    </section>
  );
}

/** A row that opens a picker: the label, the chosen value (or the helper's quiet hint) and a chevron. */
function PickerRow({
  label,
  value,
  hint,
  error,
  onClick,
}: {
  label: string;
  value?: string | null;
  hint?: string;
  error?: string;
  onClick: () => void;
}) {
  const id = useId();
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="dialog"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-e` : undefined}
        className={cn(
          "flex min-h-14 w-full items-center gap-md rounded-control border bg-background px-md py-sm text-start hover:bg-surface",
          error ? "border-error" : "border-border",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={value || hint ? "text-card-meta font-semibold text-text-3" : "text-body text-text-3"}
          >
            {label}
          </span>
          {value ? (
            <span className="truncate text-body text-text-1">{value}</span>
          ) : hint ? (
            <span className="truncate text-body text-text-3">{hint}</span>
          ) : null}
        </span>
        <ChevronRight size={18} aria-hidden className="shrink-0 text-text-3 rtl:rotate-180" />
      </button>
      {error ? (
        <p id={`${id}-e`} role="alert" className="mt-xs text-body-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A tappable guess from the photo helper. Nothing is chosen until the seller taps it. */
function GuessChip({ label, onClick, sparkle }: { label: string; onClick: () => void; sparkle?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[29px] items-center gap-xs rounded-full border border-text-4 bg-background px-[13px] text-body-sm text-text-1 hover:bg-pressed"
    >
      {sparkle ? <Sparkles size={14} aria-hidden className="shrink-0 text-text-3" /> : null}
      {label}
    </button>
  );
}

/**
 * The sell form (D-015): photos, the piece, the details, the price with the buyer price, and the parcel size, then
 * Keep as draft and Post it. On a laptop the live price tag card ("How buyers see it") sits at the end, sticky. The same
 * form edits a listing or resumes a draft.
 */
export function SellForm({
  lang,
  reference,
  existing,
  admin = false,
}: {
  lang: Lang;
  reference: ReferenceData;
  existing?: ListingDetail;
  /** The back office edits someone else's listing through the admin routes, and goes back to the admin list. */
  admin?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const name = useCallback(
    (value: { en: string; he: string } | null | undefined) => (value ? value[lang] : ""),
    [lang],
  );
  const limits = listingLimits(reference);

  const [values, setValues] = useState<SellValues>(() => {
    if (existing) return valuesFromListing(existing);
    const first = reference.parcelSizes[0]?.id ?? null;
    return { ...EMPTY_SELL_VALUES, parcelSizeId: first };
  });
  const [errors, setErrors] = useState<ListingFieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "post" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [picker, setPicker] = useState<PickerKey | null>(null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const listingId = existing?.id;
  const editingLive = Boolean(existing) && existing?.status !== "draft";

  const set = useCallback((patch: Partial<SellValues>, field?: ListingField) => {
    setValues((v) => ({ ...v, ...patch }));
    setDirty(true);
    if (field) {
      setErrors((e) => {
        if (!e[field]) return e;
        const next = { ...e };
        delete next[field];
        return next;
      });
    }
  }, []);
  const setPhotos = useCallback((update: React.SetStateAction<SellPhoto[]>) => {
    setValues((v) => ({ ...v, photos: typeof update === "function" ? update(v.photos) : update }));
  }, []);

  // ---- The photo helper (D-028): reads the first photos once, shows guesses, never fills anything. ----
  const assistStatus = useQuery({
    queryKey: ["photo-assist"],
    queryFn: () => clientApi("/v1/sell/assist", { schema: photoAssistStatusSchema }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const photoOn = Boolean(assistStatus.data?.photoAssist) && !existing;
  const textOn = Boolean(assistStatus.data?.textAssist) && !existing;
  const uploading = values.photos.some((p) => p.state === "uploading");
  const {
    suggestion: photoSuggestion,
    textSuggestion,
    tipRows,
    dismissTip,
    onTextBlur,
  } = useSellAssist({
    photoOn,
    textOn,
    lang,
    order: values.photos.map((p) => (p.state === "done" && p.key ? p.key : null)),
    uploading,
    title: values.title,
    description: values.description,
    allChosen: Boolean(
      values.categoryId && values.brand && values.conditionId && values.colourIds.length > 0,
    ),
  });
  // Photo and text guesses together. The pickers show the guesses as they were when the picker opened, so an open list never jumps.
  const suggestion = useMemo(
    () => mergeGuesses(photoSuggestion, textSuggestion),
    [photoSuggestion, textSuggestion],
  );
  const [shown, setShown] = useState<SellGuesses | null>(null);

  const openPicker = (key: PickerKey) => {
    setShown(suggestion);
    setPicker(key);
  };
  const closePicker = () => setPicker(null);

  // ---- Derived ----
  const category = values.categoryId ? findCategory(reference.categories, values.categoryId) : null;
  const trail = values.categoryId ? categoryTrail(reference.categories, values.categoryId) : [];
  const mode = (field: Parameters<typeof attributeMode>[1]) => attributeMode(category, field);
  const priceMinor = priceTextToMinor(values.priceText);
  const err = (field: ListingField) => {
    const key = errors[field];
    return key ? t(key, { min: formatPrice(limits.minPriceMinor, "ILS"), max: limits.maxPhotos }) : undefined;
  };

  const guesses = useMemo(
    () => categoryGuesses(suggestion, reference.categories, SELL_HIDDEN_ROOTS),
    [suggestion, reference.categories],
  );
  const shownGuesses = useMemo(
    () => categoryGuesses(shown, reference.categories, SELL_HIDDEN_ROOTS),
    [shown, reference.categories],
  );

  const sizeOptions: Option[] = useMemo(() => {
    if (!category) return [];
    return reference.sizeGroups
      .filter((g) => category.sizeGroupIds.includes(g.id))
      .flatMap((g) =>
        g.sizes.map((s, i) => ({
          id: s.id,
          label: name(s.name),
          section: i === 0 ? name(g.name) : undefined,
        })),
      );
  }, [category, reference.sizeGroups, name]);
  const sizeLabel = sizeOptions.find((o) => o.id === values.sizeId)?.label;
  const colourNames = values.colourIds
    .map((id) => name(reference.colours.find((c) => c.id === id)?.name))
    .filter(Boolean)
    .join(", ");
  const material = reference.materials.find((m) => m.id === values.materialId);
  const pattern = reference.patterns.find((p) => p.id === values.patternId);
  const recommendedParcel = category?.defaultParcelSizeId ?? reference.parcelSizes[0]?.id ?? null;
  const condition = reference.conditions.find((c) => c.id === values.conditionId);

  // ---- The buyer price, worked out by the server from the fee rule ----
  const debouncedPrice = useDebounced(priceMinor, 300);
  const preview = useQuery({
    queryKey: ["price-preview", debouncedPrice],
    queryFn: () =>
      clientApi(`/v1/pricing/preview?priceMinor=${debouncedPrice}`, { schema: pricePreviewSchema }),
    enabled: debouncedPrice !== null && debouncedPrice > 0,
    staleTime: 10 * 60 * 1000,
  });
  const buyerMinor = priceMinor && priceMinor > 0 ? (preview.data?.buyerPriceMinor ?? null) : null;

  // ---- The live card ----
  const cover = values.photos[0];
  const card: ListingCard = {
    id: "preview",
    status: "active",
    title: values.title.trim() || t("web.sell.preview.untitled"),
    brandName: values.brand?.name ?? null,
    sizeLabel: sizeLabel ?? null,
    conditionSlug: condition?.slug ?? null,
    priceMinor: priceMinor ?? 0,
    buyerPriceMinor: buyerMinor ?? priceMinor ?? 0,
    previousPriceMinor: null,
    currency: "ILS",
    cover: cover
      ? {
          key: cover.key ?? cover.id,
          url: cover.url,
          width: cover.width,
          height: cover.height,
          placeholder: null,
        }
      : null,
    favouriteCount: 0,
    isBumped: false,
  };

  // ---- Saving ----
  const submit = async (publish: boolean, after?: string): Promise<boolean> => {
    setBanner(null);
    if (uploading) {
      setBanner(t("sell.waitForPhotos"));
      return false;
    }
    if (values.photos.some((p) => p.state === "failed")) {
      setBanner(t("web.sell.photos.failed"));
      return false;
    }
    const cleaned = stripHiddenAttributes(
      {
        ...values,
        brandId: values.brand?.id ?? null,
        brandName: values.brand && !values.brand.id ? values.brand.name : null,
        priceMinor,
        photoCount: values.photos.filter((p) => p.state === "done").length,
      },
      category,
    );
    const found = validateListing(cleaned, reference, { publish: publish || editingLive });
    if (values.priceText.trim() !== "" && priceMinor === null)
      found.priceMinor = "validation.listing.price.required";
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setBanner(t("sell.checkFields"));
      return false;
    }
    setBusy(publish ? "post" : "draft");
    try {
      const input = toListingInput({
        ...values,
        brand: cleaned.brandId || cleaned.brandName ? values.brand : null,
      });
      let saved: ListingDetail;
      if (!listingId) {
        saved = await clientApi("/v1/listings", {
          method: "POST",
          body: { ...input, publish },
          schema: listingDetailSchema,
        });
      } else {
        saved = await clientApi(`${admin ? "/v1/admin/listings" : "/v1/listings"}/${listingId}`, {
          method: "PATCH",
          body: input,
          schema: listingDetailSchema,
        });
        if (publish && saved.status === "draft") {
          saved = await clientApi(`/v1/listings/${listingId}/publish`, {
            method: "POST",
            schema: listingDetailSchema,
          });
        }
      }
      setDirty(false);
      dirtyRef.current = false;
      void queryClient.invalidateQueries({ queryKey: [admin ? "admin" : "my-listings"] });
      if (after) router.push(after);
      else if (admin) router.push(`/${lang}/admin/listings`);
      else if (publish || editingLive)
        router.push(`/${lang}/item/${saved.id}?${publish ? "posted=1" : "saved=1"}`);
      else router.push(`/${lang}/profile?status=draft`);
      return true;
    } catch (error) {
      const described = describeApiError(error);
      if (described.fields) setErrors(described.fields as ListingFieldErrors);
      setBanner(t(described.key));
      setBusy(null);
      return false;
    }
  };

  // ---- Leaving with unsaved changes ----
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  const leave = (to: string) => {
    setDirty(false);
    dirtyRef.current = false;
    setLeaveTo(null);
    router.push(to);
  };
  const backHref = admin
    ? `/${lang}/admin/listings`
    : listingId
      ? `/${lang}/item/${listingId}`
      : `/${lang}/profile`;

  const chooseCategory = (leaf: CategoryNode) => {
    set(categoryChoicePatch(values, leaf, reference), "categoryId");
    closePicker();
  };
  const isChosenColour = (id: string) => values.colourIds.includes(id);
  const colourGuesses = (suggestion?.colourIds ?? []).filter(
    (id) => !isChosenColour(id) && reference.colours.some((c) => c.id === id),
  );
  const categoryGuess = values.categoryId ? undefined : guesses[0];
  const brandGuess = values.brand ? null : (suggestion?.brand ?? null);
  const conditionGuess = values.conditionId
    ? null
    : (reference.conditions.find((c) => c.id === suggestion?.conditionId) ?? null);
  const showGuesses =
    (!category && guesses.length > 0) ||
    Boolean(brandGuess) ||
    (Boolean(category) && values.colourIds.length === 0 && colourGuesses.length > 0);

  return (
    <main className="mx-auto w-full max-w-[1080px] px-lg pb-2xl pt-xl">
      <div className="mb-xl flex items-center justify-between gap-md">
        <h1 className="text-title text-text-1">{editingLive ? t("sell.editTitle") : t("sell.title")}</h1>
        <Link href={backHref} className="text-body-sm font-bold text-primary hover:underline">
          {t("common.cancel")}
        </Link>
      </div>

      <div className="grid gap-2xl lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="flex min-w-0 flex-col"
        >
          <Section title={t("sell.photos.title")}>
            <PhotoUploader
              photos={values.photos}
              setPhotos={setPhotos}
              maxPhotos={limits.maxPhotos}
              error={err("photos")}
              onAdded={() => set({}, "photos")}
              onChanged={() => setDirty(true)}
              adminListingId={admin && listingId ? listingId : undefined}
              uploadPath={admin && listingId ? `/v1/admin/listings/${listingId}/uploads` : undefined}
            />
            {tipRows.length > 0 ? (
              <ul className="flex flex-col gap-xs">
                {tipRows.map((row) => (
                  <li key={row.key} className="flex items-center gap-sm text-body-sm text-text-3">
                    <Sparkles size={14} aria-hidden className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      {t(`sell.assist.photoTips.${row.kind}`, { n: row.n })}
                    </span>
                    <button
                      type="button"
                      onClick={() => dismissTip(row.key)}
                      aria-label={t("sell.assist.photoTips.close")}
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-pressed"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section title={t("sell.about")}>
            <Field
              label={t("sell.titleLabel")}
              placeholder={t("sell.titlePlaceholder")}
              value={values.title}
              maxLength={LISTING_TITLE_MAX}
              onChange={(title) => set({ title }, "title")}
              error={err("title")}
              hint={`${values.title.length}/${LISTING_TITLE_MAX}`}
              onBlur={onTextBlur}
            />
            <DescriptionField
              label={t("sell.descriptionLabel")}
              placeholder={t("sell.descriptionPlaceholder")}
              value={values.description}
              onChange={(description) => set({ description }, "description")}
              error={err("description")}
              onBlur={onTextBlur}
            />
          </Section>

          <Section title={t("sell.details")}>
            <PickerRow
              label={t("sell.category")}
              value={trail.length ? name(trail.at(-1)?.name) : null}
              hint={
                categoryGuess ? t("sell.assist.guess", { name: name(categoryGuess.node.name) }) : undefined
              }
              error={err("categoryId")}
              onClick={() => openPicker("category")}
            />
            {showGuesses ? (
              <div className="flex flex-wrap items-center gap-sm">
                <span className="text-card-meta font-semibold uppercase text-text-3">
                  {t("sell.assist.looksLike")}
                </span>
                {!category
                  ? guesses.map((g) => (
                      <GuessChip
                        key={g.node.id}
                        label={name(g.node.name)}
                        onClick={() => set(categoryChoicePatch(values, g.node, reference), "categoryId")}
                      />
                    ))
                  : null}
                {brandGuess ? (
                  <GuessChip
                    label={
                      suggestion?.brandSource === "text"
                        ? t("sell.assist.guessName", { name: brandGuess.name })
                        : t("sell.assist.fromTag", { name: brandGuess.name })
                    }
                    onClick={() => void chooseGuessedBrand(brandGuess)}
                  />
                ) : null}
                {category && mode("colour") !== "hidden" && values.colourIds.length === 0
                  ? colourGuesses.map((id) => (
                      <GuessChip
                        key={id}
                        label={name(reference.colours.find((c) => c.id === id)?.name)}
                        onClick={() => set({ colourIds: [id] }, "colourIds")}
                      />
                    ))
                  : null}
              </div>
            ) : null}
            {category && mode("brand") !== "hidden" ? (
              <PickerRow
                label={t("sell.brand")}
                value={values.brand?.name}
                error={err("brandId")}
                onClick={() => openPicker("brand")}
              />
            ) : null}
            {category && mode("size") !== "hidden" ? (
              <PickerRow
                label={t("sell.size")}
                value={sizeLabel}
                error={err("sizeId")}
                onClick={() => openPicker("size")}
              />
            ) : null}
            {category && mode("condition") !== "hidden" ? (
              <div className="flex flex-col gap-sm">
                <span className="text-body-sm font-semibold text-text-2">{t("sell.condition")}</span>
                {conditionGuess ? (
                  <div>
                    <GuessChip
                      sparkle
                      label={t("sell.assist.guessName", {
                        name: name(conditionWords(conditionGuess, category).name),
                      })}
                      onClick={() => set({ conditionId: conditionGuess.id }, "conditionId")}
                    />
                  </div>
                ) : null}
                <ConditionSlider
                  stops={reference.conditions.map((c) => {
                    const words = conditionWords(c, category);
                    return { id: c.id, label: name(words.name), description: name(words.description) };
                  })}
                  value={values.conditionId}
                  onChange={(conditionId) => set({ conditionId }, "conditionId")}
                  error={err("conditionId")}
                />
              </div>
            ) : null}
            {category && mode("colour") !== "hidden" ? (
              <PickerRow
                label={t("sell.colours")}
                value={colourNames}
                error={err("colourIds")}
                onClick={() => openPicker("colour")}
              />
            ) : null}
            {category && mode("material") !== "hidden" ? (
              <PickerRow
                label={mode("material") === "optional" ? t("sell.materialRecommended") : t("sell.material")}
                value={name(material?.name)}
                error={err("materialId")}
                onClick={() => openPicker("material")}
              />
            ) : null}
            {category && mode("pattern") !== "hidden" ? (
              <PickerRow
                label={t("sell.pattern")}
                value={name(pattern?.name)}
                error={err("patternId")}
                onClick={() => openPicker("pattern")}
              />
            ) : null}
          </Section>

          <Section title={t("sell.pricing")}>
            <PriceField
              label={t("sell.price")}
              value={values.priceText}
              onChange={(priceText) => set({ priceText: priceText.replace(/[^\d.,]/g, "") }, "priceMinor")}
              error={err("priceMinor")}
            />
            {buyerMinor !== null ? (
              <div className="flex flex-col gap-xs" aria-live="polite">
                <PricePill className="self-start" amountMinor={buyerMinor} currency="ILS" />
                <span className="text-card-desc text-text-3">{t("sell.buyerPays")}</span>
              </div>
            ) : null}
          </Section>

          <Section title={t("sell.shipping")}>
            <ParcelSizes
              sizes={reference.parcelSizes}
              selected={values.parcelSizeId}
              recommended={recommendedParcel}
              name={name}
              onSelect={(parcelSizeId) => set({ parcelSizeId, parcelChosen: true }, "parcelSizeId")}
              error={err("parcelSizeId")}
            />
            <p className="text-card-desc text-text-3">{t("sell.buyerPaysPostage")}</p>
          </Section>

          <div className="sticky bottom-0 z-20 -mx-lg mt-xl flex flex-col gap-sm border-t border-border-subtle bg-background px-lg pb-md pt-md lg:static lg:mx-0 lg:border-0 lg:px-0">
            {banner && (banner !== t("sell.checkFields") || Object.keys(errors).length > 0) ? (
              <Notice kind="error">{banner}</Notice>
            ) : null}
            {editingLive ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void submit(false)}
                className="inline-flex h-12 items-center justify-center rounded-control bg-primary px-lg text-body font-semibold text-on-accent hover:opacity-90 disabled:opacity-60"
              >
                {busy ? t("web.sell.saving") : t("sell.saveChanges")}
              </button>
            ) : (
              <div className="flex gap-sm">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void submit(false)}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-control border border-primary px-lg text-body font-semibold text-primary hover:bg-accent-tint disabled:opacity-60"
                >
                  {busy === "draft" ? t("web.sell.saving") : t("sell.saveDraft")}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void submit(true)}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-control bg-primary px-lg text-body font-semibold text-on-accent hover:opacity-90 disabled:opacity-60"
                >
                  {busy === "post" ? t("web.sell.posting") : t("sell.upload")}
                </button>
              </div>
            )}
          </div>
        </form>

        <aside className="hidden lg:block" aria-label={t("web.sell.preview.title")}>
          <div className="sticky top-[88px] flex flex-col gap-md">
            <h2 className="text-section-label font-bold uppercase text-text-3">
              {t("web.sell.preview.title")}
            </h2>
            <div className="pointer-events-none select-none" aria-hidden>
              <ItemCard listing={card} preview />
            </div>
            <p className="text-card-desc text-text-3">{t("web.sell.preview.note")}</p>
          </div>
        </aside>
      </div>

      <CategoryDialog
        open={picker === "category"}
        categories={reference.categories}
        selectedId={values.categoryId}
        guesses={shownGuesses}
        name={name}
        onChoose={chooseCategory}
        onClose={closePicker}
      />
      <BrandDialog
        open={picker === "brand"}
        selected={values.brand}
        fromTag={shown?.brand}
        fromText={shown?.brandSource === "text"}
        onChange={(brand) => set({ brand }, "brandId")}
        onClose={closePicker}
      />
      <OptionDialog
        open={picker === "size"}
        title={t("sell.size")}
        options={sizeOptions}
        selected={values.sizeId}
        clearable={mode("size") === "optional"}
        header={<p className="text-body-sm text-text-3">{t("sell.sizeHint")}</p>}
        onChange={(sizeId) => set({ sizeId }, "sizeId")}
        onClose={closePicker}
      />
      <ColourDialog
        open={picker === "colour"}
        options={reference.colours.map((c) => ({ id: c.id, label: name(c.name), swatch: c.swatchHex }))}
        selected={values.colourIds}
        max={LISTING_COLOURS_MAX}
        suggestedIds={shown?.colourIds}
        onChange={(colourIds) => set({ colourIds }, "colourIds")}
        onClose={closePicker}
      />
      <OptionDialog
        open={picker === "material"}
        title={t("sell.material")}
        options={reference.materials.map((m) => ({ id: m.id, label: name(m.name) }))}
        selected={values.materialId}
        clearable={mode("material") === "optional"}
        onChange={(materialId) => set({ materialId }, "materialId")}
        onClose={closePicker}
      />
      <OptionDialog
        open={picker === "pattern"}
        title={t("sell.pattern")}
        options={reference.patterns.map((p) => ({ id: p.id, label: name(p.name) }))}
        selected={values.patternId}
        clearable={mode("pattern") === "optional"}
        onChange={(patternId) => set({ patternId }, "patternId")}
        onClose={closePicker}
      />

      <ConfirmDialog
        open={leaveTo !== null}
        title={t("web.sell.leaveTitle")}
        confirmLabel={t("sell.closeSave")}
        busy={busy !== null}
        onConfirm={() => {
          const to = leaveTo;
          if (to) void submit(false, to).then((ok) => !ok && setLeaveTo(null));
        }}
        onCancel={() => setLeaveTo(null)}
      >
        <button
          type="button"
          onClick={() => leaveTo && leave(leaveTo)}
          className="mt-md inline-flex h-12 w-full items-center justify-center rounded-control px-lg text-body font-semibold text-error hover:bg-error-tint"
        >
          {t("sell.closeDiscard")}
        </button>
      </ConfirmDialog>
    </main>
  );

  /** A tap on "From the tag" picks the brand, and tells the team when it is one we do not know. */
  async function chooseGuessedBrand(guess: { id: string | null; name: string }) {
    if (guess.id) {
      set({ brand: { id: guess.id, name: guess.name } }, "brandId");
      return;
    }
    const typed = guess.name.replace(/\s+/g, " ").trim().slice(0, 60);
    if (typed.length < 2) return;
    set({ brand: { id: null, name: typed } }, "brandId");
    void clientApi("/v1/brand-requests", { method: "POST", body: { name: typed } }).catch(() => undefined);
  }
}

function DescriptionField({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-xs block text-body-sm font-semibold text-text-2">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={6}
        maxLength={LISTING_DESCRIPTION_MAX}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full rounded-control border bg-background p-md text-body text-text-1 outline-none placeholder:text-text-4 focus:border-primary",
          error ? "border-error" : "border-border",
        )}
      />
      <p className="mt-xs text-end text-card-meta text-text-3">
        {value.length}/{LISTING_DESCRIPTION_MAX}
      </p>
      {error ? (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PriceField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-xs block text-body-sm font-semibold text-text-2">
        {label}
      </label>
      <div
        dir="ltr"
        className={cn(
          "flex h-12 items-center rounded-control border bg-background px-md focus-within:border-primary",
          error ? "border-error" : "border-border",
        )}
      >
        <span aria-hidden className="pe-xs text-body text-text-3">
          ₪
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          maxLength={9}
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          aria-invalid={error ? true : undefined}
          className="min-w-0 flex-1 bg-transparent text-body text-text-1 outline-none placeholder:text-text-4"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-xs text-body-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
