"use client";

import { useQuery } from "@tanstack/react-query";
import { type Brand, brandSchema, cleanBrandName, pageSchema } from "@vinty/shared";
import { Check, Search } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PickerDialog, RadioRow } from "@/components/sell/picker-dialog";
import { clientApi } from "@/lib/api-client";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

const brandsPage = pageSchema(brandSchema);

function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="flex h-11 items-center gap-sm rounded-bar border border-border bg-surface px-md focus-within:border-primary">
      <Search size={18} aria-hidden className="shrink-0 text-text-3" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-body text-text-1 outline-none placeholder:text-text-4"
      />
    </label>
  );
}

type BrandChoice = { id: string | null; name: string };

/** Brand picker: a search, the most popular brands when empty, and a Use "text" row when nothing fits. */
export function BrandDialog({
  open,
  selected,
  fromTag,
  onChange,
  onClose,
}: {
  open: boolean;
  selected: BrandChoice | null;
  /** The brand the photo helper read from a tag. Shown first, never picked for the seller. */
  fromTag?: BrandChoice | null;
  onChange: (brand: BrandChoice | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) setText("");
  }, [open]);
  const q = useDebounced(cleanBrandName(text));
  const brands = useQuery({
    queryKey: ["brands", q],
    queryFn: () => clientApi(`/v1/brands?limit=40&q=${encodeURIComponent(q)}`, { schema: brandsPage }),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });
  const items: Brand[] = brands.data?.items ?? [];
  const exact = items.some((b) => b.name.toLowerCase() === q.toLowerCase());
  const canUseText = q.length >= 2 && q.length <= 60 && !exact && !brands.isFetching;

  /** Keeps the typed brand on the listing, and quietly tells the team so popular ones can join the list. */
  const chooseTyped = (name: string) => {
    onChange({ id: null, name });
    void clientApi("/v1/brand-requests", { method: "POST", body: { name } }).catch(() => undefined);
    onClose();
  };
  const pick = (brand: BrandChoice) => {
    onChange(brand);
    onClose();
  };

  return (
    <PickerDialog
      open={open}
      title={t("sell.brand")}
      onClose={onClose}
      action={
        selected
          ? {
              label: t("sell.clear"),
              onClick: () => {
                onChange(null);
                onClose();
              },
            }
          : undefined
      }
    >
      <div className="px-lg pb-sm pt-md">
        <SearchBox value={text} onChange={setText} label={t("sell.searchBrands")} />
      </div>
      <div role="radiogroup" aria-label={t("sell.brand")} aria-busy={brands.isFetching}>
        {q !== "" ? (
          canUseText ? (
            <button
              type="button"
              onClick={() => chooseTyped(q)}
              className="flex min-h-14 w-full items-center border-b border-border-subtle px-lg text-start text-body font-semibold hover:bg-surface"
            >
              {t("sell.useBrand", { name: q })}
            </button>
          ) : null
        ) : (
          <>
            {fromTag ? (
              <button
                type="button"
                onClick={() => {
                  if (fromTag.id) pick({ id: fromTag.id, name: fromTag.name });
                  else if (cleanBrandName(fromTag.name).length >= 2)
                    chooseTyped(cleanBrandName(fromTag.name).slice(0, 60));
                }}
                className="flex min-h-14 w-full items-center border-b border-border-subtle px-lg text-start text-body font-semibold hover:bg-surface"
              >
                {t("sell.assist.fromTag", { name: fromTag.name })}
              </button>
            ) : null}
            <h3 className="px-lg pb-sm pt-sm text-section-label font-bold uppercase text-text-3">
              {t("sell.popularBrands")}
            </h3>
          </>
        )}
        {items.map((b) => (
          <RadioRow
            key={b.id}
            label={b.name}
            on={Boolean(selected?.id) && selected?.id === b.id}
            onClick={() => pick({ id: b.id, name: b.name })}
          />
        ))}
        {q.length >= 2 && !exact && !brands.isFetching && items.length === 0 ? (
          <p className="px-lg pt-lg text-body-sm text-text-3">{t("sell.noBrands")}</p>
        ) : null}
      </div>
    </PickerDialog>
  );
}

export type Option = { id: string; label: string; section?: string };

/** A single choice list (size, material, pattern). Sections show as small headings. */
export function OptionDialog({
  open,
  title,
  options,
  selected,
  clearable,
  header,
  onChange,
  onClose,
}: {
  open: boolean;
  title: string;
  options: Option[];
  selected: string | null;
  clearable?: boolean;
  header?: ReactNode;
  onChange: (id: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <PickerDialog
      open={open}
      title={title}
      onClose={onClose}
      action={
        clearable && selected
          ? {
              label: t("sell.clear"),
              onClick: () => {
                onChange(null);
                onClose();
              },
            }
          : undefined
      }
    >
      {header ? <div className="px-lg pt-md">{header}</div> : null}
      <div role="radiogroup" aria-label={title}>
        {options.map((o) => (
          <div key={o.id}>
            {o.section ? (
              <h3 className="px-lg pb-sm pt-lg text-section-label font-bold uppercase text-text-3">
                {o.section}
              </h3>
            ) : null}
            <RadioRow
              label={o.label}
              on={selected === o.id}
              onClick={() => {
                onChange(o.id);
                onClose();
              }}
            />
          </div>
        ))}
      </div>
    </PickerDialog>
  );
}

export type ColourOption = { id: string; label: string; swatch: string };

/** The Colours picker: a grid of round swatches, pick up to `max` (D-031). */
export function ColourDialog({
  open,
  options,
  selected,
  max,
  suggestedIds,
  onChange,
  onClose,
}: {
  open: boolean;
  options: ColourOption[];
  selected: string[];
  max: number;
  /** The photo helper's guesses. Listed first, never ticked for the seller. */
  suggestedIds?: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const suggested = (suggestedIds ?? [])
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is ColourOption => Boolean(o));
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
    else onChange([...selected.slice(1), id]);
  };
  const grid = (list: ColourOption[]) => (
    <ul className="grid grid-cols-4 gap-lg px-lg py-md sm:grid-cols-5">
      {list.map((c) => {
        const on = selected.includes(c.id);
        return (
          <li key={c.id}>
            <button
              type="button"
              aria-pressed={on}
              aria-label={c.label}
              onClick={() => toggle(c.id)}
              className="flex w-full flex-col items-center gap-xs"
            >
              <span
                className={cn(
                  "grid h-[54px] w-[54px] place-items-center rounded-full border-2",
                  on ? "border-primary" : "border-transparent",
                )}
              >
                <span
                  className="grid h-11 w-11 place-items-center rounded-full border border-border"
                  style={{ backgroundColor: c.swatch }}
                >
                  {on ? (
                    <Check size={18} aria-hidden className="rounded-full bg-background text-primary" />
                  ) : null}
                </span>
              </span>
              <span className="text-center text-card-meta text-text-2">{c.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
  return (
    <PickerDialog
      open={open}
      title={t("sell.colours")}
      onClose={onClose}
      action={{ label: t("common.done"), onClick: onClose }}
    >
      <p className="px-lg pt-md text-body-sm text-text-3">{t("sell.coloursHint", { max })}</p>
      {suggested.length > 0 ? (
        <>
          <h3 className="px-lg pt-md text-section-label font-bold uppercase text-text-3">
            {t("sell.assist.looksLike")}
          </h3>
          {grid(suggested)}
          <h3 className="px-lg text-section-label font-bold uppercase text-text-3">
            {t("sell.assist.allOptions")}
          </h3>
        </>
      ) : null}
      {grid(options)}
    </PickerDialog>
  );
}
