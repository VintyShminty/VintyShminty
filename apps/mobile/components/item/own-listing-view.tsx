import { useQuery } from "@tanstack/react-query";
import type { ListingDetail } from "@vinty/shared";
import { useRouter } from "expo-router";
import { Check, Clock, Eye, EyeOff, Heart, Pencil, ShieldCheck, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DetailRow } from "@/components/item/detail-row";
import { PhotoCarousel } from "@/components/photo-carousel";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { describeApiError } from "@/lib/auth-errors";
import { formatMoney } from "@/lib/money";
import { ownListingQuery, useDeleteListing, useListingStatus } from "@/lib/queries";
import { useLocalName, useReference } from "@/lib/reference";
import { timeAgo } from "@/lib/time";

function StatusNote({ listing }: { listing: ListingDetail }) {
  const { t } = useTranslation();
  const map = {
    draft: { variant: "neutral", icon: Pencil, label: t("listing.draft"), note: t("listing.draftNote") },
    reserved: {
      variant: "warning",
      icon: Clock,
      label: t("listing.reserved"),
      note: t("listing.reservedNote"),
    },
    hidden: { variant: "neutral", icon: EyeOff, label: t("listing.hidden"), note: t("listing.hiddenNote") },
    sold: { variant: "success", icon: Check, label: t("listing.sold"), note: t("listing.soldNote") },
  } as const;
  const entry = listing.status in map ? map[listing.status as keyof typeof map] : null;
  if (!entry) return null;
  return (
    <View className="flex-row items-center gap-sm">
      <Badge variant={entry.variant} icon={entry.icon} label={entry.label} />
      <Text variant="bodySmall" className="flex-1 text-text-3">
        {entry.note}
      </Text>
    </View>
  );
}

/**
 * Your own listing (spec, Item page, seller's view): photos, details, the price block and what you can do with it.
 * Buying, offers and messages are for buyers and arrive in later milestones.
 */
export function OwnListingView({ id, placeholder }: { id: string; placeholder?: ListingDetail }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const name = useLocalName();
  const query = useQuery({ ...ownListingQuery(id), placeholderData: placeholder });
  const reference = useReference();
  const status = useListingStatus();
  const remove = useDeleteListing();
  const [banner, setBanner] = useState<string | null>(null);

  if (query.isPending) {
    return (
      <Screen>
        <TopBar />
        <Spinner size="large" />
      </Screen>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Screen>
        <TopBar />
        <View className="gap-lg px-lg">
          <Banner variant="error">{t("errors.loadFailed")}</Banner>
          <Button variant="outline" onPress={() => query.refetch()}>
            <Text>{t("common.tryAgain")}</Text>
          </Button>
        </View>
      </Screen>
    );
  }
  const listing = query.data;
  const parcel = reference.data?.parcelSizes.find((p) => p.id === listing.parcelSizeId);
  const priceDrop =
    listing.previousPriceMinor !== null &&
    listing.priceMinor !== null &&
    listing.previousPriceMinor > listing.priceMinor;
  const busy = status.isPending || remove.isPending;

  const move = (next: "active" | "hidden" | "reserved" | "sold") => {
    setBanner(null);
    status.mutate(
      { id: listing.id, status: next },
      { onError: (err) => setBanner(t(describeApiError(err).key)) },
    );
  };
  const confirmSold = () =>
    Alert.alert(t("listing.soldConfirmTitle"), t("listing.soldConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("listing.markSold"), onPress: () => move("sold") },
    ]);
  const confirmDelete = () =>
    Alert.alert(t("listing.deleteConfirmTitle"), t("listing.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("listing.delete"),
        style: "destructive",
        onPress: () =>
          remove.mutate(listing.id, {
            onSuccess: () => router.back(),
            onError: (err) => setBanner(t(describeApiError(err).key)),
          }),
      },
    ]);
  const edit = () => router.push({ pathname: "/sell-form", params: { id: listing.id } });

  return (
    <Screen bottomInset={false}>
      <TopBar title={t("listing.yourListing")} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <PhotoCarousel photos={listing.photos} />
        <View className="gap-lg px-lg pt-lg">
          <StatusNote listing={listing} />
          <View className="gap-xs">
            <Text variant="itemName" className="text-[24px] leading-[28px]">
              {listing.title || t("listing.untitled")}
            </Text>
            <Text variant="bodySmall" className="text-text-3">
              {[listing.brand?.name, listing.size?.label, name(listing.condition?.name)]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>

          <View className="gap-xs">
            <Text variant="title" className="text-primary">
              {listing.priceMinor === null
                ? t("listing.noPrice")
                : formatMoney(listing.priceMinor, listing.currency)}
            </Text>
            {priceDrop ? (
              <Text variant="bodySmall" className="text-text-3 line-through">
                {t("listing.was", {
                  price: formatMoney(listing.previousPriceMinor as number, listing.currency),
                })}
              </Text>
            ) : null}
            {listing.buyerPriceMinor !== null ? (
              <View className="flex-row items-center gap-xs">
                <Icon as={ShieldCheck} size={16} className="text-primary" />
                <Text variant="bodySmall" className="text-text-2">
                  {t("listing.buyerPays", { price: formatMoney(listing.buyerPriceMinor, listing.currency) })}
                </Text>
              </View>
            ) : null}
          </View>

          {listing.status !== "draft" ? (
            <View className="flex-row gap-xl">
              <View className="flex-row items-center gap-xs">
                <Icon as={Eye} size={16} className="text-text-3" />
                <Text variant="bodySmall" className="text-text-2">
                  {t("listing.views", { count: listing.viewCount })}
                </Text>
              </View>
              <View className="flex-row items-center gap-xs">
                <Icon as={Heart} size={16} className="text-text-3" />
                <Text variant="bodySmall" className="text-text-2">
                  {t("listing.favourites", { count: listing.favouriteCount })}
                </Text>
              </View>
            </View>
          ) : null}

          {banner ? <Banner variant="error">{banner}</Banner> : null}

          <View className="gap-sm">
            {listing.status === "sold" ? null : (
              <Button size="lg" onPress={edit} disabled={busy}>
                <Icon as={Pencil} size={18} />
                <Text>{listing.status === "draft" ? t("listing.continueEditing") : t("listing.edit")}</Text>
              </Button>
            )}
            {listing.status === "active" ? (
              <Button variant="outline" size="lg" onPress={() => move("reserved")} disabled={busy}>
                <Text>{t("listing.markReserved")}</Text>
              </Button>
            ) : null}
            {listing.status === "reserved" ? (
              <Button variant="outline" size="lg" onPress={() => move("active")} disabled={busy}>
                <Text>{t("listing.unreserve")}</Text>
              </Button>
            ) : null}
            {listing.status === "active" ? (
              <Button variant="outline" size="lg" onPress={() => move("hidden")} disabled={busy}>
                <Text>{t("listing.hide")}</Text>
              </Button>
            ) : null}
            {listing.status === "hidden" ? (
              <Button variant="outline" size="lg" onPress={() => move("active")} disabled={busy}>
                <Text>{t("listing.unhide")}</Text>
              </Button>
            ) : null}
            {listing.status === "active" || listing.status === "reserved" ? (
              <Button variant="outline" size="lg" onPress={confirmSold} disabled={busy}>
                <Text>{t("listing.markSold")}</Text>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="lg"
              onPress={confirmDelete}
              disabled={busy}
              loading={remove.isPending}
            >
              <Icon as={Trash2} size={18} className="text-destructive" />
              <Text className="text-destructive">{t("listing.delete")}</Text>
            </Button>
          </View>

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
            <DetailRow label={t("listing.parcel")} value={name(parcel?.name)} />
            <DetailRow
              label={t("listing.uploaded")}
              value={listing.publishedAt ? timeAgo(listing.publishedAt, t) : null}
            />
          </View>

          {listing.description ? (
            <View className="gap-xs">
              <Text variant="sectionLabel">{t("listing.description")}</Text>
              <Text>{listing.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
