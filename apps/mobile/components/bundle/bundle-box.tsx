import { bundleDiscountPercentFor } from "@vinty/shared";
import { useRouter } from "expo-router";
import { Check, Layers } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BundleSteps } from "@/components/bundle/steps";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { useSellerBundle } from "@/lib/bundle-queries";

/**
 * Grows or shrinks to its content smoothly instead of jumping, and the page under it glides along. The content sits
 * on top at its own height. The first size is taken as it is. Instant with Reduce Motion.
 */
function SmoothHeight({ children }: { children: ReactNode }) {
  const height = useSharedValue(-1);
  const style = useAnimatedStyle(() => (height.get() < 0 ? {} : { height: height.get() }));
  return (
    <Animated.View style={[{ overflow: "hidden" }, style]}>
      <View
        className="absolute inset-x-0 top-0"
        onLayout={(e) => {
          const next = e.nativeEvent.layout.height;
          height.set(
            height.get() < 0
              ? next
              : withTiming(next, {
                  duration: 260,
                  easing: Easing.bezier(0.23, 1, 0.32, 1),
                  reduceMotion: ReduceMotion.System,
                }),
          );
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

/**
 * The Bundle box on the item page, under the seller's card (D-049). Shown for an item on sale that is not yours, and
 * only when the seller's bundles are on. Three states: no bundle yet, a bundle that does not hold this item yet, and
 * this item is in. The last two have the same height (a wide button with an outline one under it), so adding or
 * removing this item does not shift the page.
 */
function BundleBox({
  sellerId,
  sellerName,
  listingId,
  seller,
}: {
  sellerId: string;
  sellerName: string;
  listingId: string;
  seller: ReturnType<typeof useSellerBundle>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { ladder, count, busy, failed, inBundle, add, remove } = seller;
  if (!ladder?.on || ladder.tiers.length === 0) return null;

  // Count and percent come from the steps, so the box changes the moment you tap, before the server answers.
  const hasThis = inBundle(listingId);
  const percent = bundleDiscountPercentFor(ladder.tiers, count);
  const view = () => router.push({ pathname: "/bundle/[sellerId]", params: { sellerId } });

  let heading = t("bundle.boxTitle", { name: sellerName });
  let line: string | null = null;
  if (count > 0) {
    if (hasThis) {
      heading = t("bundle.yourBundle");
      line = t(percent > 0 ? "bundle.isInOff" : "bundle.isIn", { count, percent });
    } else {
      line = t(percent > 0 ? "bundle.notInYetOff" : "bundle.notInYet", { count, percent });
    }
  }
  const after = bundleDiscountPercentFor(ladder.tiers, count + 1);
  const addLabel =
    count > 0 && after > percent ? t("bundle.addGain", { percent: after }) : t("bundle.addPlain");

  return (
    <View className="gap-md rounded-control border border-border-subtle p-md">
      <View className="flex-row items-center gap-sm">
        <Icon as={hasThis ? Check : Layers} size={18} className="text-primary" />
        <Text weight={600} numberOfLines={1} className="flex-1">
          {heading}
        </Text>
      </View>
      <BundleSteps tiers={ladder.tiers} count={count} />
      <SmoothHeight>
        <View className="gap-md">
          {line ? (
            <Text variant="bodySmall" accessibilityLiveRegion="polite">
              {line}
            </Text>
          ) : (
            <Text variant="bodySmall" className="text-text-3">
              {t("bundle.postageOnce")}
            </Text>
          )}
          {failed ? (
            <Text variant="bodySmall" className="text-error" role="alert">
              {t("bundle.changeFailed")}
            </Text>
          ) : null}
          {hasThis ? (
            <View className="gap-sm">
              <Button onPress={view}>
                <Text>{t("bundle.view")}</Text>
              </Button>
              <Button variant="outline" onPress={() => !busy && remove(listingId)}>
                <Text>{t("bundle.remove")}</Text>
              </Button>
            </View>
          ) : count > 0 ? (
            <View className="gap-sm">
              <Button onPress={() => !busy && add(listingId)}>
                <Text>{addLabel}</Text>
              </Button>
              <Button variant="outline" onPress={view}>
                <Text>{t("bundle.view")}</Text>
              </Button>
            </View>
          ) : (
            <Button onPress={() => !busy && add(listingId)}>
              <Text>{t("bundle.add")}</Text>
            </Button>
          )}
        </View>
      </SmoothHeight>
    </View>
  );
}

export { BundleBox };
