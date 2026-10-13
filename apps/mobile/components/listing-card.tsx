import type { ListingCard as ListingCardData } from "@vinty/shared";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Check, Heart, TrendingDown, Zap } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { PricePill } from "@/components/price-pill";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { formatMoney } from "@/lib/money";
import { useToggleFavourite } from "@/lib/queries";
import { useLocalName, useReference } from "@/lib/reference";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

/**
 * Item card, the price tag card (D-019, row 3, supersedes D-007): portrait 3:4 photo with 12px corners and the badge
 * bottom-start, then the seller price big with the heart at the end of that row, brand, size and condition in small
 * capitals, and the buyer price pill. The heart shows for a signed in viewer, never on your own items. Sold items
 * have none, except on the Favourites screen (heartOnSold). The heart changes at once and goes back if the server
 * says no. Tapping the card opens the item page.
 */
function ListingCard({
  listing,
  hideHeart = false,
  heartOnSold = false,
}: {
  listing: ListingCardData;
  /** Set where the cards are known to be the viewer's own (for example their own profile). */
  hideHeart?: boolean;
  /** Favourites only: a sold item keeps its heart there so you can take it off the list. Everywhere else sold cards have none. */
  heartOnSold?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const name = useLocalName();
  const reference = useReference();
  const { data: session } = authClient.useSession();
  const toggle = useToggleFavourite();
  const [favourited, setFavourited] = useState(listing.isFavourited ?? false);
  useEffect(() => {
    setFavourited(listing.isFavourited ?? false);
  }, [listing.isFavourited]);
  const sold = listing.status === "sold";
  const priceDrop = listing.previousPriceMinor !== null && listing.previousPriceMinor > listing.priceMinor;
  const percentOff = priceDrop
    ? Math.round((1 - listing.priceMinor / (listing.previousPriceMinor as number)) * 100)
    : 0;

  const viewerId = session?.user.id;
  const isOwn = Boolean(viewerId) && listing.seller?.id === viewerId;
  const showHeart = Boolean(viewerId) && !isOwn && !hideHeart && (!sold || heartOnSold);

  const conditionName = listing.conditionSlug
    ? name(reference.data?.conditions.find((c) => c.slug === listing.conditionSlug)?.name)
    : "";
  const meta = [listing.brandName ?? listing.title, listing.sizeLabel, conditionName]
    .filter(Boolean)
    .join(" · ");

  const onHeart = () => {
    const next = !favourited;
    setFavourited(next);
    toggle.mutate({ id: listing.id, favourite: next }, { onError: () => setFavourited(!next) });
  };

  return (
    <Pressable
      className="flex-1 active:scale-[0.98]"
      role="button"
      accessibilityLabel={listing.title}
      onPress={() => router.push({ pathname: "/listing/[id]", params: { id: listing.id } })}
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
        {sold ? <View className="absolute inset-0 bg-background opacity-60" /> : null}
        <View className="absolute bottom-sm start-sm">
          {sold ? (
            <Badge variant="success" icon={Check} label={t("listing.sold")} />
          ) : priceDrop ? (
            <Badge variant="accent" icon={TrendingDown} label={t("listing.priceDrop")} />
          ) : listing.isBumped ? (
            <Badge variant="accent" icon={Zap} label={t("listing.bumped")} />
          ) : null}
        </View>
      </View>
      <View className="gap-px pt-sm">
        <View className="min-h-7 flex-row items-center gap-xs">
          <Text
            variant="title"
            className={cn(
              "flex-1 text-[20px] leading-[24px]",
              sold ? "text-text-4 line-through" : "text-primary",
            )}
            numberOfLines={1}
          >
            {formatMoney(listing.priceMinor, listing.currency)}
          </Text>
          {showHeart ? (
            <Pressable
              onPress={onHeart}
              hitSlop={8}
              role="button"
              accessibilityLabel={favourited ? t("browse.unfavourite") : t("browse.favourite")}
              accessibilityState={{ selected: favourited }}
              className="h-7 w-7 items-center justify-center"
            >
              <Icon
                as={Heart}
                size={20}
                color={favourited ? colors.error : colors.text1}
                fill={favourited ? colors.error : "none"}
              />
            </Pressable>
          ) : null}
        </View>
        {meta ? (
          <Text variant="cardMeta" weight={600} className="uppercase tracking-wide" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {priceDrop && !sold ? (
          <Text variant="cardMeta">
            {t("listing.was", { price: formatMoney(listing.previousPriceMinor as number, listing.currency) })}
            {` · ${t("listing.percentOff", { percent: percentOff })}`}
          </Text>
        ) : null}
        <PricePill
          className="mt-xs"
          amountMinor={listing.buyerPriceMinor}
          currency={listing.currency}
          muted={sold}
        />
      </View>
    </Pressable>
  );
}

export { ListingCard };
