import type { OrderDetail } from "@vinty/shared";
import { Check, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
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

// The steps still to come on the happy path, by where the order is now.
const UPCOMING: Record<string, string[]> = {
  pending_payment: ["pay", "ship", "deliver", "complete"],
  paid: ["ship", "deliver", "complete"],
  shipped: ["deliver", "complete"],
  delivered: ["complete"],
};

/**
 * The story of an order (docs/components.md, OrderTimeline, full tracker): what happened with the date, then what is
 * still to come in grey. Cancelled, refunded and disputed orders end with their own last step.
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
  const ahead = (UPCOMING[order.status] ?? []).map((k, i) => ({
    key: `next-${k}`,
    label: t(`orders.ahead.${k}`),
    state: i === 0 ? ("current" as const) : ("upcoming" as const),
  }));
  const steps: Step[] = [...done, ...ahead];

  return (
    <View accessibilityLabel={t("orders.progress")}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <View key={step.key} className="flex-row gap-md">
            <View className="items-center">
              <View
                className={cn(
                  "h-5 w-5 items-center justify-center rounded-full border-2",
                  step.state === "done" && !step.stopped && "border-success bg-success",
                  step.state === "done" && step.stopped && "border-error bg-error",
                  step.state === "current" && "border-primary bg-background",
                  step.state === "upcoming" && "border-border bg-background",
                )}
              >
                {step.state === "done" ? (
                  <Icon
                    as={step.stopped ? X : Check}
                    size={11}
                    strokeWidth={3}
                    className="text-primary-foreground"
                  />
                ) : null}
              </View>
              {last ? null : (
                <View
                  className={cn(
                    "w-px flex-1",
                    step.state === "done" && !step.stopped ? "bg-success" : "bg-border",
                  )}
                />
              )}
            </View>
            <View className={cn("flex-1 gap-px", last ? "pb-0" : "pb-lg")}>
              <Text
                weight={step.state === "upcoming" ? 400 : 600}
                className={step.state === "upcoming" ? "text-text-4" : undefined}
              >
                {step.label}
              </Text>
              {step.note ? (
                <Text variant="bodySmall" className="text-text-2">
                  {step.note}
                </Text>
              ) : null}
              {step.at ? <Text variant="cardMeta">{when(step.at)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
