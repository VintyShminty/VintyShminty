import { useQuery } from "@tanstack/react-query";
import { type OrderDetail, orderDetailSchema } from "@vinty/shared";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { isolate } from "@/lib/bidi";
import { formatMoney } from "@/lib/money";

/** The thank you after a successful (pretend) payment. Says what happens next and opens the order. */
export default function CheckoutDone() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const order = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api<OrderDetail>(`/v1/orders/${orderId}`, { schema: orderDetailSchema }),
  });
  const o = order.data;

  return (
    <Screen bottomInset={false}>
      {!o ? (
        <Spinner size="large" />
      ) : (
        <View className="flex-1 items-center justify-center gap-lg px-xl">
          <Icon as={CheckCircle2} size={64} className="text-success" />
          <Text variant="title" className="text-center">
            {t("checkout.done.title")}
          </Text>
          <Text className="text-center text-text-2">
            {t("checkout.done.note", { seller: o.seller.username ?? t("profile.deletedMember") })}
          </Text>
          <View className="w-full flex-row items-center gap-md rounded-control border border-border-subtle bg-surface p-md">
            <View className="h-14 w-14 overflow-hidden rounded-control bg-pressed">
              {o.photoUrl ? (
                <Image
                  source={{ uri: o.photoUrl }}
                  style={{ width: 56, height: 56 }}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : null}
            </View>
            <View className="flex-1 gap-px">
              <Text weight={600} numberOfLines={1}>
                {o.itemCount > 1
                  ? t("checkout.done.many", {
                      title: isolate(o.title, i18n.language === "he"),
                      count: o.itemCount - 1,
                    })
                  : o.title}
              </Text>
              <Text variant="cardMeta">{t("chat.order.number", { number: o.orderNumber })}</Text>
            </View>
            <Text weight={700}>{formatMoney(o.totalMinor, o.currency)}</Text>
          </View>
          <Text variant="cardDesc" className="text-center text-text-3">
            {t("checkout.simulatedDone")}
          </Text>
        </View>
      )}
      <View className="gap-sm px-lg pt-md" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button
          size="lg"
          disabled={!o}
          onPress={() => router.replace({ pathname: "/order/[id]", params: { id: orderId } })}
        >
          <Text>{t("checkout.done.viewOrder")}</Text>
        </Button>
        <Button variant="ghost" size="lg" onPress={() => router.dismissAll()}>
          <Text>{t("checkout.done.keepShopping")}</Text>
        </Button>
      </View>
    </Screen>
  );
}
