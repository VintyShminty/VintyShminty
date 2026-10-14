import { type BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Check } from "lucide-react-native";
import { type ReactNode, type Ref, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export type ColourOption = {
  id: string;
  label: string;
  /** English name, used to find the colours that make up the rainbow. */
  en: string;
  /** A value from the reference data, not a design token. */
  swatch: string;
};

type ColourGridSheetProps = {
  ref: Ref<BottomSheetModal>;
  title: string;
  options: ColourOption[];
  max: number;
  selected: string[];
  onChange: (ids: string[]) => void;
  header?: ReactNode;
  /** The photo helper's guesses (ids from `options`). Listed first under "Looks like", never ticked for the seller. */
  suggestedIds?: string[];
};

const SWATCH = 44;
const RING = 54;
const RAINBOW_NAMES = ["Red", "Yellow", "Green", "Blue"];

/** Pie segments drawn from the reference colours, so Multicolour reads as many colours. */
function Rainbow({ colours, fallback }: { colours: string[]; fallback: string }) {
  const r = SWATCH / 2;
  if (colours.length < 2) return <Circle cx={r} cy={r} r={r} fill={fallback} />;
  const step = (Math.PI * 2) / colours.length;
  return (
    <>
      {colours.map((fill, i) => {
        const a0 = i * step - Math.PI / 2;
        const a1 = (i + 1) * step - Math.PI / 2;
        const d = `M ${r} ${r} L ${r + r * Math.cos(a0)} ${r + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${r + r * Math.cos(a1)} ${r + r * Math.sin(a1)} Z`;
        return <Path key={d} d={d} fill={fill} />;
      })}
    </>
  );
}

function Dot({ colour, rainbow }: { colour: ColourOption; rainbow: string[] | null }) {
  return (
    <View
      className="overflow-hidden rounded-full border border-border"
      style={{ width: SWATCH, height: SWATCH }}
    >
      {rainbow ? (
        <Svg width={SWATCH} height={SWATCH}>
          <Rainbow colours={rainbow} fallback={colour.swatch} />
        </Svg>
      ) : (
        <View
          style={{
            width: SWATCH,
            height: SWATCH,
            backgroundColor: colour.swatch,
          }}
        />
      )}
    </View>
  );
}

/** The sell form's Colours sheet: a grid of round swatches, pick up to `max` (D-031). */
function ColourGridSheet({
  ref,
  title,
  options,
  max,
  selected,
  onChange,
  header,
  suggestedIds,
}: ColourGridSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<string[]>(selected);
  useEffect(() => setDraft(selected), [selected]);

  const close = () => (typeof ref === "object" && ref ? ref.current?.dismiss() : undefined);
  const full = draft.length >= max;
  const press = (id: string) =>
    setDraft((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : full ? current : [...current, id],
    );

  const rainbowColours = RAINBOW_NAMES.map((n) => options.find((o) => o.en === n)?.swatch).filter(
    (s): s is string => Boolean(s),
  );
  const guesses = (suggestedIds ?? [])
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is ColourOption => Boolean(o));

  const grid = (list: ColourOption[]) => (
    <View className="flex-row flex-wrap px-lg">
      {list.map((c) => {
        const on = draft.includes(c.id);
        const disabled = full && !on;
        return (
          <View key={c.id} className="w-1/4 items-center pb-sm">
            <Pressable
              onPress={() => press(c.id)}
              disabled={disabled}
              role="checkbox"
              accessibilityState={{ checked: on, disabled }}
              accessibilityLabel={c.label}
              className={cn("items-center gap-xs", disabled && "opacity-40")}
            >
              <View
                className={cn(
                  "items-center justify-center rounded-full border-2",
                  on ? "border-primary" : "border-transparent",
                )}
                style={{ width: RING, height: RING }}
              >
                <Dot colour={c} rainbow={c.en === "Multicolour" ? rainbowColours : null} />
                {on ? (
                  <View className="absolute bottom-0 end-0 h-5 w-5 items-center justify-center rounded-full border-2 border-window bg-primary">
                    <Icon as={Check} size={11} strokeWidth={3} className="text-primary-foreground" />
                  </View>
                ) : null}
              </View>
              <Text variant="cardMeta" weight={on ? 600 : 400} numberOfLines={1} className="text-center">
                {c.label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  return (
    <Sheet
      ref={ref}
      title={title}
      onDismiss={() => setDraft(selected)}
      action={{
        label: t("common.done"),
        onPress: () => {
          onChange(draft);
          close();
        },
      }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        {header ? <View className="px-lg pb-sm">{header}</View> : null}
        {guesses.length > 0 ? (
          <>
            <Text variant="sectionLabel" className="px-lg pb-sm pt-lg">
              {t("sell.assist.looksLike")}
            </Text>
            {grid(guesses)}
          </>
        ) : null}
        <Text variant="sectionLabel" className="px-lg pb-sm pt-lg">
          {t("sell.assist.allOptions")}
        </Text>
        {grid(options)}
      </BottomSheetScrollView>
    </Sheet>
  );
}

export { ColourGridSheet };
