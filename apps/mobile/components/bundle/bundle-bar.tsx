import { bundleDiscountPercentFor, bundleSavedMinor, nextBundleTier } from "@vinty/shared";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated, { Easing, FadeInDown, FadeOutDown, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { useSellerBundle } from "@/lib/bundle-queries";
import { formatMoney } from "@/lib/money";
import { TAB_BAR_HEIGHT, TAB_BAR_SIDE_GAP } from "@/lib/tab-bar";
import { colors } from "@/theme";

/** Air between the bundle bar and the tab bar under it, enough to clear the raised Sell button. */
const BAR_GAP = 20;
/** The room the bar takes above the tab bar. Pages add this to their bottom padding while the bar shows. */
const BUNDLE_BAR_HEIGHT = TAB_BAR_HEIGHT + BAR_GAP;

/** The pill rises a little and fades in when it appears, and sinks away when the bundle empties. Off with Reduce Motion. */
const appear = FadeInDown.duration(260)
  .easing(Easing.bezier(0.23, 1, 0.32, 1))
  .reduceMotion(ReduceMotion.System);
const leave = FadeOutDown.duration(180)
  .easing(Easing.bezier(0.23, 1, 0.32, 1))
  .reduceMotion(ReduceMotion.System);

/** True while the bar shows: the buyer just added an item for this seller, the bundle still holds one and their bundles are on. */
function bundleBarVisible(seller: ReturnType<typeof useSellerBundle>) {
  return Boolean(seller.ladder?.on && seller.barShown);
}

/**
 * The espresso pill floating just above the tab bar, the same shape and shadow as the tab bar (D-050), on that seller's
 * item pages and profile only (D-049, decision 3). The count and saving (no photos: on a phone they would cut off the
 * saving), the next step and View bundle.
 */
function BundleBar({ sellerId, seller }: { sellerId: string; seller: ReturnType<typeof useSellerBundle> }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bundle, ladder, count, busy } = seller;
  if (!ladder || !bundleBarVisible(seller)) return null;

  // Count, percent and next step come from the steps, so the pill moves the moment you tap, together with the box.
  // The saving needs the server's prices: once it answers, it takes the percent's place on the same line.
  const percent = bundleDiscountPercentFor(ladder.tiers, count);
  const next = nextBundleTier(ladder.tiers, count);
  const saved = bundle && !busy ? bundleSavedMinor(bundle) : 0;
  const summary =
    bundle && saved > 0
      ? `${t("bundle.barCount", { count })} · ${t("bundle.barSave", { amount: formatMoney(saved, bundle.currency) })}`
      : t(percent > 0 ? "bundle.barCountOff" : "bundle.barCount", { count, percent });

  return (
    // Inside a tab the bottom inset already ends 12 points above the floating tab bar (TabStack), so the pill sits on top of it.
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0"
      style={{ bottom: insets.bottom + BAR_GAP - 12, paddingHorizontal: TAB_BAR_SIDE_GAP }}
    >
      <Animated.View
        entering={appear}
        exiting={leave}
        className="flex-row items-center gap-md rounded-bar bg-primary pe-sm ps-xl"
        style={{
          height: TAB_BAR_HEIGHT,
          shadowColor: colors.text1,
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <View className="min-w-0 flex-1" accessibilityLiveRegion="polite">
          <Text variant="bodySmall" weight={600} numberOfLines={1} className="text-primary-foreground">
            {summary}
          </Text>
          {next ? (
            <Text variant="cardMeta" numberOfLines={1} className="text-primary-foreground opacity-80">
              {t("bundle.barNext", { count: next.addItems, percent: next.percentOff })}
            </Text>
          ) : null}
        </View>
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full px-lg"
          onPress={() => router.push({ pathname: "/bundle/[sellerId]", params: { sellerId } })}
        >
          <Text>{t("bundle.view")}</Text>
        </Button>
      </Animated.View>
    </View>
  );
}

export { BUNDLE_BAR_HEIGHT, BundleBar, bundleBarVisible };
