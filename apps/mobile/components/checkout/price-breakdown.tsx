import { ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/money";

function Line({
  label,
  value,
  strong,
  icon,
}: {
  label: string;
  value: string;
  strong?: boolean;
  icon?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-md py-xs">
      <View className="flex-1 flex-row items-center gap-xs">
        {icon ? <Icon as={ShieldCheck} size={15} className="text-primary" /> : null}
        <Text
          variant={strong ? "body" : "bodySmall"}
          weight={strong ? 700 : 400}
          className={strong ? "" : "text-text-2"}
        >
          {label}
        </Text>
      </View>
      <Text variant={strong ? "heading" : "bodySmall"} weight={strong ? 700 : 500}>
        {value}
      </Text>
    </View>
  );
}

/** The numbers shown: a checkout quote or an existing order. The discount percent is worked out when it is not given. */
type Totals = {
  currency: string;
  items: unknown[];
  itemsSubtotalMinor: number;
  bundleDiscountMinor: number;
  bundleDiscountPercent?: number;
  buyerProtectionFeeMinor: number;
  shippingMinor: number;
  totalMinor: number;
};

/** The numbers of an order: items, bundle discount, Buyer Protection, postage and the total. All from the server. */
function PriceBreakdown({ quote }: { quote: Totals }) {
  const { t } = useTranslation();
  const money = (v: number) => formatMoney(v, quote.currency);
  return (
    <View className="rounded-control border border-border-subtle p-md">
      <Line
        label={t("checkout.items", { count: quote.items.length })}
        value={money(quote.itemsSubtotalMinor)}
      />
      {quote.bundleDiscountMinor > 0 ? (
        <Line
          label={t("checkout.bundleDiscount", {
            percent:
              quote.bundleDiscountPercent ??
              Math.round((quote.bundleDiscountMinor / Math.max(quote.itemsSubtotalMinor, 1)) * 100),
          })}
          value={`-${money(quote.bundleDiscountMinor)}`}
        />
      ) : null}
      <Line icon label={t("checkout.protection")} value={money(quote.buyerProtectionFeeMinor)} />
      <Line label={t("checkout.postage")} value={money(quote.shippingMinor)} />
      <View className="my-xs h-px bg-border-subtle" />
      <Line strong label={t("checkout.total")} value={money(quote.totalMinor)} />
    </View>
  );
}

export { PriceBreakdown };
