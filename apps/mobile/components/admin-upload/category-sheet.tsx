import { BottomSheetFlatList, type BottomSheetModal, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { type LeafOption, searchLeaves } from "@vinty/shared";
import { Search } from "lucide-react-native";
import { type Ref, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { Radio } from "@/components/ui/radio";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { inputDirectionStyle } from "@/lib/rtl";
import { colors } from "@/theme";

type CategorySheetProps = {
  ref: Ref<BottomSheetModal>;
  /** Every category an item can be listed in, with its path in the app language. */
  options: LeafOption[];
  selectedId: string | null;
  /** The AI's guesses, best first. Listed on top under "Suggested" while nothing is typed. */
  suggestedIds?: string[];
  onChange: (id: string) => void;
};

/** One line of the list: a category, or a group heading such as Women or Men. */
type Row = { key: string; heading: string } | { key: string; option: LeafOption };

/**
 * A searchable list of the categories you can list in. The search finds words in English and Hebrew. With nothing
 * typed it shows the AI's guesses first, then every category under its group (Women, Men...).
 */
function CategorySheet({ ref, options, selectedId, suggestedIds = [], onChange }: CategorySheetProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHe = i18n.language === "he";
  const [text, setText] = useState("");
  const rows = useMemo<Row[]>(() => {
    if (text.trim()) return searchLeaves(options, text, 60).map((o) => ({ key: o.id, option: o }));
    const out: Row[] = [];
    const guesses = suggestedIds
      .map((id) => options.find((o) => o.id === id))
      .filter((o): o is LeafOption => Boolean(o));
    if (guesses.length > 0) {
      out.push({ key: "h:suggested", heading: t("adminUpload.category.suggested") });
      for (const o of guesses) out.push({ key: `s:${o.id}`, option: o });
    }
    let group = "";
    for (const o of options) {
      const top = o.path.split(" > ")[0] ?? "";
      if (top !== group) {
        group = top;
        out.push({ key: `h:${top}`, heading: top });
      }
      out.push({ key: o.id, option: o });
    }
    return out;
  }, [options, text, suggestedIds, t]);
  const close = () => (typeof ref === "object" && ref ? ref.current?.dismiss() : undefined);

  return (
    <Sheet ref={ref} title={t("sell.category")} onDismiss={() => setText("")}>
      <View className="px-lg pb-sm">
        <View className="h-11 flex-row items-center gap-sm rounded-bar border border-border bg-surface px-md">
          <Icon as={Search} size={18} className="text-text-3" />
          <BottomSheetTextInput
            value={text}
            onChangeText={setText}
            placeholder={t("adminUpload.category.search")}
            placeholderTextColor={colors.text4}
            selectionColor={colors.accent}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel={t("adminUpload.category.search")}
            className={`flex-1 text-body text-text-1 ${isHe ? "font-heebo-400" : "font-aileron-400"}`}
            style={inputDirectionStyle(text, isHe)}
          />
        </View>
      </View>
      <BottomSheetFlatList
        data={rows}
        keyExtractor={(row: Row) => row.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={
          <Text className="px-lg py-xl text-center text-text-3">{t("adminUpload.category.none")}</Text>
        }
        renderItem={({ item: row }: { item: Row }) => {
          if ("heading" in row) {
            return (
              <Text variant="sectionLabel" accessibilityRole="header" className="px-lg pb-sm pt-lg">
                {row.heading}
              </Text>
            );
          }
          const item = row.option;
          return (
            <Pressable
              onPress={() => {
                onChange(item.id);
                close();
              }}
              role="radio"
              accessibilityState={{ checked: item.id === selectedId }}
              accessibilityLabel={item.path}
              className="active:bg-surface"
            >
              <View className="min-h-14 flex-row items-center gap-md border-b border-border-subtle px-lg py-md">
                <Text className="flex-1">{item.path}</Text>
                <Radio checked={item.id === selectedId} />
              </View>
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

export { CategorySheet };
