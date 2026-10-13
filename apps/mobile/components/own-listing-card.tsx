import type { MyListingCard } from "@vinty/shared";
import { Image } from "expo-image";
import { Check, Clock, EyeOff, Pencil, TrendingDown, Zap } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The owner's own card (spec, Own profile: "a mini dashboard"): the photo with a state badge, then money and
 * performance first, price, views and favourites. A buzzing item wears the Buzzing badge.
 */
function OwnListingCard({ listing, onPress }: { listing: MyListingCard; onPress: () => void }) {
  const { t } = useTranslation();
  const sold = listing.status === "sold";
  const priceDrop =
    listing.previousPriceMinor !== null &&
    listing.priceMinor !== null &&
    listing.previousPriceMinor > listing.priceMinor;

  const badge =
    listing.status === "sold" ? (
      <Badge variant="success" icon={Check} label={t("listing.sold")} />
    ) : listing.status === "reserved" ? (
      <Badge variant="warning" icon={Clock} label={t("listing.reserved")} />
    ) : listing.status === "hidden" ? (
      <Badge variant="neutral" icon={EyeOff} label={t("listing.hidden")} />
    ) : listing.status === "draft" ? (
      <Badge variant="neutral" icon={Pencil} label={t("listing.draft")} />
    ) : listing.isBumped ? (
      <Badge variant="accent" icon={Zap} label={t("buzz.buzzing")} />
    ) : priceDrop ? (
      <Badge variant="accent" icon={TrendingDown} label={t("listing.priceDrop")} />
    ) : null;

  return (
    <Pressable
      onPress={onPress}
      role="button"
      accessibilityLabel={listing.title || t("listing.untitled")}
      className="flex-1 active:scale-[0.98]"
    >
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
        {sold || listing.status === "hidden" ? (
          <View className="absolute inset-0 bg-background opacity-60" />
        ) : null}
        {badge ? <View className="absolute bottom-sm start-sm">{badge}</View> : null}
      </View>
      <View className="gap-px pt-sm">
        <Text
          variant="cardBrand"
          weight={700}
          className={cn(sold ? "text-text-4 line-through" : "text-primary")}
          numberOfLines={1}
        >
          {listing.priceMinor === null
            ? t("listing.noPrice")
            : formatMoney(listing.priceMinor, listing.currency)}
        </Text>
        {listing.status === "draft" ? (
          <Text variant="cardDesc" numberOfLines={2}>
            {listing.title || t("listing.untitled")}
          </Text>
        ) : (
          <>
            <Text variant="cardMeta">{t("listing.views", { count: listing.viewCount })}</Text>
            <Text variant="cardMeta">{t("listing.favourites", { count: listing.favouriteCount })}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

export { OwnListingCard };
