import type { ParcelSize } from "@vinty/shared";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Radio } from "@/components/ui/radio";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/money";
import { useLocalName } from "@/lib/reference";
import { cn } from "@/lib/utils";

type ParcelSizesProps = {
  sizes: ParcelSize[];
  selected: string | null;
  recommended: string | null;
  onSelect: (id: string) => void;
  error?: string;
};

/** Parcel size as radio cards, the recommended one tagged (spec, Sell form: Shipping). */
function ParcelSizes({ sizes, selected, recommended, onSelect, error }: ParcelSizesProps) {
  const { t } = useTranslation();
  const name = useLocalName();
  return (
    <View className="gap-sm">
      {sizes.map((size) => {
        const on = selected === size.id;
        return (
          <Pressable
            key={size.id}
            onPress={() => onSelect(size.id)}
            role="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${name(size.name)}, ${name(size.description)}`}
            className={cn(
              "flex-row items-center gap-md rounded-control border bg-background p-md active:bg-surface",
              on ? "border-primary" : error ? "border-error" : "border-border",
            )}
          >
            <Radio checked={on} />
            <View className="flex-1 gap-xs">
              <View className="flex-row flex-wrap items-center gap-sm">
                <Text weight={600}>{name(size.name)}</Text>
                {recommended === size.id ? (
                  <Badge variant="accent" icon={Check} label={t("sell.recommended")} />
                ) : null}
              </View>
              <Text variant="bodySmall" className="text-text-3">
                {name(size.description)}
              </Text>
              <Text variant="cardMeta">
                {t("sell.postageFrom", { price: formatMoney(size.priceMinor, size.currency) })}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {error ? (
        <Text variant="cardDesc" className="text-error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export { ParcelSizes };
