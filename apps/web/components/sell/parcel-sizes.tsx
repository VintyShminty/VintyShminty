"use client";

import { formatPrice, type ParcelSize } from "@vinty/shared";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { cn } from "@/lib/utils";

/** Parcel size as radio cards, the recommended one tagged. */
export function ParcelSizes({
  sizes,
  selected,
  recommended,
  name,
  onSelect,
  error,
}: {
  sizes: ParcelSize[];
  selected: string | null;
  recommended: string | null;
  name: (value: ParcelSize["name"] | null | undefined) => string;
  onSelect: (id: string) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-sm">
      <div role="radiogroup" aria-label={t("sell.shipping")} className="flex flex-col gap-sm">
        {sizes.map((size) => {
          const on = selected === size.id;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a styled choice card, the radio role is the right pattern
            <button
              key={size.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(size.id)}
              className={cn(
                "flex items-center gap-md rounded-control border bg-background p-md text-start hover:bg-surface",
                on ? "border-primary" : error ? "border-error" : "border-border",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px]",
                  on ? "border-primary" : "border-text-4",
                )}
              >
                {on ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-xs">
                <span className="flex flex-wrap items-center gap-sm">
                  <span className="font-semibold text-text-1">{name(size.name)}</span>
                  {recommended === size.id ? (
                    <Badge variant="accent" icon={Check} label={t("sell.recommended")} />
                  ) : null}
                </span>
                <span className="text-body-sm text-text-3">{name(size.description)}</span>
                <span className="text-card-meta text-text-1">
                  {t("sell.postageFrom", { price: formatPrice(size.priceMinor, size.currency) })}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
