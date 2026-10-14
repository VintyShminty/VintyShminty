"use client";

import { useQuery } from "@tanstack/react-query";
import type { OrderDetail, OrderStatus } from "@vinty/shared";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  type LucideIcon,
  PackageCheck,
  Truck,
  Undo2,
  Wallet,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { orderQuery } from "@/lib/messaging-queries";
import { cn } from "@/lib/utils";

type StepKey = "paid" | "sent" | "arrived" | "done";
const STEPS: { key: StepKey; icon: LucideIcon }[] = [
  { key: "paid", icon: Wallet },
  { key: "sent", icon: Truck },
  { key: "arrived", icon: PackageCheck },
  { key: "done", icon: Check },
];

const STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  pending_payment: Clock,
  paid: Wallet,
  shipped: Truck,
  delivered: PackageCheck,
  completed: Check,
  cancelled: XCircle,
  disputed: AlertTriangle,
  refunded: Undo2,
};

function reachedAt(order: OrderDetail): Record<StepKey, string | null> {
  return {
    paid: order.paidAt,
    sent: order.shippedAt ?? order.shipment?.shippedAt ?? null,
    arrived: order.deliveredAt ?? order.shipment?.deliveredAt ?? null,
    done: order.completedAt,
  };
}

/**
 * The order card pinned at the top of a chat (D-019, row 16): four step icons with their dates and the buttons the
 * order allows right now. Same card as the app. Paying, shipping and "I got it" come to the website in a later step,
 * so those buttons open the "works in the app for now" notice. Track parcel only shows the code. The live
 * `order:updated` event refreshes the card.
 */
export function OrderTracker({ orderId, onAppOnly }: { orderId: string; onAppOnly: () => void }) {
  const { t, i18n } = useTranslation();
  const { data: order } = useQuery(orderQuery(orderId));
  const [showCode, setShowCode] = useState(false);
  if (!order) return null;

  const has = (a: OrderDetail["actions"][number]) => order.actions.includes(a);
  const stopped = order.status === "cancelled" || order.status === "refunded";
  const StatusIcon = STATUS_ICON[order.status];
  const at = reachedAt(order);
  const code = order.shipment?.trackingCode ?? null;
  const statusLabel = t(`orders.status.${order.status}.${order.role}`);
  const canTrack = order.status === "shipped" || order.status === "delivered";
  const hasButtons = has("pay") || has("ship") || has("confirm_received") || (canTrack && !stopped);
  const button =
    "inline-flex h-9 flex-1 items-center justify-center rounded-control px-md text-body-sm font-semibold";

  return (
    <section
      aria-label={t("chat.order.number", { number: order.orderNumber })}
      className="border-b border-border-subtle bg-surface"
    >
      <button
        type="button"
        onClick={onAppOnly}
        aria-label={`${t("chat.order.number", { number: order.orderNumber })}. ${statusLabel}. ${t("chat.order.view")}`}
        className="flex w-full flex-col gap-md px-lg pb-sm pt-md text-start hover:bg-pressed"
      >
        <span className="flex w-full items-center gap-sm">
          <span className="flex-1 truncate text-card-desc font-semibold text-text-1">
            {t("chat.order.number", { number: order.orderNumber })}
          </span>
          <StatusIcon size={14} className={stopped ? "text-error" : "text-text-2"} aria-hidden />
          <span className={cn("text-card-meta font-semibold", stopped ? "text-error" : "text-text-2")}>
            {statusLabel}
          </span>
          <ChevronRight size={16} className="text-text-3 rtl:rotate-180" aria-hidden />
        </span>
        {stopped ? null : (
          <span className="flex w-full" role="img" aria-label={t("orders.progress")}>
            {STEPS.map((s, i) => {
              const date = at[s.key];
              const reached = date !== null;
              const prevReached = i > 0 && at[STEPS[i - 1]?.key as StepKey] !== null;
              const nextReached = i < STEPS.length - 1 && at[STEPS[i + 1]?.key as StepKey] !== null;
              const Icon = s.icon;
              return (
                <span key={s.key} className="flex flex-1 flex-col items-center">
                  <span className="flex w-full items-center">
                    <span
                      className={cn(
                        "h-px flex-1",
                        i === 0 ? "bg-transparent" : prevReached && reached ? "bg-primary" : "bg-border",
                      )}
                    />
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border",
                        reached ? "border-primary bg-primary" : "border-border bg-background",
                      )}
                    >
                      <Icon size={16} className={reached ? "text-on-accent" : "text-text-4"} aria-hidden />
                    </span>
                    <span
                      className={cn(
                        "h-px flex-1",
                        i === STEPS.length - 1
                          ? "bg-transparent"
                          : reached && nextReached
                            ? "bg-primary"
                            : "bg-border",
                      )}
                    />
                  </span>
                  <span
                    className={cn("text-card-meta", reached ? "font-semibold text-text-1" : "text-text-3")}
                  >
                    {t(`chat.tracker.${s.key}`)}
                  </span>
                  <span className="min-h-4 text-card-meta text-text-3">
                    {date
                      ? new Date(date).toLocaleDateString(i18n.language, { day: "numeric", month: "short" })
                      : ""}
                  </span>
                </span>
              );
            })}
          </span>
        )}
      </button>
      {showCode && code ? (
        <div className="mx-lg mb-sm rounded-control bg-background p-md">
          <p className="text-card-meta text-text-3">{t("orders.tracking")}</p>
          <p className="select-text text-body font-bold text-text-1">{code}</p>
        </div>
      ) : null}
      {hasButtons ? (
        <div className="flex gap-sm px-lg pb-md">
          {has("pay") ? (
            <button
              type="button"
              onClick={onAppOnly}
              className={cn(button, "bg-primary text-on-accent hover:opacity-90")}
            >
              {t("orders.pay")}
            </button>
          ) : null}
          {has("ship") ? (
            <button
              type="button"
              onClick={onAppOnly}
              className={cn(button, "bg-primary text-on-accent hover:opacity-90")}
            >
              {t("orders.ship")}
            </button>
          ) : null}
          {canTrack ? (
            <button
              type="button"
              onClick={() => (code ? setShowCode((v) => !v) : onAppOnly())}
              aria-expanded={code ? showCode : undefined}
              className={cn(button, "border border-border text-text-1 hover:bg-pressed")}
            >
              {t("chat.tracker.track")}
            </button>
          ) : null}
          {has("confirm_received") ? (
            <button
              type="button"
              onClick={onAppOnly}
              className={cn(button, "bg-primary text-on-accent hover:opacity-90")}
            >
              {t("chat.tracker.gotIt")}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
