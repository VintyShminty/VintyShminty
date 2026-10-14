"use client";

import { formatPrice } from "@vinty/shared";
import { Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppOnlyNotice } from "@/components/app-only-notice";
import { useLoginPrompt } from "@/components/login-prompt";
import { useViewer } from "@/components/site-context";
import { cn } from "@/lib/utils";

type BuyProps = {
  reserved: boolean;
  canBuy: boolean;
  canOffer: boolean;
  buyerPriceMinor: number;
  currency: string;
};

/**
 * Buy and "Or make your price" (D-019, row 8). Logged out they open the login prompt. Logged in, buying and offers
 * come to the website in a later step, so for now they open a small notice saying it works in the app.
 */
function useGate() {
  const viewer = useViewer();
  const { ask } = useLoginPrompt();
  const [showNotice, notice] = useAppOnlyNotice();
  return { gate: () => (viewer ? showNotice() : ask()), notice };
}

export function BuyButtons({
  reserved,
  canBuy,
  canOffer,
  buyerPriceMinor,
  currency,
  compact = false,
}: BuyProps & { compact?: boolean }) {
  const { t } = useTranslation();
  const { gate, notice } = useGate();
  return (
    <div className="flex flex-col gap-sm">
      {canBuy ? (
        <button
          type="button"
          onClick={gate}
          className="inline-flex h-12 w-full items-center justify-center rounded-control bg-primary px-lg text-body font-semibold text-on-accent hover:opacity-90"
        >
          {reserved ? t("item.buyNow") : t("item.buyFor", { amount: formatPrice(buyerPriceMinor, currency) })}
        </button>
      ) : null}
      {canOffer ? (
        canBuy ? (
          <button
            type="button"
            onClick={gate}
            className={cn(
              "self-center rounded-control px-sm text-body-sm font-semibold text-primary underline-offset-4 hover:underline",
              compact ? "py-px" : "py-xs",
            )}
          >
            {t("item.orMakeYourPrice")}
          </button>
        ) : (
          <button
            type="button"
            onClick={gate}
            className="inline-flex h-12 w-full items-center justify-center rounded-control border border-primary px-lg text-body font-semibold text-primary hover:bg-accent-tint"
          >
            {t("item.orMakeYourPrice")}
          </button>
        )
      ) : null}
      {notice}
    </div>
  );
}

/** The bar fixed to the bottom of a phone screen (hidden on a laptop, where the card holds the buttons). */
export function BuyBar(props: BuyProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-lg pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-md lg:hidden">
      <BuyButtons {...props} compact />
    </div>
  );
}

/** The Message chip on the seller row. Logged out: login prompt. Logged in: the app-only notice for now. */
export function MessageChip({ sellerName }: { sellerName: string }) {
  const { t } = useTranslation();
  const { gate, notice } = useGate();
  return (
    <>
      <button
        type="button"
        onClick={gate}
        aria-label={`${t("item.messageSeller")}: ${sellerName}`}
        className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-text-4 bg-background px-[14px] text-pill text-text-1 hover:bg-pressed"
      >
        {t("item.message")}
      </button>
      {notice}
    </>
  );
}

/** "Report this item" or "Report this seller": a small link at the foot of the page. */
export function ReportButton({ label }: { label: string }) {
  const { gate, notice } = useGate();
  return (
    <>
      <button
        type="button"
        onClick={gate}
        className="inline-flex items-center gap-xs rounded-control py-xs text-body-sm text-text-3 underline-offset-4 hover:text-text-1 hover:underline"
      >
        <Flag size={14} aria-hidden />
        {label}
      </button>
      {notice}
    </>
  );
}
