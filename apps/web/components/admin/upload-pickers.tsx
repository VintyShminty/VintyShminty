"use client";

import { useQuery } from "@tanstack/react-query";
import { brandSchema, pageSchema, type ReferenceData } from "@vinty/shared";
import { Check, Search, Sparkles, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { inputClass, quietButton } from "@/components/admin/ui";
import { type LeafOption, searchLeaves } from "@/lib/admin-upload";
import { clientApi } from "@/lib/api-client";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

/** A pop-up with a search box and every category you can list in, shown with its whole path ("Women > Clothing > Dresses"). */
export function CategoryPicker({
  open,
  options,
  selectedId,
  suggestedIds,
  onPick,
  onClose,
}: {
  open: boolean;
  options: LeafOption[];
  selectedId: string | null;
  /** The AI's guesses for this item, shown first. */
  suggestedIds: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      setQuery("");
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const results = useMemo(() => {
    const found = searchLeaves(options, query);
    if (query.trim()) return found;
    const guesses = suggestedIds.flatMap((id) => options.find((o) => o.id === id) ?? []);
    return [...guesses, ...found.filter((o) => !suggestedIds.includes(o.id))];
  }, [options, query, suggestedIds]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(94vw,560px)] rounded-window border-0 bg-background p-0 text-text-1 backdrop:bg-backdrop"
    >
      <div className="flex items-center justify-between gap-md border-b border-border p-lg">
        <h2 id={titleId} className="text-heading font-bold">
          {t("admin.upload.category.title")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-control hover:bg-pressed"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="p-lg">
        <label className="relative block">
          <span className="sr-only">{t("admin.upload.category.search")}</span>
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute start-md top-1/2 -translate-y-1/2 text-text-3"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("admin.upload.category.search")}
            className={cn(inputClass, "w-full ps-[38px]")}
          />
        </label>
        <ul className="mt-md flex max-h-[50vh] flex-col overflow-y-auto">
          {results.length === 0 ? (
            <li className="py-xl text-center text-body-sm text-text-3">{t("admin.upload.category.none")}</li>
          ) : (
            results.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => onPick(option.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-md rounded-control px-md py-sm text-start text-body-sm hover:bg-pressed",
                    option.id === selectedId && "bg-pressed font-semibold",
                  )}
                >
                  <span dir="auto" className="min-w-0 flex-1">
                    {option.path}
                  </span>
                  {suggestedIds.includes(option.id) ? (
                    <span className="inline-flex shrink-0 items-center gap-xs rounded-full bg-accent-tint px-sm py-px text-badge font-semibold text-text-2">
                      <Sparkles size={12} aria-hidden />
                      {t("admin.upload.suggested")}
                    </span>
                  ) : null}
                  {option.id === selectedId ? <Check size={16} aria-hidden className="shrink-0" /> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </dialog>
  );
}

const brandPageSchema = pageSchema(brandSchema);

/**
 * A brand box: type, pick one of our listed brands from the list (it then links to the brand), or leave your own
 * words (a brand we do not list yet is saved as typed).
 */
export function BrandInput({
  brandId,
  text,
  invalid,
  onChange,
}: {
  brandId: string | null;
  text: string;
  invalid?: boolean;
  onChange: (value: { brandId: string | null; brandText: string }) => void;
}) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const q = useDebounced(text.trim(), 200);
  const listId = useId();
  const results = useQuery({
    queryKey: ["brands", q],
    queryFn: () =>
      clientApi(`/v1/brands?${new URLSearchParams({ q, limit: "8" })}`, { schema: brandPageSchema }),
    enabled: focused && q.length > 0 && !brandId,
    staleTime: 600_000,
  });
  const items = results.data?.items ?? [];
  return (
    <div className="relative">
      <input
        type="text"
        value={text}
        onChange={(e) => onChange({ brandId: null, brandText: e.target.value })}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Typing a listed brand's exact name links it, even if the list was never clicked.
          const exact = items.find((b) => b.name.toLowerCase() === text.trim().toLowerCase());
          if (exact && !brandId) onChange({ brandId: exact.id, brandText: exact.name });
          setTimeout(() => setFocused(false), 120);
        }}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        placeholder={t("admin.upload.brandPlaceholder")}
        className={cn(inputClass, "w-full", invalid && "border-error")}
      />
      {brandId ? (
        <Check
          size={14}
          aria-label={t("admin.upload.brandListed")}
          className="pointer-events-none absolute end-md top-1/2 -translate-y-1/2 text-success"
        />
      ) : null}
      {focused && items.length > 0 && !brandId ? (
        <ul
          id={listId}
          className="absolute inset-x-0 top-full z-20 mt-xs max-h-56 overflow-y-auto rounded-control border border-border bg-background shadow-lg"
        >
          {items.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange({ brandId: b.id, brandText: b.name })}
                className="w-full px-md py-sm text-start text-body-sm hover:bg-pressed"
              >
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Up to two colours, shown as swatches. Opens a small list to change them. */
export function ColourPicker({
  reference,
  lang,
  value,
  max,
  invalid,
  onChange,
}: {
  reference: ReferenceData;
  lang: "en" | "he";
  value: string[];
  max: number;
  invalid?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const chosen = value.flatMap((id) => reference.colours.find((c) => c.id === id) ?? []);
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (value.length < max) onChange([...value, id]);
    else onChange([...value.slice(1), id]);
  };
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(inputClass, "flex w-full items-center gap-sm text-start", invalid && "border-error")}
      >
        {chosen.length === 0 ? (
          <span className="text-text-3">{t("admin.upload.colourPlaceholder")}</span>
        ) : (
          chosen.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-xs">
              <span
                aria-hidden
                className="h-4 w-4 rounded-full border border-border"
                style={{ backgroundColor: c.swatchHex }}
              />
              <span className="truncate">{c.name[lang]}</span>
            </span>
          ))
        )}
      </button>
      {open ? (
        <div className="absolute start-0 top-full z-20 mt-xs w-64 rounded-control border border-border bg-background p-sm shadow-lg">
          <ul className="grid grid-cols-2 gap-xs">
            {reference.colours.map((c) => {
              const on = value.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(c.id)}
                    className={cn(
                      "flex w-full items-center gap-sm rounded-control px-sm py-xs text-start text-body-sm hover:bg-pressed",
                      on && "bg-pressed font-semibold",
                    )}
                  >
                    <span
                      aria-hidden
                      className="h-4 w-4 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: c.swatchHex }}
                    />
                    <span className="truncate">{c.name[lang]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-sm flex justify-end">
            <button type="button" onClick={() => setOpen(false)} className={cn(quietButton, "h-8")}>
              {t("common.done")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
