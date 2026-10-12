import type { ListingCard as ListingCardData } from "@vinty/shared";
import { Image } from "expo-image";
import { Check, Sparkles, TrendingDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Item card, option C (D-007): portrait 3:4 photo with 12px corners, outline badge bottom-start,
 * brand in bold, two line description, price in espresso with the buyer price under it.
 * The favourite heart arrives with Milestone 3.
 */
function ListingCard({ listing }: { listing: ListingCardData }) {
  const { t } = useTranslation();
  const sold = listing.status === "sold";
  const priceDrop = listing.previousPriceMinor !== null && listing.previousPriceMinor > listing.priceMinor;
  const percentOff = priceDrop
    ? Math.round((1 - listing.priceMinor / (listing.previousPriceMinor as number)) * 100)
    : 0;

  return (
    <View className="flex-1" accessibilityRole="button" accessibilityLabel={listing.title}>
      <View className="aspect-[3/4] overflow-hidden rounded-control bg-pressed">
        {listing.cover ? (
          <Image
            source={{ uri: listing.cover.url }}
            placeholder={listing.cover.placeholder ?? undefined}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={200}
            recyclingKey={listing.id}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {sold ? <View className="absolute inset-0 bg-background opacity-60" /> : null}
        <View className="absolute bottom-sm start-sm">
          {sold ? (
            <Badge variant="success" icon={Check} label={t("listing.sold")} />
          ) : priceDrop ? (
            <Badge variant="accent" icon={TrendingDown} label={t("listing.priceDrop")} />
          ) : listing.isBumped ? (
            <Badge variant="accent" icon={Sparkles} label={t("listing.bumped")} />
          ) : null}
        </View>
      </View>
      <View className="gap-px pt-sm">
        <Text variant="cardBrand" numberOfLines={1}>
          {listing.brandName ?? listing.title}
        </Text>
        {listing.brandName ? (
          <Text variant="cardDesc" numberOfLines={2}>
            {listing.title}
          </Text>
        ) : null}
        <Text
          variant="cardBrand"
          className={cn("mt-xs", sold ? "text-text-4 line-through" : "text-primary")}
          weight={700}
        >
          {formatMoney(listing.priceMinor, listing.currency)}
        </Text>
        {priceDrop ? (
          <Text variant="cardMeta">
            {t("listing.was", { price: formatMoney(listing.previousPriceMinor as number, listing.currency) })}
            {` · ${t("listing.percentOff", { percent: percentOff })}`}
          </Text>
        ) : null}
        {!sold ? (
          <Text variant="cardMeta">
            {t("listing.includesProtection", {
              price: formatMoney(listing.buyerPriceMinor, listing.currency),
            })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export { ListingCard };
