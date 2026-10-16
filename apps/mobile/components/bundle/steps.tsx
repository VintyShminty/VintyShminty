import type { BundleTier } from "@vinty/shared";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/** The seller's steps as small tiles. A step is lit once the bundle has that many items. */
function BundleSteps({ tiers, count }: { tiers: readonly BundleTier[]; count: number }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-sm" accessibilityLabel={t("bundle.stepsLabel")}>
      {tiers.map((tier) => {
        const lit = count >= tier.minItems;
        return (
          <View
            key={tier.minItems}
            className={cn(
              "min-w-0 flex-1 items-center rounded-control border px-sm py-sm",
              lit ? "border-primary bg-primary" : "border-border-subtle bg-background",
            )}
          >
            <Text variant="cardMeta" className={lit ? "text-primary-foreground" : "text-text-2"}>
              {t("bundle.stepItems", { count: tier.minItems })}
            </Text>
            <Text
              variant="bodySmall"
              weight={700}
              className={lit ? "text-primary-foreground" : "text-text-1"}
            >
              {t("bundle.stepOff", { percent: tier.percentOff })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export { BundleSteps };
