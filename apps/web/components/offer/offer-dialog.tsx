"use client";

import { useQuery } from "@tanstack/react-query";
import {
  formatClock,
  formatPrice,
  minorToPriceText,
  offerAmountProblem,
  pricePreviewSchema,
  priceTextToMinor,
  QUICK_OFFER_PERCENT,
  quickOfferAmount,
} from "@vinty/shared";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PricePill } from "@/components/price-pill";
import { clientApi } from "@/lib/api-client";
import { offerErrorKey, offerQuotaQuery } from "@/lib/order-flow-queries";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

/**
 * The dialog to make or counter an offer (D-019 row 8, the app's offer sheet): quick tiles with the price they work
 * out to, a price field, what the buyer would pay with protection, the offers left today and the Send button that
 * repeats the amount. A buyer has a daily limit, a seller's counters are not counted so they show no limit line.
 */
export function OfferDialog({
  open,
  mode,
  listingPriceMinor,
  currency,
  showQuota,
  onSend,
  onClose,
}: {
  open: boolean;
  /** make: the buyer's first offer. counter: an answer to the other person's offer. */
  mode: "make" | "counter";
  listingPriceMinor: number;
  currency: string;
  showQuota: boolean;
  /** Sends the amount. Throws when the server says no, the dialog shows why. */
  onSend: (amountMinor: number) => Promise<void>;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const fieldId = useId();
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Opening again starts from an empty box.
  useEffect(() => {
    if (open) {
      setText("");
      setTouched(false);
      setServerError(null);
      setBusy(false);
    }
  }, [open]);

  const quota = useQuery({ ...offerQuotaQuery(), enabled: open && showQuota });
  const amount = priceTextToMinor(text);
  const problem = offerAmountProblem(amount, listingPriceMinor);
  const valid = amount !== null && problem === null;
  const debounced = useDebounced(valid ? amount : null);
  const preview = useQuery({
    queryKey: ["price-preview", debounced],
    queryFn: () => clientApi(`/v1/pricing/preview?priceMinor=${debounced}`, { schema: pricePreviewSchema }),
    enabled: open && debounced !== null,
  });
  const noneLeft = showQuota && quota.data !== undefined && quota.data.remaining <= 0;

  const send = async () => {
    if (!valid || busy || noneLeft) return;
    setBusy(true);
    setServerError(null);
    try {
      await onSend(amount);
      onClose();
    } catch (err) {
      setServerError(offerErrorKey(err));
      void quota.refetch();
    } finally {
      setBusy(false);
    }
  };

  const fieldError =
    problem === "positive"
      ? t("offer.errors.positive")
      : problem === "belowPrice"
        ? t("offer.errors.belowPrice", { price: formatPrice(listingPriceMinor, currency) })
        : null;

  return (
    <ConfirmDialog
      open={open}
      title={mode === "make" ? t("offer.title") : t("offer.counterTitle")}
      confirmLabel={
        valid ? t("offer.sendAmount", { amount: formatPrice(amount, currency) }) : t("offer.send")
      }
      busy={busy}
      disabled={!valid || noneLeft}
      onConfirm={() => void send()}
      onCancel={onClose}
    >
      <div className="mt-sm flex flex-col gap-lg">
        <p className="text-body-sm text-text-2">
          {t("offer.listedAt", { price: formatPrice(listingPriceMinor, currency) })}
        </p>
        <div className="flex gap-sm">
          {QUICK_OFFER_PERCENT.map((percent) => {
            const value = quickOfferAmount(listingPriceMinor, percent);
            const selected = amount === value;
            return (
              <button
                key={percent}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setText(minorToPriceText(value));
                  setTouched(true);
                  setServerError(null);
                }}
                className={cn(
                  "flex flex-1 flex-col items-center rounded-control border px-sm py-md",
                  selected ? "border-primary bg-accent-tint" : "border-border bg-background hover:bg-surface",
                )}
              >
                <span className="text-body font-bold text-text-1">{formatPrice(value, currency)}</span>
                <span className="text-card-meta text-text-3">{t("offer.percentOff", { percent })}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-xs">
          <label htmlFor={fieldId} className="text-body-sm font-semibold text-text-2">
            {t("offer.yourPrice")}
          </label>
          <div
            className={cn(
              "flex h-14 items-center rounded-control border bg-background px-md focus-within:border-primary",
              touched && fieldError ? "border-error" : "border-border",
            )}
          >
            <span className="me-xs text-heading text-text-2" aria-hidden>
              ₪
            </span>
            <input
              id={fieldId}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setTouched(true);
                setServerError(null);
              }}
              inputMode="decimal"
              maxLength={9}
              placeholder={t("offer.placeholder")}
              aria-invalid={touched && fieldError ? true : undefined}
              className="min-w-0 flex-1 bg-transparent text-heading font-bold text-text-1 outline-none placeholder:text-text-4 text-start"
            />
          </div>
          {touched && fieldError ? (
            <p role="alert" className="text-card-desc text-error">
              {fieldError}
            </p>
          ) : preview.data && valid ? (
            <PricePill
              className="self-start"
              amountMinor={preview.data.buyerPriceMinor}
              currency={preview.data.currency}
            />
          ) : null}
        </div>
        {serverError ? <Notice kind="error">{t(serverError)}</Notice> : null}
        {showQuota && quota.data ? (
          <p className="text-center text-card-desc text-text-3">
            {noneLeft
              ? t("offer.noneLeft", { time: formatClock(quota.data.resetsAt, i18n.language) })
              : t("offer.left", { count: quota.data.remaining })}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
