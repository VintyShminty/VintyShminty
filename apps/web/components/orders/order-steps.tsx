"use client";

import type { OrderDetail } from "@vinty/shared";
import { type ReactElement, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { orderErrorKey, useOrderStep } from "@/lib/order-flow-queries";

export type AskedStep = "ship" | "confirm-received" | "cancel" | "dispute";

/**
 * The moves of an order that need a "Are you sure?" first: Mark as shipped, I received it, Cancel (with an optional
 * reason) and Report a problem (with required details). `ask(step)` opens the right box, the dialog does the call.
 * Render `dialog` once. `errorKey` is the words of the last refusal (someone moved the order first, for example).
 */
export function useOrderSteps(order: Pick<OrderDetail, "id" | "role">): {
  ask: (step: AskedStep) => void;
  dialog: ReactElement;
  errorKey: string | null;
  pending: boolean;
} {
  const { t } = useTranslation();
  const mutation = useOrderStep(order.id);
  const fieldId = useId();
  const [asking, setAsking] = useState<AskedStep | null>(null);
  const [text, setText] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const seller = order.role === "seller";

  const ask = (step: AskedStep) => {
    setText("");
    setErrorKey(null);
    setAsking(step);
  };
  const close = () => setAsking(null);

  const texts: Record<AskedStep, { title: string; body: string; confirm: string }> = {
    ship: {
      title: t("orders.shipConfirmTitle"),
      body: t("orders.shipConfirmNote"),
      confirm: t("orders.ship"),
    },
    "confirm-received": {
      title: t("orders.receivedConfirmTitle"),
      body: t("orders.receivedConfirmNote"),
      confirm: t("orders.received"),
    },
    cancel: {
      title: t("orders.cancelTitle"),
      body: t(seller ? "orders.cancelIntroSeller" : "orders.cancelIntroBuyer"),
      confirm: t("orders.cancelConfirm"),
    },
    dispute: {
      title: t("orders.disputeTitle"),
      body: t("orders.disputeIntro"),
      confirm: t("orders.disputeConfirm"),
    },
  };
  const current = asking ? texts[asking] : null;
  const hasText = asking === "cancel" || asking === "dispute";
  const needsText = asking === "dispute";

  const submit = () => {
    if (!asking) return;
    const step = asking;
    const input =
      step === "cancel"
        ? ({ step, reason: text.trim() } as const)
        : step === "dispute"
          ? ({ step, details: text.trim() } as const)
          : ({ step } as const);
    mutation.mutate(input, {
      onError: (err) => setErrorKey(orderErrorKey(err)),
      onSettled: close,
    });
  };

  const dialog = (
    <ConfirmDialog
      open={asking !== null}
      title={current?.title ?? ""}
      body={current?.body}
      confirmLabel={current?.confirm ?? ""}
      destructive={asking === "cancel"}
      busy={mutation.isPending}
      disabled={needsText && text.trim() === ""}
      onConfirm={submit}
      onCancel={close}
    >
      {hasText ? (
        <div className="mt-lg">
          <label htmlFor={fieldId} className="mb-xs block text-body-sm font-semibold text-text-2">
            {needsText ? t("orders.disputeDetails") : t("orders.cancelReasonLabel")}
          </label>
          <textarea
            id={fieldId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={needsText ? 1000 : 300}
            dir="auto"
            placeholder={needsText ? t("orders.disputeHint") : t("orders.cancelReasonHint")}
            className="block w-full resize-none rounded-control border border-border bg-background px-md py-sm text-body text-text-1 outline-none placeholder:text-text-4 focus:border-primary"
          />
        </div>
      ) : null}
    </ConfirmDialog>
  );
  return { ask, dialog, errorKey, pending: mutation.isPending };
}
