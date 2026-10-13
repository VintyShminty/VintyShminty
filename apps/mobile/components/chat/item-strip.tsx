import type { ConversationDetail } from "@vinty/shared";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Check, Clock, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ForwardIcon } from "@/components/ui/top-bar";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/** The item pinned under the top bar of a chat: photo, title, price, what the buyer pays. Tap opens the item. */
function ItemStrip({ listing }: { listing: ConversationDetail["listing"] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const sold = listing.status === "sold";
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/listing/[id]", params: { id: listing.id } })}
      role="button"
      accessibilityLabel={`${t("chat.openItem")}: ${listing.title}`}
      className="flex-row items-center gap-md border-y border-border-subtle bg-surface px-lg py-sm active:bg-pressed"
    >
      <View className="h-12 w-12 overflow-hidden rounded-control bg-pressed">
        {listing.photoUrl ? (
          <Image
            source={{ uri: listing.photoUrl }}
            style={{ width: 48, height: 48 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>
      <View className="flex-1 gap-px">
        <Text weight={600} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text
          variant="bodySmall"
          weight={700}
          className={cn(sold ? "text-text-4 line-through" : "text-primary")}
        >
          {formatMoney(listing.priceMinor, listing.currency)}
        </Text>
        {sold ? null : (
          <View className="flex-row items-center gap-xs">
            <Icon as={ShieldCheck} size={13} className="text-text-3" />
            <Text variant="cardMeta">
              {t("listing.includesProtection", {
                price: formatMoney(listing.buyerPriceMinor, listing.currency),
              })}
            </Text>
          </View>
        )}
      </View>
      {listing.status === "sold" ? (
        <Badge variant="success" icon={Check} label={t("listing.sold")} />
      ) : listing.status === "reserved" ? (
        <Badge variant="warning" icon={Clock} label={t("listing.reserved")} />
      ) : null}
      <ForwardIcon />
    </Pressable>
  );
}

export { ItemStrip };
