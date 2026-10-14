"use client";

import { type OrderDetail, UPCOMING_ORDER_STEPS } from "@vinty/shared";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type Step = {
  key: string;
  label: string;
  note?: string;
  at?: string;
  state: "done" | "current" | "upcoming";
  /** The order stopped here (cancelled or refunded): not a happy tick. */
  stopped?: boolean;
};

/**
 * The story of an order (the app's full tracker): what happened with the date, then what is still to come in grey.
 * Cancelled, refunded and disputed orders end with their own last step.
 */
export function OrderTimeline({ order }: { order: OrderDetail }) {
  const { t, i18n } = useTranslation();
  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  const done: Step[] = order.timeline.map((e) => {
    const reason =
      e.event === "cancel" && order.cancelReason ? t(`orders.cancelReason.${order.cancelReason}`) : null;
    return {
      key: e.id,
      label: t(`orders.event.${e.event}`),
      // Notes written by the system ("Simulated payment") repeat the step name, so only people's words show.
      note:
        [reason, e.event === "cancel" || e.event === "open_dispute" ? e.note : null]
          .filter(Boolean)
          .join(". ") || undefined,
      at: e.createdAt,
      state: "done" as const,
      stopped: e.toStatus === "cancelled" || e.toStatus === "refunded",
    };
  });
  const ahead: Step[] = (UPCOMING_ORDER_STEPS[order.status] ?? []).map((k, i) => ({
    key: `next-${k}`,
    label: t(`orders.ahead.${k}`),
    state: i === 0 ? ("current" as const) : ("upcoming" as const),
  }));
  const steps = [...done, ...ahead];

  return (
    <ol aria-label={t("orders.progress")}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={step.key} className="flex gap-md">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  step.state === "done" && !step.stopped && "border-success bg-success",
                  step.state === "done" && step.stopped && "border-error bg-error",
                  step.state === "current" && "border-primary bg-background",
                  step.state === "upcoming" && "border-border bg-background",
                )}
              >
                {step.state === "done" ? (
                  step.stopped ? (
                    <X size={11} strokeWidth={3} className="text-on-accent" aria-hidden />
                  ) : (
                    <Check size={11} strokeWidth={3} className="text-on-accent" aria-hidden />
                  )
                ) : null}
              </span>
              {last ? null : (
                <span
                  className={cn(
                    "w-px flex-1",
                    step.state === "done" && !step.stopped ? "bg-success" : "bg-border",
                  )}
                />
              )}
            </div>
            <div className={cn("flex min-w-0 flex-1 flex-col gap-px", last ? "pb-0" : "pb-lg")}>
              <span
                className={cn(
                  "text-body",
                  step.state === "upcoming" ? "text-text-4" : "font-semibold text-text-1",
                )}
              >
                {step.label}
              </span>
              {step.note ? <span className="text-body-sm text-text-2">{step.note}</span> : null}
              {step.at ? <span className="text-card-meta text-text-3">{when(step.at)}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
