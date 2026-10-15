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
import { colors } from "@/theme";

type CategorySheetProps = {
  ref: Ref<BottomSheetModal>;
  /** Every category an item can be listed in, with its path in the app language. */
  options: LeafOption[];
  selectedId: string | null;
  onChange: (id: string) => void;
};

/** A searchable list of the categories you can list in. The search finds words in English and Hebrew. */
function CategorySheet({ ref, options, selectedId, onChange }: CategorySheetProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHe = i18n.language === "he";
  const [text, setText] = useState("");
  const found = useMemo(() => searchLeaves(options, text, 60), [options, text]);
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
            style={{ textAlign: isHe ? "right" : "left", writingDirection: isHe ? "rtl" : "ltr" }}
          />
        </View>
      </View>
      <BottomSheetFlatList
        data={found}
        keyExtractor={(o: LeafOption) => o.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={
          <Text className="px-lg py-xl text-center text-text-3">{t("adminUpload.category.none")}</Text>
        }
        renderItem={({ item }: { item: LeafOption }) => (
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
        )}
      />
    </Sheet>
  );
}

export { CategorySheet };
