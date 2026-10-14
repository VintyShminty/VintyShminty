"use client";

import { formatPrice } from "@vinty/shared";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * The buyer price as a soft pill (D-019, row 2): a check and "₪189 with Covered" on the accent tint.
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
      <Check size={11} className="shrink-0" aria-hidden />
      <span className="truncate">
        {t("listing.buyerPays", { price: formatPrice(amountMinor, currency) })}
      </span>
    </span>
  );
}
