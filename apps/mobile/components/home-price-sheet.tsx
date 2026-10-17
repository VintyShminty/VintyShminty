import { type BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { type Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/money";

/** A price range in minor units. A missing end means no limit on that side. */
export type PriceRange = { min: number | null; max: number | null };

export const NO_PRICE: PriceRange = { min: null, max: null };

/** The "Under" pick includes ₪50 itself, the same as the website (whole shekels in its address). */
const UNDER_MAX = 5000;

/** The four quick picks. */
const PRICE_PICKS = [
  { key: "under", min: null, max: UNDER_MAX },
  { key: "mid", min: 5000, max: 10000 },
  { key: "high", min: 10000, max: 20000 },
  { key: "top", min: 20000, max: null },
] as const;

export const hasPrice = (r: PriceRange) => r.min !== null || r.max !== null;

/** Shekels shown in the boxes (whole numbers). */
const toText = (minor: number | null) => (minor === null ? "" : String(Math.ceil(minor / 100)));
const toMinor = (text: string) => {
  const n = Number.parseInt(text.replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n * 100 : null;
};

type Translate = (key: string, options?: Record<string, string>) => string;

/** The words on the Home chip, the same as the website: "Price", "Under ₪80", "₪50 to ₪100", "₪200 and up". */
export function priceLabel(r: PriceRange, t: Translate): string {
  const money = (minor: number) => formatMoney(minor, "ILS");
  if (r.min === null && r.max === null) return t("home.price.label");
  if (r.min === null && r.max !== null) return t("home.price.under", { to: money(r.max) });
  if (r.min !== null && r.max === null) return t("home.price.over", { from: money(r.min) });
  return t("home.price.range", { from: money(r.min as number), to: money(r.max as number) });
}

type Props = {
  ref: Ref<BottomSheetModal>;
  value: PriceRange;
  onApply: (range: PriceRange) => void;
};

/** The Home price sheet: From and To in shekels, quick picks, Clear and Show. A quick pick applies at once. */
export function HomePriceSheet({ ref, value, onApply }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [min, setMin] = useState(toText(value.min));
  const [max, setMax] = useState(toText(value.max));
  const minMinor = toMinor(min);
  const maxMinor = toMinor(max);
  const invalid = minMinor !== null && maxMinor !== null && minMinor > maxMinor;
  const close = () => (ref && typeof ref === "object" ? ref.current?.dismiss() : undefined);

  const apply = (range: PriceRange) => {
    onApply(range);
    close();
  };

  return (
    <Sheet
      ref={ref}
      title={t("home.price.label")}
      snapPoints={["58%"]}
      onChange={(index) => {
        // Opening starts from the range that is on now.
        if (index === 0) {
          setMin(toText(value.min));
          setMax(toText(value.max));
        }
      }}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="gap-lg px-lg pt-sm">
          <View className="flex-row gap-md">
            <Input
              inputComponent={BottomSheetTextInput}
              label={t("home.price.from")}
              prefix="₪"
              value={min}
              onChangeText={(v) => setMin(v.replace(/\D/g, ""))}
              keyboardType="number-pad"
              placeholder="0"
              maxLength={6}
              containerClassName="flex-1"
            />
            <Input
              inputComponent={BottomSheetTextInput}
              label={t("home.price.to")}
              prefix="₪"
              value={max}
              onChangeText={(v) => setMax(v.replace(/\D/g, ""))}
              keyboardType="number-pad"
              placeholder={t("home.price.noLimit")}
              maxLength={6}
              containerClassName="flex-1"
            />
          </View>
          {invalid ? (
            <Text variant="bodySmall" className="text-error" accessibilityLiveRegion="polite">
              {t("home.price.invalid")}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap gap-sm">
            {PRICE_PICKS.map((p) => (
              <Chip
                key={p.key}
                label={priceLabel({ min: p.min, max: p.max }, t)}
                selected={minMinor === p.min && maxMinor === (p.max === UNDER_MAX ? 5000 : p.max)}
                onPress={() => apply({ min: p.min, max: p.max })}
              />
            ))}
          </View>
          <View className="flex-row gap-md">
            <Button size="lg" variant="outline" className="flex-1" onPress={() => apply(NO_PRICE)}>
              <Text>{t("home.price.clear")}</Text>
            </Button>
            <Button
              size="lg"
              className="flex-1"
              disabled={invalid}
              onPress={() => apply({ min: minMinor, max: maxMinor })}
            >
              <Text>{t("home.price.show")}</Text>
            </Button>
          </View>
        </View>
      </BottomSheetScrollView>
    </Sheet>
  );
}
