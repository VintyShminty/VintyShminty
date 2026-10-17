import type { BundleTier } from "@vinty/shared";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/**
 * The seller's steps as small tiles. A step is lit once the bundle has that many items. The lit look is a dark layer
 * on top that fades in and out (opacity only, so it stays smooth), instead of the colours snapping.
 */
function BundleSteps({ tiers, count }: { tiers: readonly BundleTier[]; count: number }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-sm" accessibilityLabel={t("bundle.stepsLabel")}>
      {tiers.map((tier) => {
        const lit = count >= tier.minItems;
        const label = (on: boolean) => (
          <>
            <Text variant="cardMeta" className={on ? "text-primary-foreground" : "text-text-2"}>
              {t("bundle.stepItems", { count: tier.minItems })}
            </Text>
            <Text variant="bodySmall" weight={700} className={on ? "text-primary-foreground" : "text-text-1"}>
              {t("bundle.stepOff", { percent: tier.percentOff })}
            </Text>
          </>
        );
        return (
          <View
            key={tier.minItems}
            className={cn(
              "min-w-0 flex-1 items-center overflow-hidden rounded-control border bg-background px-sm py-sm",
              lit ? "border-primary" : "border-border-subtle",
            )}
          >
            {label(false)}
            <Animated.View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              className="absolute inset-0 items-center justify-center bg-primary px-sm"
              style={{ opacity: lit ? 1 : 0, transitionProperty: "opacity", transitionDuration: 200 }}
            >
              {label(true)}
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

export { BundleSteps };
