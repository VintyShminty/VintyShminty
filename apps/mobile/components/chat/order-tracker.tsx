import { useQuery } from "@tanstack/react-query";
import type { OrderDetail } from "@vinty/shared";
import { useRouter } from "expo-router";
import { Check, type LucideIcon, PackageCheck, Truck, Wallet } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ForwardIcon } from "@/components/ui/top-bar";
import { ORDER_STATUS_LOOK, orderStatusKey } from "@/lib/order-status";
import { orderQuery, useOrderStep } from "@/lib/orders-queries";
import { cn } from "@/lib/utils";

type StepKey = "paid" | "sent" | "arrived" | "done";
const STEPS: { key: StepKey; icon: LucideIcon }[] = [
  { key: "paid", icon: Wallet },
  { key: "sent", icon: Truck },
  { key: "arrived", icon: PackageCheck },
  { key: "done", icon: Check },
];

function reachedAt(order: OrderDetail): Record<StepKey, string | null> {
  return {
    paid: order.paidAt,
    sent: order.shippedAt ?? order.shipment?.shippedAt ?? null,
    arrived: order.deliveredAt ?? order.shipment?.deliveredAt ?? null,
    done: order.completedAt,
  };
}

/**
 * The order card pinned at the top of a chat (docs/components.md, OrderTracker): four step icons with their dates, the
 * buttons the order allows right now, and a tap on the card opens the order. It reads the order, which the live
 * `order:updated` event refreshes.
 */
function OrderTracker({ orderId }: { orderId: string }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { data: order } = useQuery(orderQuery(orderId));
  const step = useOrderStep(orderId);
  const [showCode, setShowCode] = useState(false);
  if (!order) return null;

  const openOrder = () => router.push({ pathname: "/order/[id]", params: { id: order.id } });
  const has = (a: OrderDetail["actions"][number]) => order.actions.includes(a);
  const stopped = order.status === "cancelled" || order.status === "refunded";
  const look = ORDER_STATUS_LOOK[order.status];
  const at = reachedAt(order);
  const code = order.shipment?.trackingCode ?? null;
  const confirm = (title: string, message: string, label: string, onPress: () => void) =>
    Alert.alert(title, message, [
      { text: t("common.cancel"), style: "cancel" },
      { text: label, onPress },
    ]);
  const statusLabel = t(orderStatusKey(order.status, order.role));
  const canTrack = order.status === "shipped" || order.status === "delivered";
  const hasButtons = has("pay") || has("ship") || has("confirm_received") || (canTrack && !stopped);

  return (
    <View className="border-b border-border-subtle bg-surface">
      <Pressable
        onPress={openOrder}
        role="button"
        accessibilityLabel={`${t("chat.order.number", { number: order.orderNumber })}. ${statusLabel}. ${t("chat.order.view")}`}
        className="gap-md px-lg pt-md pb-sm active:bg-pressed"
      >
        <View className="flex-row items-center gap-sm">
          <Text variant="cardDesc" weight={600} className="flex-1" numberOfLines={1}>
            {t("chat.order.number", { number: order.orderNumber })}
          </Text>
          <Icon as={look.icon} size={14} className={stopped ? "text-error" : "text-text-2"} />
          <Text variant="cardMeta" weight={600} className={stopped ? "text-error" : "text-text-2"}>
            {statusLabel}
          </Text>
          <ForwardIcon />
        </View>
        {stopped ? null : (
          <View className="flex-row" accessibilityLabel={t("orders.progress")}>
            {STEPS.map((s, i) => {
              const date = at[s.key];
              const reached = date !== null;
              const prevReached = i > 0 && at[STEPS[i - 1]?.key as StepKey] !== null;
              return (
                <View key={s.key} className="flex-1 items-center">
                  <View className="w-full flex-row items-center">
                    <View
                      className={cn(
                        "h-px flex-1",
                        i === 0 ? "bg-transparent" : prevReached && reached ? "bg-primary" : "bg-border",
                      )}
                    />
                    <View
                      className={cn(
                        "h-8 w-8 items-center justify-center rounded-full border",
                        reached ? "border-primary bg-primary" : "border-border bg-background",
                      )}
                    >
                      <Icon
                        as={s.icon}
                        size={16}
                        className={reached ? "text-primary-foreground" : "text-text-4"}
                      />
                    </View>
                    <View
                      className={cn(
                        "h-px flex-1",
                        i === STEPS.length - 1
                          ? "bg-transparent"
                          : reached && at[STEPS[i + 1]?.key as StepKey] !== null
                            ? "bg-primary"
                            : "bg-border",
                      )}
                    />
                  </View>
                  <Text
                    variant="cardMeta"
                    weight={reached ? 600 : 400}
                    className={reached ? "text-text-1" : "text-text-3"}
                  >
                    {t(`chat.tracker.${s.key}`)}
                  </Text>
                  <Text variant="cardMeta" className="text-text-3 min-h-4">
                    {date
                      ? new Date(date).toLocaleDateString(i18n.language, { day: "numeric", month: "short" })
                      : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Pressable>
      {showCode && code ? (
        <View className="mx-lg mb-sm rounded-control bg-background p-md">
          <Text variant="cardMeta">{t("orders.tracking")}</Text>
          <Text weight={700} selectable>
            {code}
          </Text>
        </View>
      ) : null}
      {hasButtons ? (
        <View className="flex-row gap-sm px-lg pb-md">
          {has("pay") ? (
            <Button
              size="sm"
              className="flex-1"
              onPress={() => router.push({ pathname: "/checkout", params: { orderId: order.id } })}
            >
              <Text>{t("orders.pay")}</Text>
            </Button>
          ) : null}
          {has("ship") ? (
            <Button
              size="sm"
              className="flex-1"
              loading={step.isPending}
              onPress={() =>
                confirm(t("orders.shipConfirmTitle"), t("orders.shipConfirmNote"), t("orders.ship"), () =>
                  step.mutate({ step: "ship" }),
                )
              }
            >
              <Text>{t("orders.ship")}</Text>
            </Button>
          ) : null}
          {canTrack ? (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onPress={() => (code ? setShowCode((v) => !v) : openOrder())}
            >
              <Text>{t("chat.tracker.track")}</Text>
            </Button>
          ) : null}
          {has("confirm_received") ? (
            <Button
              size="sm"
              className="flex-1"
              loading={step.isPending}
              onPress={() =>
                confirm(
                  t("orders.receivedConfirmTitle"),
                  t("orders.receivedConfirmNote"),
                  t("chat.tracker.gotIt"),
                  () => step.mutate({ step: "confirm-received" }),
                )
              }
            >
              <Text>{t("chat.tracker.gotIt")}</Text>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export { OrderTracker };
