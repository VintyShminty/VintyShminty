import { BadgeCheck, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The buyer price as a soft pill (D-019, row 2): a badge check and "₪189 with {protectionName}" on the accent tint.
 * It replaces the shield icon and the "incl." line. Used on cards, the chat strip, favourites, the sell form
 * price preview and the offer sheet.
 */
function PricePill({
  amountMinor,
  currency,
  muted = false,
  className,
}: {
  amountMinor: number;
  currency: string;
  /** Sold items: the pill goes quiet. */
  muted?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <View
      className={cn(
        "flex-row items-center gap-xs rounded-full px-sm py-[3px]",
        muted ? "bg-surface" : "bg-accent-tint",
        className,
      )}
    >
      <Icon as={BadgeCheck} size={11} className={muted ? "text-text-4" : "text-primary"} />
      <Text
        variant="cardMeta"
        weight={600}
        className={cn("shrink", muted ? "text-text-4" : "text-primary")}
        numberOfLines={1}
      >
        {t("listing.buyerPays", { price: formatMoney(amountMinor, currency) })}
      </Text>
    </View>
  );
}

/**
 * The Covered buyer price as a tiny muted line under the title on item cards (D-032): a BadgeCheck and
 * "{price} with {protectionName}". No pill, no background.
 */
function CoveredLine({
  amountMinor,
  currency,
  className,
}: {
  amountMinor: number;
  currency: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <View className={cn("flex-row items-center gap-xs", className)}>
      <Icon as={BadgeCheck} size={13} className="-translate-y-[1.5px] text-text-3" />
      <Text variant="cardMeta" className="shrink" numberOfLines={1}>
        {t("listing.buyerPays", { price: formatMoney(amountMinor, currency) })}
      </Text>
    </View>
  );
}

function BreakdownLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-md py-xs">
      <Text
        variant={strong ? "body" : "bodySmall"}
        weight={strong ? 700 : 400}
        className={strong ? "" : "text-text-2"}
      >
        {label}
      </Text>
      <Text variant={strong ? "heading" : "bodySmall"} weight={strong ? 700 : 500}>
        {value}
      </Text>
    </View>
  );
}

/** The item page breakdown (D-019, row 2): the item, the protection, what you pay, and how you are covered. */
function PriceBreakdownCard({
  priceMinor,
  buyerPriceMinor,
  currency,
}: {
  priceMinor: number;
  buyerPriceMinor: number;
  currency: string;
}) {
  const { t } = useTranslation();
  return (
    <View className="rounded-control bg-accent-tint p-md">
      <BreakdownLine label={t("item.breakdown.item")} value={formatMoney(priceMinor, currency)} />
      <BreakdownLine
        label={t("protectionName")}
        value={formatMoney(Math.max(0, buyerPriceMinor - priceMinor), currency)}
      />
      <View className="my-xs h-px bg-border-subtle" />
      <BreakdownLine
        strong
        label={t("item.breakdown.total")}
        value={formatMoney(buyerPriceMinor, currency)}
      />
      <View className="flex-row items-start gap-xs pt-xs">
        <Icon as={Check} size={14} className="mt-px text-primary" />
        <Text variant="cardDesc" className="flex-1">
          {t("item.breakdown.note")}
        </Text>
      </View>
    </View>
  );
}

export { CoveredLine, PriceBreakdownCard, PricePill };
