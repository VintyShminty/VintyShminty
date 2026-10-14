"use client";

import { formatPrice } from "@vinty/shared";
import { BadgeCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * The buyer price as a soft pill (D-019, row 2): a BadgeCheck and "₪189 with Coverage" on the accent tint.
 * `muted` is for sold items, the pill goes quiet. Same look as the app's price pill.
 */
export function PricePill({
  amountMinor,
  currency,
  muted = false,
  className,
}: {
  amountMinor: number;
  currency: string;
  muted?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-xs rounded-full px-sm py-[3px] text-card-meta font-semibold",
        muted ? "bg-surface text-text-4" : "bg-accent-tint text-primary",
        className,
      )}
    >
      <BadgeCheck size={12} className="shrink-0" aria-hidden />
      <span className="truncate">
        {t("listing.buyerPays", { price: formatPrice(amountMinor, currency) })}
      </span>
    </span>
  );
}

/**
 * The Coverage buyer price as a tiny muted line under the title on item cards (D-032): a BadgeCheck and
 * "{price} with {protectionName}". No pill, no background.
 */
export function CoveredLine({
  amountMinor,
  currency,
  muted = false,
  className,
}: {
  amountMinor: number;
  currency: string;
  muted?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    // Not through cn(): tailwind-merge does not know our type scale names and would drop text-card-meta as a clashing colour.
    <span
      className={`flex items-center gap-xs text-card-meta text-text-3${muted ? " opacity-60" : ""}${className ? ` ${className}` : ""}`}
    >
      <BadgeCheck size={12} className="shrink-0" aria-hidden />
      <span className="truncate">
        {t("listing.buyerPays", { price: formatPrice(amountMinor, currency) })}
      </span>
    </span>
  );
}
