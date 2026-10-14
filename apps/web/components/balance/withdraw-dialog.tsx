"use client";

import { formatPrice, minorToPriceText, priceTextToMinor } from "@vinty/shared";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ApiClientError } from "@/lib/api-error";
import { describeApiError } from "@/lib/describe-api-error";
import { newIdempotencyKey, useWithdraw } from "@/lib/order-flow-queries";
import { cn } from "@/lib/utils";

/** A pretend withdrawal: how much, an honest note that no bank is involved, and a thank you. */
export function WithdrawDialog({
  open,
  availableMinor,
  currency,
  onClose,
}: {
  open: boolean;
  availableMinor: number;
  currency: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const withdraw = useWithdraw();
  const fieldId = useId();
  const [text, setText] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // One key per attempt: clicking twice, or retrying after a bad connection, still makes one withdrawal.
  const key = useRef(newIdempotencyKey());
  const amount = priceTextToMinor(text);
  const tooMuch = amount !== null && amount > availableMinor;
  const valid = amount !== null && amount > 0 && !tooMuch;

  useEffect(() => {
    if (open) {
      setText("");
      setDone(null);
      setErrorKey(null);
      withdraw.reset();
      key.current = newIdempotencyKey();
    }
  }, [open, withdraw.reset]);

  const send = () => {
    if (!valid || amount === null) return;
    setErrorKey(null);
    withdraw.mutate(
      { amountMinor: amount, key: key.current },
      {
        onSuccess: () => setDone(amount),
        onError: (err) =>
          setErrorKey(
            err instanceof ApiClientError && err.fields?.amountMinor
              ? "validation.withdrawal.tooMuch"
              : describeApiError(err).key,
          ),
      },
    );
  };

  if (done !== null) {
    return (
      <ConfirmDialog
        open={open}
        title={t("balance.withdrawDone", { amount: formatPrice(done, currency) })}
        body={t("balance.withdrawDoneNote")}
        confirmLabel={t("common.done")}
        hideCancel
        onConfirm={onClose}
        onCancel={onClose}
      >
        <CheckCircle2 size={44} aria-hidden className="mt-lg text-success" />
      </ConfirmDialog>
    );
  }

  return (
    <ConfirmDialog
      open={open}
      title={t("balance.withdrawTitle")}
      confirmLabel={t("balance.withdrawConfirm")}
      busy={withdraw.isPending}
      disabled={!valid}
      onConfirm={send}
      onCancel={onClose}
    >
      <div className="mt-md flex flex-col gap-lg">
        <p className="rounded-control bg-accent-tint px-md py-md text-body-sm text-text-1">
          {t("balance.withdrawNote")}
        </p>
        <div className="flex flex-col gap-xs">
          <label htmlFor={fieldId} className="text-body-sm font-semibold text-text-2">
            {t("balance.amount")}
          </label>
          <div
            className={cn(
              "flex h-12 items-center rounded-control border bg-background px-md focus-within:border-primary",
              tooMuch ? "border-error" : "border-border",
            )}
          >
            <span className="me-xs font-semibold text-text-2" aria-hidden>
              {formatPrice(0, currency).replace("0", "")}
            </span>
            <input
              id={fieldId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              inputMode="decimal"
              maxLength={9}
              placeholder="0"
              aria-invalid={tooMuch ? true : undefined}
              className="min-w-0 flex-1 bg-transparent text-body text-text-1 outline-none placeholder:text-text-4 text-start"
            />
          </div>
          <div className="flex items-center justify-between gap-md">
            <p
              role={tooMuch ? "alert" : undefined}
              className={cn("text-card-desc", tooMuch ? "text-error" : "text-text-3")}
            >
              {tooMuch
                ? t("validation.withdrawal.tooMuch")
                : t("balance.availableHint", { amount: formatPrice(availableMinor, currency) })}
            </p>
            <button
              type="button"
              onClick={() => setText(minorToPriceText(availableMinor))}
              disabled={availableMinor <= 0}
              className="text-card-desc font-semibold text-primary hover:underline disabled:opacity-40"
            >
              {t("balance.useAll")}
            </button>
          </div>
        </div>
        {errorKey ? <Notice kind="error">{t(errorKey)}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}
