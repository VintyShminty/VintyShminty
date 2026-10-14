import type { ListingCard as ListingCardData } from "@vinty/shared";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Bookmark, Check, TrendingDown, Zap } from "lucide-react-native";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { CoveredLine } from "@/components/price-pill";
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
 * Item card, the price tag on photo card (D-032, supersedes D-007 and the D-019 card): portrait 3:4 photo with 12px
 * corners. On the photo: the status badge top-start, the save bookmark in a white circle top-end, and the seller
 * price on a small white paper tag bottom-start (a price drop shows the muted struck old price inside the tag).
 * Below: the title on one line, size and condition, and the Covered buyer price as a tiny muted line. The bookmark
 * shows for a signed in viewer, never on your own items. Sold items have none, except on the Favourites screen
 * (saveOnSold). It changes at once and goes back if the server says no. Tapping the card opens the item page.
 */
function ListingCard({
  listing,
  hideSave = false,
  saveOnSold = false,
  onLongPress,
}: {
  listing: ListingCardData;
  /** Set where the cards are known to be the viewer's own (for example their own profile). */
  hideSave?: boolean;
  /** Favourites only: a sold item keeps its bookmark there so you can take it off the list. Everywhere else sold cards have none. */
  saveOnSold?: boolean;
  /** Home only: a long press (or the screen reader action) opens "Why you see this". */
  onLongPress?: (listing: ListingCardData) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const name = useLocalName();
  const reference = useReference();
  const { data: session } = authClient.useSession();
  const toggle = useToggleFavourite();
  const [saved, setSaved] = useState(listing.isFavourited ?? false);
  useEffect(() => {
    setSaved(listing.isFavourited ?? false);
  }, [listing.isFavourited]);
  const sold = listing.status === "sold";
  const priceDrop = listing.previousPriceMinor !== null && listing.previousPriceMinor > listing.priceMinor;

  const viewerId = session?.user.id;
  const isOwn = Boolean(viewerId) && listing.seller?.id === viewerId;
  const showSave = Boolean(viewerId) && !isOwn && !hideSave && (!sold || saveOnSold);

  const conditionName = listing.conditionSlug
    ? name(reference.data?.conditions.find((c) => c.slug === listing.conditionSlug)?.name)
    : "";
  const meta = [listing.sizeLabel, conditionName].filter(Boolean).join(" · ");
  const price = formatMoney(listing.priceMinor, listing.currency);
  const label = [listing.title, price, meta, saved && showSave ? t("browse.cardSaved") : ""]
    .filter(Boolean)
    .join(", ");

  const onSave = () => {
    const next = !saved;
    setSaved(next);
    toggle.mutate({ id: listing.id, favourite: next }, { onError: () => setSaved(!next) });
  };

  return (
    <Pressable
      className="flex-1 active:scale-[0.98]"
      role="button"
      accessibilityLabel={label}
      accessibilityActions={onLongPress ? [{ name: "longpress", label: t("feedWhy.action") }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "longpress") onLongPress?.(listing);
      }}
      onLongPress={onLongPress ? () => onLongPress(listing) : undefined}
      onPress={() => router.push({ pathname: "/listing/[id]", params: { id: listing.id } })}
    >
      <View className="aspect-[3/4] overflow-hidden rounded-control bg-pressed">
        {listing.cover ? (
          <Image
            source={{ uri: listing.cover.url }}
            placeholder={listing.cover.placeholder ?? undefined}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={100}
            recyclingKey={listing.id}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {sold ? <View className="absolute inset-0 bg-background opacity-60" /> : null}
        <View className="absolute start-sm top-sm">
          {sold ? (
            <Badge variant="success" icon={Check} label={t("listing.sold")} />
          ) : priceDrop ? (
            <Badge variant="accent" icon={TrendingDown} label={t("listing.priceDrop")} />
          ) : listing.isBumped ? (
            <Badge variant="accent" icon={Zap} label={t("listing.bumped")} />
          ) : null}
        </View>
        {showSave ? (
          <Pressable
            onPress={onSave}
            hitSlop={8}
            role="button"
            accessibilityLabel={saved ? t("browse.unfavourite") : t("browse.favourite")}
            accessibilityState={{ selected: saved }}
            className="absolute end-sm top-sm h-8 w-8 items-center justify-center rounded-full bg-background"
          >
            <Icon
              as={Bookmark}
              size={18}
              color={saved ? colors.accent : colors.text1}
              fill={saved ? colors.accent : "none"}
            />
          </Pressable>
        ) : null}
        <View className="absolute bottom-sm start-sm max-w-[90%] flex-row items-baseline gap-xs rounded-[6px] border border-border-subtle bg-background px-sm py-[3px]">
          {priceDrop && !sold ? (
            <Text variant="cardMeta" className="shrink text-text-4 line-through" numberOfLines={1}>
              {formatMoney(listing.previousPriceMinor as number, listing.currency)}
            </Text>
          ) : null}
          <Text
            variant="itemName"
            className={cn(
              "shrink-0 text-[15px] leading-[20px]",
              sold ? "text-text-4 line-through" : "text-primary",
            )}
            numberOfLines={1}
          >
            {price}
          </Text>
        </View>
      </View>
      <View className="gap-[3px] pt-sm">
        <Text variant="bodySmall" weight={600} numberOfLines={1}>
          {listing.title}
        </Text>
        {meta ? (
          <Text variant="cardMeta" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        <CoveredLine
          amountMinor={listing.buyerPriceMinor}
          currency={listing.currency}
          className={sold ? "opacity-60" : undefined}
        />
      </View>
    </Pressable>
  );
}

// A card only redraws when its own item changes, not every time the screen around it does (a Home chip tap redrew
// every card on screen first, so the chip felt slow).
const MemoListingCard = memo(ListingCard);

export { MemoListingCard as ListingCard };
