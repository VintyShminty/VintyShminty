import { useRouter } from "expo-router";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  type LucideIcon,
  Package,
  ReceiptText,
  RotateCcw,
  Star,
  Truck,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ForwardIcon } from "@/components/ui/top-bar";

type DividerStyle = { icon: LucideIcon; tone: string };

const STYLES: Record<string, DividerStyle> = {
  order_paid: { icon: ReceiptText, tone: "text-primary" },
  order_shipped: { icon: Truck, tone: "text-primary" },
  order_delivered: { icon: Package, tone: "text-primary" },
  order_completed: { icon: CheckCircle2, tone: "text-success" },
  order_cancelled: { icon: Ban, tone: "text-error" },
  order_disputed: { icon: AlertTriangle, tone: "text-warning" },
  order_refunded: { icon: RotateCcw, tone: "text-text-2" },
  review_auto_left: { icon: Star, tone: "text-primary" },
};

type Payload = {
  orderNumber?: number;
  title?: string;
  itemCount?: number;
  trackingCode?: string;
  reason?: string;
  details?: string;
};

/** True for the system messages that belong to an order and open it when tapped. */
export function isOrderDivider(event: string | null): boolean {
  return event !== null && event in STYLES;
}

/**
 * A step of an order inside the chat (docs/components.md, OrderTimeline, divider variant): an icon, what happened, which
 * order and item, and a tap that opens the order.
 */
function OrderDivider({
  event,
  orderId,
  payload,
}: {
  event: string;
  orderId: string | null;
  payload: unknown;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const style = STYLES[event] ?? { icon: Package, tone: "text-primary" };
  const data = (payload ?? {}) as Payload;
  const what =
    data.title && (data.itemCount ?? 1) > 1
      ? t("chat.order.moreItems", { title: data.title, count: (data.itemCount ?? 1) - 1 })
      : data.title;
  const detail =
    event === "order_shipped" && data.trackingCode
      ? t("chat.order.tracking", { code: data.trackingCode })
      : event === "order_cancelled" && data.reason
        ? t(`chat.order.reason.${data.reason}`, { defaultValue: "" })
        : event === "order_disputed" && data.details
          ? data.details
          : "";

  return (
    <View className="px-lg py-sm">
      <Pressable
        onPress={() => orderId && router.push({ pathname: "/order/[id]", params: { id: orderId } })}
        disabled={!orderId}
        role="button"
        accessibilityLabel={`${t(`chat.system.${event}`)}. ${t("chat.order.view")}`}
        className="flex-row items-center gap-md rounded-control border border-border-subtle bg-surface px-md py-md active:bg-pressed"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-background">
          <Icon as={style.icon} size={20} className={style.tone} />
        </View>
        <View className="flex-1 gap-px">
          <Text weight={600}>{t(`chat.system.${event}`)}</Text>
          <Text variant="cardDesc" numberOfLines={1}>
            {[data.orderNumber ? t("chat.order.number", { number: data.orderNumber }) : null, what]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {detail ? (
            <Text variant="cardMeta" numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
        {orderId ? <ForwardIcon /> : null}
      </Pressable>
    </View>
  );
}

export { OrderDivider };
