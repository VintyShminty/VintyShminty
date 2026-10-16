import type { Bundle } from "@vinty/shared";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/** The steps as a bar that fills as items are picked. Each step has a mark with its discount and item count. */
function StepsBar({ bundle, minItems }: { bundle: Bundle; minItems: number }) {
  const { t } = useTranslation();
  const top = Math.max(...bundle.tiers.map((x) => x.minItems), minItems);
  const fill = Math.min(100, (bundle.itemCount / top) * 100);
  return (
    <View
      className="mx-[28px] mt-sm h-[60px]"
      role="progressbar"
      accessibilityLabel={t("bundle.stepsLabel")}
      accessibilityValue={{ min: 0, max: top, now: Math.min(bundle.itemCount, top) }}
    >
      <View className="h-2 overflow-hidden rounded-full bg-pressed">
        <View className="h-2 rounded-full bg-primary" style={{ width: `${fill}%` }} />
      </View>
      {bundle.tiers.map((tier) => {
        const lit = bundle.itemCount >= tier.minItems;
        const share = (tier.minItems / top) * 100;
        return (
          // Marks sit on the bar by percent from the start edge. The start edge flips in Hebrew by itself.
          <View
            key={tier.minItems}
            className="absolute items-center"
            style={{ start: `${share}%`, top: -4, width: 72, marginStart: -36 }}
          >
            <View
              className={cn(
                "h-4 w-4 rounded-full border-2",
                lit ? "border-primary bg-primary" : "border-border bg-background",
              )}
            />
            <Text variant="cardMeta" weight={600} className="mt-xs text-text-1">
              {t("bundle.stepOff", { percent: tier.percentOff })}
            </Text>
            <Text variant="cardMeta" className="text-text-3">
              {t("bundle.stepItems", { count: tier.minItems })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export { StepsBar };
