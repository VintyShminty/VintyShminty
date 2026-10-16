import { bundleSavedMinor } from "@vinty/shared";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { liveBundleItems, type useSellerBundle } from "@/lib/bundle-queries";
import { formatMoney } from "@/lib/money";

/** Height of the bar without the home indicator space. Pages add this to their bottom padding while the bar shows. */
const BUNDLE_BAR_HEIGHT = 72;

/** True while the bar shows: a bundle with this seller holds an item and their bundles are on. */
function bundleBarVisible(seller: ReturnType<typeof useSellerBundle>) {
  return Boolean(seller.ladder?.on && liveBundleItems(seller.bundle).length > 0);
}

/**
 * The slim dark bar at the bottom while the viewer has a bundle with this seller (D-049, decision 3: only on that
 * seller's item pages and profile). The count and saving (no photos: on a phone they would cut off the saving), the next step and View bundle.
 */
function BundleBar({ sellerId, seller }: { sellerId: string; seller: ReturnType<typeof useSellerBundle> }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bundle = seller.bundle;
  if (!bundle || !bundleBarVisible(seller)) return null;

  const items = liveBundleItems(bundle);
  const saved = bundleSavedMinor(bundle);
  const summary = t(bundle.discountPercent > 0 ? "bundle.barCountOff" : "bundle.barCount", {
    count: items.length,
    percent: bundle.discountPercent,
  });

  return (
    <View
      className="absolute inset-x-0 bottom-0 flex-row items-center gap-md bg-primary px-lg pt-sm"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <View className="min-w-0 flex-1" accessibilityLiveRegion="polite">
        <Text variant="bodySmall" weight={600} numberOfLines={1} className="text-primary-foreground">
          {saved > 0
            ? `${summary} · ${t("bundle.barSave", { amount: formatMoney(saved, bundle.currency) })}`
            : summary}
        </Text>
        {bundle.nextTier ? (
          <Text variant="cardMeta" numberOfLines={1} className="text-primary-foreground opacity-80">
            {t("bundle.barNext", { count: bundle.nextTier.addItems, percent: bundle.nextTier.percentOff })}
          </Text>
        ) : null}
      </View>
      <Button
        size="sm"
        variant="secondary"
        onPress={() => router.push({ pathname: "/bundle/[sellerId]", params: { sellerId } })}
      >
        <Text>{t("bundle.view")}</Text>
      </Button>
    </View>
  );
}

export { BUNDLE_BAR_HEIGHT, BundleBar, bundleBarVisible };
