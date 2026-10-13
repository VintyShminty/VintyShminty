import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useInfiniteQuery } from "@tanstack/react-query";
import { type ListingDetail, messagePageSchema } from "@vinty/shared";
import { useRouter } from "expo-router";
import { Check, Clock, Moon, ShieldCheck } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, View } from "react-native";
import { DetailRow } from "@/components/item/detail-row";
import { FavouritePill } from "@/components/item/favourite-pill";
import { MoreMenu } from "@/components/item/more-menu";
import { ListingGrid } from "@/components/listing-grid";
import { OfferSheet } from "@/components/offer/offer-sheet";
import { PhotoCarousel } from "@/components/photo-carousel";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { StarRating } from "@/components/ui/star-rating";
import { Text } from "@/components/ui/text";
import { ForwardIcon, TopBar } from "@/components/ui/top-bar";
import { api } from "@/lib/api";
import { similarQuery } from "@/lib/item-queries";
import { useStartConversation } from "@/lib/messaging-queries";
import { formatMoney } from "@/lib/money";
import { useSendOffer } from "@/lib/order-flow-queries";
import { useLocalName } from "@/lib/reference";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

/** A paragraph cut after three lines with a "Show more" link (docs/components.md, ExpandableText). */
function ExpandableText({ text }: { text: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  return (
    <View className="gap-xs">
      <Text
        numberOfLines={expanded ? undefined : 3}
        onTextLayout={(e) => {
          if (!expanded) setTruncated(e.nativeEvent.lines.length > 3);
        }}
      >
        {text}
      </Text>
      {truncated || expanded ? (
        <Text
          variant="bodySmall"
          weight={600}
          className="self-start text-primary underline"
          role="button"
          onPress={() => setExpanded((v) => !v)}
        >
          {expanded ? t("item.showLess") : t("item.showMore")}
        </Text>
      ) : null}
    </View>
  );
}

function StatusLine({ listing }: { listing: ListingDetail }) {
  const { t } = useTranslation();
  if (listing.status === "sold") {
    return (
      <View className="flex-row items-center gap-sm">
        <Badge variant="success" icon={Check} label={t("listing.sold")} />
        <Text variant="bodySmall" className="flex-1 text-text-3">
          {t("item.soldNote")}
        </Text>
      </View>
    );
  }
  if (listing.status === "reserved") {
    return (
      <View className="flex-row items-center gap-sm">
        <Badge variant="warning" icon={Clock} label={t("listing.reserved")} />
        <Text variant="bodySmall" className="flex-1 text-text-3">
          {t("item.reservedNote")}
        </Text>
      </View>
    );
  }
  return null;
}

/**
 * The item page for a buyer (spec, Item page): photos, heart with count, title, price block, away notice,
 * details, description, the seller card and More like this. Buy now, Make an offer and Message seller sit under the price.
 */
function BuyerView({ listing }: { listing: ListingDetail }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const name = useLocalName();
  const similar = useInfiniteQuery(similarQuery(listing.id));
  const startChat = useStartConversation();
  const existingChat = listing.viewer.conversationId;
  // A new chat about a sold item is refused by the server, an old one stays open.
  const canMessage = Boolean(existingChat) || listing.status !== "sold";

  const messageSeller = () => {
    if (existingChat) return router.push({ pathname: "/conversation/[id]", params: { id: existingChat } });
    startChat.mutate(listing.id, {
      onSuccess: (chat) => router.push({ pathname: "/conversation/[id]", params: { id: chat.id } }),
      onError: () => Alert.alert(t("item.chatFailed")),
    });
  };
  const sendOffer = useSendOffer();
  const offerSheet = useRef<BottomSheetModal>(null);
  const [buying, setBuying] = useState(false);

  // Buy now. An item held for me after an accepted offer is bought at that offer's price, not the listed one.
  const buyNow = async () => {
    if (buying) return;
    setBuying(true);
    try {
      if (listing.status === "reserved" && existingChat) {
        const page = await api(`/v1/conversations/${existingChat}/messages?limit=30`, {
          schema: messagePageSchema,
        }).catch(() => null);
        const accepted = page?.items.find(
          (m) => m.offer?.status === "accepted" && new Date(m.offer.expiresAt).getTime() > Date.now(),
        );
        if (accepted?.offer) {
          router.push({ pathname: "/checkout", params: { offerId: accepted.offer.id } });
          return;
        }
      }
      router.push({ pathname: "/checkout", params: { listingId: listing.id } });
    } finally {
      setBuying(false);
    }
  };

  // The offer goes into the chat about this item (made first when there is none), then the chat opens.
  const makeOffer = async (amountMinor: number) => {
    const chatId = existingChat ?? (await startChat.mutateAsync(listing.id)).id;
    await sendOffer.mutateAsync({ conversationId: chatId, amountMinor });
    setTimeout(() => router.push({ pathname: "/conversation/[id]", params: { id: chatId } }), 250);
  };
  const sold = listing.status === "sold";
  // A published listing always has a price. Only the owner's drafts can lack one.
  const price = listing.priceMinor ?? 0;
  const buyerPrice = listing.buyerPriceMinor ?? price;
  const priceDrop = listing.previousPriceMinor !== null && listing.previousPriceMinor > price;
  const percentOff = priceDrop ? Math.round((1 - price / (listing.previousPriceMinor as number)) * 100) : 0;
  const seller = listing.seller;
  const sellerName = seller.username ?? t("profile.closedAccount");

  return (
    <Screen bottomInset={false}>
      <TopBar
        trailing={<MoreMenu targetType="listing" targetId={listing.id} reportLabel={t("item.reportItem")} />}
      />
      <ListingGrid
        query={similar}
        emptyTitle={t("item.noSimilar")}
        bottomPadding={32}
        header={
          <View>
            <PhotoCarousel photos={listing.photos} />
            <View className="gap-lg px-lg pt-lg">
              <StatusLine listing={listing} />

              <View className="flex-row items-start gap-md">
                <View className="flex-1 gap-xs">
                  <Text variant="itemName" className="text-[24px] leading-[28px]">
                    {listing.title}
                  </Text>
                  <Text variant="bodySmall" className="text-text-3">
                    {[listing.brand?.name, listing.size?.label, name(listing.condition?.name)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                {sold ? null : <FavouritePill listing={listing} />}
              </View>

              <View className="gap-xs">
                <Text
                  variant="title"
                  className={cn(sold ? "text-text-4 line-through" : "text-primary")}
                  accessibilityLabel={formatMoney(price, listing.currency)}
                >
                  {formatMoney(price, listing.currency)}
                </Text>
                {priceDrop && !sold ? (
                  <Text variant="bodySmall" className="text-text-3">
                    {t("listing.was", {
                      price: formatMoney(listing.previousPriceMinor as number, listing.currency),
                    })}
                    {` · ${t("listing.percentOff", { percent: percentOff })}`}
                  </Text>
                ) : null}
                {!sold ? (
                  <View className="flex-row items-center gap-xs">
                    <Icon as={ShieldCheck} size={16} className="text-primary" />
                    <Text variant="bodySmall" className="flex-1 text-text-2">
                      {t("listing.buyerPays", { price: formatMoney(buyerPrice, listing.currency) })}
                    </Text>
                  </View>
                ) : null}
              </View>

              {listing.viewer.canBuy ? (
                <Button size="lg" loading={buying} onPress={() => void buyNow()}>
                  <Text>{t("item.buyNow")}</Text>
                </Button>
              ) : null}
              {listing.viewer.canOffer ? (
                <Button variant="outline" size="lg" onPress={() => offerSheet.current?.present()}>
                  <Text>{t("item.makeOffer")}</Text>
                </Button>
              ) : null}

              {canMessage ? (
                <Button
                  variant={listing.viewer.canBuy || listing.viewer.canOffer ? "ghost" : "outline"}
                  size="lg"
                  loading={startChat.isPending}
                  onPress={messageSeller}
                >
                  <Text>{t("item.messageSeller")}</Text>
                </Button>
              ) : null}

              {listing.sellerOnHoliday ? (
                <View className="flex-row items-start gap-sm rounded-control border border-warning bg-warning-tint p-md">
                  <Icon as={Moon} size={18} className="mt-px text-warning" />
                  <Text variant="bodySmall" className="flex-1 text-warning">
                    {listing.sellerAwayUntil
                      ? t("item.away", {
                          name: sellerName,
                          date: new Date(listing.sellerAwayUntil).toLocaleDateString(i18n.language, {
                            day: "numeric",
                            month: "short",
                          }),
                        })
                      : t("item.awayNoDate", { name: sellerName })}
                  </Text>
                </View>
              ) : null}

              <View>
                <Text variant="sectionLabel" className="pb-xs">
                  {t("listing.details")}
                </Text>
                <DetailRow
                  label={t("sell.category")}
                  value={listing.category?.breadcrumb.map((b) => name(b.name)).join(", ")}
                />
                <DetailRow label={t("sell.brand")} value={listing.brand?.name} />
                <DetailRow label={t("sell.size")} value={listing.size?.label} />
                <DetailRow label={t("sell.condition")} value={name(listing.condition?.name)} />
                <DetailRow
                  label={t("sell.colours")}
                  value={listing.colours.map((c) => name(c.name)).join(", ")}
                />
                <DetailRow label={t("sell.material")} value={name(listing.material?.name)} />
                <DetailRow label={t("sell.pattern")} value={name(listing.pattern?.name)} />
                <DetailRow
                  label={t("listing.uploaded")}
                  value={listing.publishedAt ? timeAgo(listing.publishedAt, t) : null}
                />
                <DetailRow label={t("item.views")} value={String(listing.viewCount)} />
              </View>

              {listing.description ? (
                <View className="gap-xs">
                  <Text variant="sectionLabel">{t("listing.description")}</Text>
                  <ExpandableText text={listing.description} />
                </View>
              ) : null}

              <View className="gap-sm">
                <Text variant="sectionLabel">{t("item.seller")}</Text>
                <Pressable
                  onPress={() => router.push({ pathname: "/user/[id]", params: { id: seller.id } })}
                  role="button"
                  accessibilityLabel={sellerName}
                  className="flex-row items-center gap-md rounded-control border border-border-subtle p-md active:bg-surface"
                >
                  <Avatar uri={seller.avatarUrl} name={seller.username} size={48} />
                  <View className="flex-1 gap-xs">
                    <Text weight={600} numberOfLines={1} className="self-start">
                      {sellerName}
                    </Text>
                    <View className="flex-row items-center gap-sm">
                      {seller.reviewCount > 0 ? (
                        <>
                          <StarRating rating={seller.ratingAverage} />
                          <Text variant="cardMeta">
                            {t("profile.reviewCount", { count: seller.reviewCount })}
                          </Text>
                        </>
                      ) : (
                        <Text variant="cardMeta">{t("item.noReviews")}</Text>
                      )}
                    </View>
                  </View>
                  <ForwardIcon />
                </Pressable>
              </View>
            </View>

            <Text variant="sectionLabel" className="px-lg pb-md pt-xl">
              {t("item.moreLikeThis")}
            </Text>
          </View>
        }
      />
      {listing.viewer.canOffer ? (
        <OfferSheet
          ref={offerSheet}
          mode="make"
          listingPriceMinor={price}
          currency={listing.currency}
          showQuota
          onSend={makeOffer}
        />
      ) : null}
    </Screen>
  );
}

export { BuyerView };
