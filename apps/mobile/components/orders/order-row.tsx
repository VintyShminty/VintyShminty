import type { OrderRow as OrderRowData } from "@vinty/shared";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ForwardIcon } from "@/components/ui/top-bar";
import { isolate } from "@/lib/bidi";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";

/**
 * One line of My orders (docs/components.md, ItemStrip order row): photo with a green tick when complete, the item,
 * the other person, what it costs (or what the seller earns), and the status in plain words.
 */
export function OrderRow({ order }: { order: OrderRowData }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const isSeller = order.role === "seller";
  const amount =
    isSeller && order.sellerEarningsMinor !== null ? order.sellerEarningsMinor : order.totalMinor;
  const title =
    order.itemCount > 1
      ? t("orders.moreItems", {
          title: isolate(order.title, i18n.language === "he"),
          count: order.itemCount - 1,
        })
      : order.title;
  const who = order.otherUser.username ?? t("profile.deletedMember");

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/order/[id]", params: { id: order.id } })}
      role="button"
      accessibilityLabel={`${title}, ${t(`orders.status.${order.status}.${order.role}`)}`}
      className="flex-row items-center gap-md border-b border-border-subtle px-lg py-md active:bg-surface"
    >
      <View>
        <View className="h-16 w-16 overflow-hidden rounded-control bg-pressed">
          {order.photoUrl ? (
            <Image
              source={{ uri: order.photoUrl }}
              style={{ width: 64, height: 64 }}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        {order.status === "completed" ? (
          <View className="absolute -end-xs -top-xs h-5 w-5 items-center justify-center rounded-full bg-success">
            <Icon as={Check} size={12} className="text-primary-foreground" strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <View className="flex-1 gap-xs">
        <Text weight={600} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="cardMeta" numberOfLines={1}>
          {t(isSeller ? "orders.soldTo" : "orders.boughtFrom", { name: who })}
        </Text>
        <Text variant="cardMeta" numberOfLines={1}>
          {formatDate(order.createdAt, i18n.language)}
        </Text>
        <View className="flex-row items-center gap-sm">
          <OrderStatusBadge status={order.status} role={order.role} />
        </View>
      </View>
      <View className="items-end gap-xs">
        <Text weight={700}>{formatMoney(amount, order.currency)}</Text>
        {isSeller ? <Text variant="cardMeta">{t("orders.youEarn")}</Text> : null}
      </View>
      <ForwardIcon />
    </Pressable>
  );
}
