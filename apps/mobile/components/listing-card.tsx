import type { ListingCard as ListingCardData } from "@vinty/shared";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Check, Heart, Sparkles, TrendingDown } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { formatMoney } from "@/lib/money";
import { useToggleFavourite } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

/**
 * Item card, option C (D-007): portrait 3:4 photo with 12px corners, outline badge bottom-start,
 * brand in bold, two line description, price in espresso with the buyer price under it.
 * The white circle heart sits top-end on the photo for a signed in viewer, never on your own items. Sold items have none, except on the Favourites screen (heartOnSold).
 * The heart changes at once and goes back if the server says no. Tapping the card opens the item page.
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
  const { data: session } = authClient.useSession();
  const toggle = useToggleFavourite();
  const [favourited, setFavourited] = useState(listing.isFavourited ?? false);
  const [count, setCount] = useState(listing.favouriteCount);
  useEffect(() => {
    setFavourited(listing.isFavourited ?? false);
    setCount(listing.favouriteCount);
  }, [listing.isFavourited, listing.favouriteCount]);
  const sold = listing.status === "sold";
  const priceDrop = listing.previousPriceMinor !== null && listing.previousPriceMinor > listing.priceMinor;
  const percentOff = priceDrop
    ? Math.round((1 - listing.priceMinor / (listing.previousPriceMinor as number)) * 100)
    : 0;

  const viewerId = session?.user.id;
  const isOwn = Boolean(viewerId) && listing.seller?.id === viewerId;
  const showHeart = Boolean(viewerId) && !isOwn && !hideHeart && (!sold || heartOnSold);

  const onHeart = () => {
    const next = !favourited;
    setFavourited(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    toggle.mutate(
      { id: listing.id, favourite: next },
      {
        onError: () => {
          setFavourited(!next);
          setCount((c) => Math.max(0, c + (next ? -1 : 1)));
        },
      },
    );
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
        {showHeart ? (
          <Pressable
            onPress={onHeart}
            hitSlop={6}
            role="button"
            accessibilityLabel={favourited ? t("browse.unfavourite") : t("browse.favourite")}
            accessibilityState={{ selected: favourited }}
            className="absolute end-sm top-sm h-8 w-8 items-center justify-center rounded-full bg-background"
          >
            <Icon
              as={Heart}
              size={16}
              color={favourited ? colors.error : colors.text1}
              fill={favourited ? colors.error : "none"}
            />
          </Pressable>
        ) : null}
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
        <View className="flex-row items-center gap-xs">
          <Text variant="cardBrand" numberOfLines={1} className="flex-1">
            {listing.brandName ?? listing.title}
          </Text>
          {count > 0 ? (
            <View className="flex-row items-center gap-px">
              <Icon as={Heart} size={11} className="text-text-3" />
              <Text variant="cardMeta">{count}</Text>
            </View>
          ) : null}
        </View>
        {listing.brandName ? (
          <Text variant="cardDesc" numberOfLines={2}>
            {listing.title}
          </Text>
        ) : null}
        {listing.sizeLabel ? <Text variant="cardMeta">{listing.sizeLabel}</Text> : null}
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
    </Pressable>
  );
}

export { ListingCard };
