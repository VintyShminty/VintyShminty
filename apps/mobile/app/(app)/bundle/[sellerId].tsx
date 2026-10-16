import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { bundleSavedMinor, type ListingCard } from "@vinty/shared";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Percent } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StepsBar } from "@/components/bundle/steps-bar";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { formatMoney } from "@/lib/money";
import { bundleQuery, useOpenBundle, useToggleBundleItem } from "@/lib/order-flow-queries";
import { userListingsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Fewest items that make a bundle. */
const MIN_ITEMS = 2;

function PickCard({
  listing,
  selected,
  busy,
  onToggle,
}: {
  listing: ListingCard;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={busy}
      role="checkbox"
      accessibilityState={{ checked: selected, busy }}
      accessibilityLabel={`${listing.title}, ${formatMoney(listing.priceMinor, listing.currency)}`}
      className="flex-1 active:scale-[0.98]"
    >
      <View
        className={cn(
          "aspect-[3/4] overflow-hidden rounded-control border-2 bg-pressed",
          selected ? "border-primary" : "border-transparent",
        )}
      >
        {listing.cover ? (
          <Image
            source={{ uri: listing.cover.url }}
            placeholder={listing.cover.placeholder ?? undefined}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={120}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <View className="absolute end-sm top-sm rounded-[8px] bg-background p-[3px]">
          <Checkbox checked={selected} />
        </View>
      </View>
      <View className="gap-px pt-sm">
        <Text variant="cardBrand" numberOfLines={1}>
          {listing.brandName ?? listing.title}
        </Text>
        <Text variant="cardDesc" numberOfLines={1}>
          {listing.title}
        </Text>
        <Text variant="bodySmall" weight={700} className="text-primary">
          {formatMoney(listing.priceMinor, listing.currency)}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Shop bundle: pick several items from one seller, see the discount grow, then go to checkout with the bundle.
 * The bundle lives on the server, so every tap adds or removes one item and the totals come back from there.
 */
export default function BundleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sellerId } = useLocalSearchParams<{ sellerId: string }>();
  const open = useOpenBundle();
  const toggle = useToggleBundleItem();
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !sellerId) return;
    started.current = true;
    open.mutate(sellerId, { onSuccess: (b) => setBundleId(b.id) });
  }, [sellerId, open]);

  const bundle = useQuery({ ...bundleQuery(bundleId ?? ""), enabled: bundleId !== null });
  const listings = useInfiniteQuery(userListingsQuery(sellerId, "active"));
  const items = useMemo(() => listings.data?.pages.flatMap((p) => p.items) ?? [], [listings.data]);
  const b = bundle.data;
  const chosen = useMemo(
    () =>
      new Set(
        b?.items.filter((i) => i.status === "active" || i.status === "reserved").map((i) => i.listingId),
      ),
    [b],
  );
  const rows = useMemo(() => {
    const out: { key: string; left: ListingCard; right?: ListingCard }[] = [];
    for (let i = 0; i < items.length; i += 2) {
      const left = items[i] as ListingCard;
      out.push({ key: left.id, left, right: items[i + 1] });
    }
    return out;
  }, [items]);

  const flip = (listing: ListingCard) => {
    if (!bundleId || busyId) return;
    setBusyId(listing.id);
    setFailed(false);
    toggle.mutate(
      { bundleId, listingId: listing.id, add: !chosen.has(listing.id) },
      { onError: () => setFailed(true), onSettled: () => setBusyId(null) },
    );
  };

  const count = b?.itemCount ?? 0;
  const saved = b ? bundleSavedMinor(b) : 0;
  const soldOut = (b?.items ?? []).filter((i) => i.status === "sold");
  let tierLine = t("bundle.pickMore", { count: MIN_ITEMS });
  if (b) {
    if (b.discountPercent > 0 && b.nextTier) {
      tierLine = t("bundle.tierNext", {
        percent: b.discountPercent,
        count: b.nextTier.addItems,
        next: b.nextTier.percentOff,
      });
    } else if (b.discountPercent > 0) {
      tierLine = t("bundle.tierTop", { percent: b.discountPercent });
    } else if (b.nextTier) {
      tierLine = t("bundle.addMore", { count: b.nextTier.addItems, percent: b.nextTier.percentOff });
    }
  }

  return (
    <Screen bottomInset={false}>
      <TopBar leading="back" title={t("bundle.title")} />
      {open.isError ? (
        <View className="gap-md px-lg pt-lg">
          <Banner variant="error">{t("bundle.openFailed")}</Banner>
          <Button
            variant="outline"
            onPress={() => open.mutate(sellerId, { onSuccess: (x) => setBundleId(x.id) })}
          >
            <Text>{t("common.tryAgain")}</Text>
          </Button>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (listings.hasNextPage && !listings.isFetchingNextPage) void listings.fetchNextPage();
          }}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <View className="gap-sm px-lg pb-md pt-sm">
              <View className="flex-row items-center gap-sm rounded-control border border-border bg-accent-tint p-md">
                <Icon as={Percent} size={18} className="text-primary" />
                <Text variant="bodySmall" weight={600} className="flex-1 text-primary">
                  {tierLine}
                </Text>
              </View>
              {b && b.tiers.length > 0 ? <StepsBar bundle={b} minItems={MIN_ITEMS} /> : null}
              {failed ? <Banner variant="error">{t("bundle.changeFailed")}</Banner> : null}
            </View>
          }
          ListEmptyComponent={listings.isPending || !b ? <Spinner /> : null}
          ListFooterComponent={listings.isFetchingNextPage ? <Spinner /> : null}
          renderItem={({ item }) => (
            <View className="flex-row gap-md px-lg pt-lg">
              <PickCard
                listing={item.left}
                selected={chosen.has(item.left.id)}
                busy={busyId === item.left.id}
                onToggle={() => flip(item.left)}
              />
              {item.right ? (
                <PickCard
                  listing={item.right}
                  selected={chosen.has(item.right.id)}
                  busy={busyId === item.right.id}
                  onToggle={() => flip(item.right as ListingCard)}
                />
              ) : (
                <View className="flex-1" />
              )}
            </View>
          )}
        />
      )}
      {b ? (
        <View
          className="gap-sm border-t border-border-subtle bg-background px-lg pt-md"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {soldOut.map((i) => (
            <Text key={i.listingId} variant="cardDesc" className="text-text-4">
              {i.title} · {t("bundle.soldRemoved")}
            </Text>
          ))}
          <View className="flex-row items-baseline justify-between">
            <Text variant="bodySmall" className="text-text-2">
              {t("bundle.selected", { count })}
            </Text>
            <View className="flex-row items-baseline gap-sm">
              {b.discountMinor > 0 ? (
                <Text variant="cardDesc" className="text-text-3 line-through">
                  {formatMoney(b.subtotalMinor, b.currency)}
                </Text>
              ) : null}
              <Text weight={700}>{formatMoney(b.netMinor, b.currency)}</Text>
            </View>
          </View>
          {b.discountMinor > 0 ? (
            <View className="flex-row items-baseline justify-between">
              <Text variant="bodySmall" className="text-text-2">
                {t("bundle.discountLine", { percent: b.discountPercent })}
              </Text>
              <Text variant="bodySmall" weight={500} className="text-success">
                -{formatMoney(b.discountMinor, b.currency)}
              </Text>
            </View>
          ) : null}
          {b.postageTogetherMinor > 0 && count > 0 ? (
            <View className="flex-row items-baseline justify-between">
              <Text variant="bodySmall" className="text-text-2">
                {t("bundle.postageOne")}
              </Text>
              <View className="flex-row items-baseline gap-sm">
                {b.postageSeparateMinor > b.postageTogetherMinor ? (
                  <Text variant="cardDesc" className="text-text-4 line-through">
                    {formatMoney(b.postageSeparateMinor, b.currency)}
                  </Text>
                ) : null}
                <Text variant="bodySmall" weight={500}>
                  {formatMoney(b.postageTogetherMinor, b.currency)}
                </Text>
              </View>
            </View>
          ) : null}
          {saved > 0 ? (
            <View className="rounded-control bg-success-tint px-md py-sm">
              <Text
                variant="bodySmall"
                weight={600}
                className="text-success"
                accessibilityLiveRegion="polite"
              >
                {t("bundle.saveLine", { amount: formatMoney(saved, b.currency) })}
              </Text>
            </View>
          ) : null}
          <Button
            size="lg"
            disabled={count < MIN_ITEMS || busyId !== null}
            onPress={() => router.push({ pathname: "/checkout", params: { bundleId: b.id } })}
          >
            <Text>
              {count < MIN_ITEMS ? t("bundle.pickMore", { count: MIN_ITEMS }) : t("bundle.continue")}
            </Text>
          </Button>
        </View>
      ) : null}
    </Screen>
  );
}
