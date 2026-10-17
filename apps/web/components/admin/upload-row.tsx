"use client";

import {
  attributeMode,
  conditionWords,
  findCategory,
  formatMoney,
  LISTING_COLOURS_MAX,
  LISTING_TITLE_MAX,
  listingLimits,
  type ReferenceData,
} from "@vinty/shared";
import type { TFunction } from "i18next";
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, RotateCw, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { type DragEvent, type ReactNode, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { inputClass } from "@/components/admin/ui";
import { BrandInput, CategoryPicker, ColourPicker } from "@/components/admin/upload-pickers";
import {
  imageFilesOf,
  type LeafOption,
  missingFieldNames,
  photoRoom,
  rowProblems,
  sizeOptionsFor,
  type UploadPhoto,
  type UploadRow,
} from "@/lib/admin-upload";
import { cn } from "@/lib/utils";

function PhotoThumb({
  photo,
  onRemove,
  onRetry,
}: {
  photo: UploadPhoto;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="relative h-20 w-16 shrink-0 overflow-hidden rounded-control border border-border bg-pressed">
      {/* A picture from this computer, not worth the image optimiser. */}
      {/* biome-ignore lint/performance/noImgElement: a local blob address */}
      <img src={photo.previewUrl} alt={photo.name} className="h-full w-full object-cover" />
      {photo.status === "uploading" ? (
        <div className="absolute inset-x-0 bottom-0 bg-backdrop p-xs" role="status">
          <div className="h-1 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(6, Math.round(photo.progress * 100))}%` }}
            />
          </div>
          <span className="sr-only">{t("admin.upload.photo.uploading")}</span>
        </div>
      ) : null}
      {photo.status === "error" ? (
        <button
          type="button"
          onClick={onRetry}
          title={photo.error ?? t("admin.upload.photo.failed")}
          aria-label={t("admin.upload.photo.retry")}
          className="absolute inset-0 flex flex-col items-center justify-center gap-xs bg-error-tint text-error"
        >
          <RotateCw size={16} aria-hidden />
          <span className="text-badge font-semibold">{t("admin.upload.photo.retry")}</span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("admin.upload.photo.remove")}
        className="absolute end-xs top-xs inline-flex h-5 w-5 items-center justify-center rounded-full bg-backdrop text-on-accent hover:opacity-90"
      >
        <X size={12} aria-hidden />
      </button>
    </li>
  );
}

/** A labelled field. A single control sits inside a label, a field with several controls (`group`) is a named group. */
function Field({
  label,
  badge,
  className,
  group,
  children,
}: {
  label: string;
  badge?: ReactNode;
  className?: string;
  group?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const caption = (
    <span id={id} className="flex items-center gap-xs text-card-meta font-semibold text-text-3">
      {label}
      {badge}
    </span>
  );
  const classes = cn("flex min-w-0 flex-col gap-xs", className);
  if (group) {
    return (
      <fieldset aria-labelledby={id} className={cn(classes, "m-0 border-0 p-0")}>
        {caption}
        {children}
      </fieldset>
    );
  }
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control arrives as children, which the rule cannot see
    <label className={classes}>
      {caption}
      {children}
    </label>
  );
}

const SuggestedBadge = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-xs rounded-full bg-accent-tint px-sm py-px text-badge font-semibold text-text-2">
    <Sparkles size={11} aria-hidden />
    {label}
  </span>
);

const NotNeeded = ({ label }: { label: string }) => (
  <p className="flex h-10 items-center text-body-sm text-text-4">{label}</p>
);

/** One item of the batch: its photos, a drop target for more photos, and the fields a listing needs. */
export function UploadRowCard({
  row,
  reference,
  lang,
  options,
  onEdit,
  onAddFiles,
  onRemovePhoto,
  onRetryPhoto,
  onRemove,
}: {
  row: UploadRow;
  reference: ReferenceData;
  lang: "en" | "he";
  options: LeafOption[];
  onEdit: (patch: Partial<UploadRow>) => void;
  onAddFiles: (files: File[]) => void;
  onRemovePhoto: (photoId: string) => void;
  onRetryPhoto: (photoId: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const [picking, setPicking] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  if (row.state === "published") {
    return (
      <li className="flex flex-wrap items-center gap-md rounded-window border border-border bg-success-tint p-md">
        <CheckCircle2 size={18} aria-hidden className="shrink-0 text-success" />
        <p dir="auto" className="min-w-0 flex-1 truncate text-body-sm font-semibold text-text-1">
          {row.title}
        </p>
        {row.listingId ? (
          <Link
            href={`/${lang}/item/${row.listingId}`}
            target="_blank"
            className="text-body-sm font-semibold text-text-1 underline"
          >
            {t("admin.upload.viewItem")}
          </Link>
        ) : null}
      </li>
    );
  }

  const category = row.categoryId ? findCategory(reference.categories, row.categoryId) : null;
  const option = options.find((o) => o.id === row.categoryId);
  const problems = rowProblems(row, reference);
  const missing = missingFieldNames(problems);
  const failed = row.failedFields ?? {};
  const bad = (field: string) => Boolean(failed[field]);
  const sizes = sizeOptionsFor(reference, category);
  const mode = (field: "brand" | "size" | "condition" | "colour") => attributeMode(category, field);
  const busy = row.state === "publishing";
  const room = photoRoom(row, reference);
  const uploading = row.photos.some((p) => p.status === "uploading");
  const minPrice = formatMoney(listingLimits(reference).minPriceMinor, "ILS", lang);

  const accepts = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");
  const onDrop = (event: DragEvent) => {
    if (!accepts(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    onAddFiles(imageFilesOf(Array.from(event.dataTransfer.files)));
  };

  const otherGuesses = row.suggestion.categories
    .filter((c) => c.id !== row.categoryId)
    .map((c) => options.find((o) => o.id === c.id))
    .filter((o): o is LeafOption => Boolean(o))
    .slice(0, 2);

  return (
    <li
      onDragOver={(e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      aria-busy={busy}
      className={cn(
        "rounded-window border bg-surface p-md transition-colors",
        dragging ? "border-primary bg-pressed" : row.state === "failed" ? "border-error" : "border-border",
        busy && "opacity-60",
      )}
    >
      <div className="flex flex-col gap-md lg:flex-row">
        <div className="flex shrink-0 flex-col gap-sm lg:w-[240px]">
          <ul className="flex flex-wrap gap-sm">
            {row.photos.map((photo) => (
              <PhotoThumb
                key={photo.id}
                photo={photo}
                onRemove={() => onRemovePhoto(photo.id)}
                onRetry={() => onRetryPhoto(photo.id)}
              />
            ))}
            {room > 0 ? (
              <li>
                <button
                  type="button"
                  onClick={() => picker.current?.click()}
                  aria-label={t("admin.upload.addPhotos")}
                  title={t("admin.upload.dropOnRow")}
                  className="flex h-20 w-16 flex-col items-center justify-center gap-xs rounded-control border border-dashed border-text-4 text-text-3 hover:bg-pressed"
                >
                  <ImagePlus size={18} aria-hidden />
                  <span className="text-badge font-semibold">{t("admin.upload.addMore")}</span>
                </button>
              </li>
            ) : null}
          </ul>
          <input
            ref={picker}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            hidden
            onChange={(e) => {
              onAddFiles(imageFilesOf(Array.from(e.target.files ?? [])).slice(0, room));
              e.target.value = "";
            }}
          />
          <p className="flex items-center gap-xs text-card-meta text-text-3">
            {uploading ? (
              <>
                <Loader2 size={12} aria-hidden className="animate-spin" />
                {t("admin.upload.photo.uploading")}
              </>
            ) : row.suggestion.state === "loading" ? (
              <>
                <Sparkles size={12} aria-hidden className="animate-pulse" />
                {t("admin.upload.reading")}
              </>
            ) : (
              t("admin.upload.photoCount", { n: row.photos.length, max: listingLimits(reference).maxPhotos })
            )}
          </p>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
          <Field label={t("admin.upload.fields.title")} className="xl:col-span-2">
            <input
              type="text"
              value={row.title}
              maxLength={LISTING_TITLE_MAX}
              disabled={busy}
              onChange={(e) => onEdit({ title: e.target.value })}
              dir="auto"
              className={cn(inputClass, "w-full", bad("title") && "border-error")}
            />
          </Field>
          <Field label={t("admin.upload.fields.priceMinor")}>
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute start-md top-1/2 -translate-y-1/2 text-body-sm text-text-3"
              >
                ₪
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={row.priceText}
                disabled={busy}
                onChange={(e) => onEdit({ priceText: e.target.value })}
                className={cn(inputClass, "w-full ps-[28px]", bad("priceMinor") && "border-error")}
              />
            </div>
          </Field>
          <Field label={t("admin.upload.fields.conditionId")}>
            {mode("condition") === "hidden" && category ? (
              <NotNeeded label={t("admin.upload.notNeeded")} />
            ) : (
              <select
                value={row.conditionId ?? ""}
                disabled={busy}
                onChange={(e) => onEdit({ conditionId: e.target.value || null })}
                className={cn(inputClass, "w-full", bad("conditionId") && "border-error")}
              >
                <option value="">{t("admin.upload.choose")}</option>
                {reference.conditions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {conditionWords(c, category).name[lang]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            group
            label={t("admin.upload.fields.categoryId")}
            badge={row.suggested.category ? <SuggestedBadge label={t("admin.upload.suggested")} /> : null}
            className="sm:col-span-2"
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => setPicking(true)}
              className={cn(inputClass, "w-full text-start", bad("categoryId") && "border-error")}
            >
              {option ? (
                <span dir="auto" className="block truncate">
                  {option.path}
                </span>
              ) : (
                <span className="text-text-3">{t("admin.upload.category.choose")}</span>
              )}
            </button>
            {otherGuesses.length > 0 ? (
              <div className="flex flex-wrap gap-xs">
                {otherGuesses.map((guess) => (
                  <button
                    key={guess.id}
                    type="button"
                    disabled={busy}
                    onClick={() => onEdit({ categoryId: guess.id })}
                    title={guess.path}
                    className="inline-flex max-w-full items-center gap-xs rounded-full border border-text-4 px-sm py-px text-badge text-text-2 hover:bg-pressed"
                  >
                    <Sparkles size={11} aria-hidden />
                    <span dir="auto" className="truncate">
                      {guess.path.split(" > ").slice(-2).join(" > ")}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </Field>
          <Field
            label={t("admin.upload.fields.brandId")}
            badge={row.suggested.brand ? <SuggestedBadge label={t("admin.upload.suggested")} /> : null}
          >
            {mode("brand") === "hidden" && category ? (
              <NotNeeded label={t("admin.upload.notNeeded")} />
            ) : (
              <BrandInput
                brandId={row.brandId}
                text={row.brandText}
                invalid={bad("brandId")}
                onChange={(v) => onEdit(v)}
              />
            )}
          </Field>
          <Field label={t("admin.upload.fields.sizeId")}>
            {!category ? (
              <NotNeeded label={t("admin.upload.chooseCategoryFirst")} />
            ) : mode("size") === "hidden" ? (
              <NotNeeded label={t("admin.upload.notNeeded")} />
            ) : (
              <select
                value={row.sizeId ?? ""}
                disabled={busy}
                onChange={(e) => onEdit({ sizeId: e.target.value || null })}
                className={cn(inputClass, "w-full", bad("sizeId") && "border-error")}
              >
                <option value="">{t("admin.upload.choose")}</option>
                {sizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            group
            label={t("admin.upload.fields.colourIds")}
            badge={row.suggested.colours ? <SuggestedBadge label={t("admin.upload.suggested")} /> : null}
          >
            {mode("colour") === "hidden" && category ? (
              <NotNeeded label={t("admin.upload.notNeeded")} />
            ) : (
              <ColourPicker
                reference={reference}
                lang={lang}
                value={row.colourIds}
                max={LISTING_COLOURS_MAX}
                invalid={bad("colourIds")}
                onChange={(colourIds) => onEdit({ colourIds })}
              />
            )}
          </Field>
          <Field label={t("admin.upload.fields.description")} className="xl:col-span-2">
            <input
              type="text"
              value={row.description}
              disabled={busy}
              onChange={(e) => onEdit({ description: e.target.value })}
              dir="auto"
              className={cn(inputClass, "w-full", bad("description") && "border-error")}
            />
          </Field>
          <Field label={t("admin.upload.fields.ownerOverride")}>
            <input
              type="text"
              value={row.ownerOverride}
              disabled={busy}
              placeholder={t("admin.upload.ownerOverridePlaceholder")}
              onChange={(e) => onEdit({ ownerOverride: e.target.value })}
              dir="auto"
              className={cn(inputClass, "w-full", problems.owner && "border-error")}
            />
          </Field>
        </div>

        <div className="flex shrink-0 items-start justify-end lg:flex-col lg:items-end">
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label={t("admin.upload.removeRow")}
            title={t("admin.upload.removeRow")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-control text-text-3 hover:bg-pressed hover:text-error disabled:opacity-60"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-md flex flex-wrap items-center gap-sm text-card-meta">
        {row.state === "failed" && row.error ? (
          <p role="alert" className="inline-flex items-center gap-xs font-semibold text-error">
            <AlertCircle size={14} aria-hidden />
            {t("admin.upload.failedReason", { reason: failedText(row, t, minPrice) })}
          </p>
        ) : problems.any ? (
          <p className="inline-flex items-center gap-xs font-semibold text-warning">
            <AlertCircle size={14} aria-hidden />
            {t("admin.upload.incomplete")}
            {missing.length > 0 ? (
              <span className="font-normal text-text-3">
                {t("admin.upload.missing", {
                  fields: missing.map((f) => t(`admin.upload.fields.${f}`)).join(", "),
                })}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="inline-flex items-center gap-xs font-semibold text-success">
            <CheckCircle2 size={14} aria-hidden />
            {t("admin.upload.ready")}
          </p>
        )}
      </div>

      <CategoryPicker
        open={picking}
        options={options}
        selectedId={row.categoryId}
        suggestedIds={row.suggestion.categories.map((c) => c.id)}
        onPick={(id) => {
          onEdit({ categoryId: id });
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </li>
  );
}

/** The server's reason. A listed field comes as its own words, else the server's sentence. */
function failedText(row: UploadRow, t: TFunction, minPrice: string): string {
  const fields = Object.entries(row.failedFields ?? {});
  if (fields.length === 0) return row.error ?? "";
  return fields
    .map(
      ([field, key]) =>
        `${t(`admin.upload.fields.${field}`, { defaultValue: field })}: ${t(key, { min: minPrice })}`,
    )
    .join(". ");
}
