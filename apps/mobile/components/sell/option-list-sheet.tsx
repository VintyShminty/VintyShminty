import { BottomSheetFlatList, type BottomSheetModal } from "@gorhom/bottom-sheet";
import { type ReactNode, type Ref, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Checkbox } from "@/components/ui/checkbox";
import { Radio } from "@/components/ui/radio";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export type Option = {
  id: string;
  label: string;
  description?: string;
  /** Colour dot before the label. A value from the reference data, not a design token. */
  swatch?: string;
  /** Group heading shown before this option. */
  section?: string;
};

type OptionListSheetProps = {
  ref: Ref<BottomSheetModal>;
  title: string;
  options: Option[];
  /** Single choice applies on tap and closes. Multiple choice uses checkboxes and a Done button. */
  mode: "single" | "multi";
  max?: number;
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Shows Clear in the header so an optional row can be emptied. */
  clearable?: boolean;
  /** Content above the list, such as a hint. */
  header?: ReactNode;
};

/** A sheet with a flat list of options (docs/components.md, OptionListSheet). */
function OptionListSheet({
  ref,
  title,
  options,
  mode,
  max,
  selected,
  onChange,
  clearable,
  header,
}: OptionListSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<string[]>(selected);
  useEffect(() => setDraft(selected), [selected]);

  const close = () => (typeof ref === "object" && ref ? ref.current?.dismiss() : undefined);
  const full = max !== undefined && draft.length >= max;

  const press = (id: string) => {
    if (mode === "single") {
      onChange([id]);
      close();
      return;
    }
    setDraft((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : full ? current : [...current, id],
    );
  };

  return (
    <Sheet
      ref={ref}
      title={title}
      onDismiss={() => setDraft(selected)}
      action={
        mode === "multi"
          ? {
              label: t("common.done"),
              onPress: () => {
                onChange(draft);
                close();
              },
            }
          : clearable && selected.length > 0
            ? {
                label: t("sell.clear"),
                onPress: () => {
                  onChange([]);
                  setDraft([]);
                  close();
                },
              }
            : undefined
      }
    >
      <BottomSheetFlatList
        data={options}
        keyExtractor={(o: Option) => o.id}
        ListHeaderComponent={header ? <View className="px-lg pb-sm">{header}</View> : null}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        renderItem={({ item }: { item: Option }) => {
          const on = draft.includes(item.id);
          const disabled = mode === "multi" && full && !on;
          return (
            <View>
              {item.section ? (
                <Text variant="sectionLabel" className="px-lg pb-sm pt-lg">
                  {item.section}
                </Text>
              ) : null}
              <Pressable
                onPress={() => press(item.id)}
                disabled={disabled}
                role={mode === "single" ? "radio" : "checkbox"}
                accessibilityState={{ checked: on, disabled }}
                accessibilityLabel={item.description ? `${item.label}, ${item.description}` : item.label}
                className={cn("active:bg-surface", disabled && "opacity-40")}
              >
                <View className="min-h-14 flex-row items-center gap-md border-b border-border-subtle px-lg py-md">
                  {item.swatch ? (
                    <View
                      className="h-5 w-5 rounded-full border border-border"
                      style={{ backgroundColor: item.swatch }}
                    />
                  ) : null}
                  <View className="flex-1 gap-xs">
                    <Text weight={item.description ? 600 : 400}>{item.label}</Text>
                    {item.description ? (
                      <Text variant="bodySmall" className="text-text-3">
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  {mode === "single" ? <Radio checked={on} /> : <Checkbox checked={on} />}
                </View>
              </Pressable>
            </View>
          );
        }}
      />
    </Sheet>
  );
}

export { OptionListSheet };
