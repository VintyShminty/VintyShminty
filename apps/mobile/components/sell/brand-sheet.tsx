import { BottomSheetFlatList, type BottomSheetModal, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { type Brand, cleanBrandName } from "@vinty/shared";
import { Search } from "lucide-react-native";
import { type Ref, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { Radio } from "@/components/ui/radio";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { brandsQuery, useRequestBrand } from "@/lib/queries";
import { colors } from "@/theme";

/** Waits until typing pauses before searching. */
function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

type BrandSheetProps = {
  ref: Ref<BottomSheetModal>;
  /** `id` is null for a brand the seller typed that is not on our list. */
  selected: { id: string | null; name: string } | null;
  onChange: (brand: { id: string | null; name: string } | null) => void;
  /** The brand the photo helper read from a tag. Shown first, never picked for the seller. `id` is null when it is not in our list. */
  fromTag?: { id: string | null; name: string } | null;
};

/** Brand picker: a search, the most popular brands when empty, and a Use "text" row when nothing fits (old and vintage brands are fine). */
function BrandSheet({ ref, selected, onChange, fromTag }: BrandSheetProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const q = useDebounced(cleanBrandName(text));
  const brands = useQuery(brandsQuery(q));
  const request = useRequestBrand();
  const isHe = i18n.language === "he";

  const close = () => (typeof ref === "object" && ref ? ref.current?.dismiss() : undefined);
  const items = brands.data?.items ?? [];
  const exact = items.some((b) => b.name.toLowerCase() === q.toLowerCase());
  const canUseText = q.length >= 2 && q.length <= 60 && !exact && !brands.isFetching;

  /** Keeps the typed brand on the listing, and quietly tells the team so popular ones can join the list. */
  const chooseTyped = (name: string) => {
    onChange({ id: null, name });
    request.mutate(name);
    close();
  };

  return (
    <Sheet
      ref={ref}
      title={t("sell.brand")}
      onDismiss={() => {
        setText("");
      }}
      action={
        selected
          ? {
              label: t("sell.clear"),
              onPress: () => {
                onChange(null);
                close();
              },
            }
          : undefined
      }
    >
      <View className="px-lg pb-sm">
        <View className="h-11 flex-row items-center gap-sm rounded-bar border border-border bg-surface px-md">
          <Icon as={Search} size={18} className="text-text-3" />
          <BottomSheetTextInput
            value={text}
            onChangeText={setText}
            placeholder={t("sell.searchBrands")}
            placeholderTextColor={colors.text4}
            selectionColor={colors.accent}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel={t("sell.searchBrands")}
            className={`flex-1 text-body text-text-1 ${isHe ? "font-heebo-400" : "font-aileron-400"}`}
            style={{ textAlign: isHe ? "right" : "left", writingDirection: isHe ? "rtl" : "ltr" }}
          />
          {brands.isFetching ? <ActivityIndicator size="small" color={colors.accent} /> : null}
        </View>
      </View>
      <BottomSheetFlatList
        data={items}
        keyExtractor={(b: Brand) => b.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          q !== "" ? (
            canUseText ? (
              <Pressable
                onPress={() => chooseTyped(q)}
                role="button"
                accessibilityLabel={t("sell.useBrand", { name: q })}
                className="active:bg-surface"
              >
                <View className="min-h-14 flex-row items-center gap-md border-b border-border-subtle px-lg">
                  <Text weight={600} className="flex-1">
                    {t("sell.useBrand", { name: q })}
                  </Text>
                </View>
              </Pressable>
            ) : null
          ) : (
            <View>
              {fromTag ? (
                <Pressable
                  onPress={() => {
                    if (fromTag.id) {
                      onChange({ id: fromTag.id, name: fromTag.name });
                      close();
                    } else if (cleanBrandName(fromTag.name).length >= 2) {
                      // Not in our list: keep it as the seller's own text.
                      chooseTyped(cleanBrandName(fromTag.name).slice(0, 60));
                    }
                  }}
                  role={fromTag.id ? "radio" : "button"}
                  accessibilityState={fromTag.id ? { checked: selected?.id === fromTag.id } : undefined}
                  accessibilityLabel={t("sell.assist.fromTag", { name: fromTag.name })}
                  className="active:bg-surface"
                >
                  <View className="min-h-14 flex-row items-center gap-md border-b border-border-subtle px-lg">
                    <Text weight={600} className="flex-1">
                      {t("sell.assist.fromTag", { name: fromTag.name })}
                    </Text>
                    {fromTag.id ? <Radio checked={selected?.id === fromTag.id} /> : null}
                  </View>
                </Pressable>
              ) : null}
              <Text variant="sectionLabel" className="px-lg pb-sm pt-sm">
                {t("sell.popularBrands")}
              </Text>
            </View>
          )
        }
        renderItem={({ item }: { item: Brand }) => {
          const on = Boolean(selected?.id) && selected?.id === item.id;
          return (
            <Pressable
              onPress={() => {
                onChange({ id: item.id, name: item.name });
                close();
              }}
              role="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={item.name}
              className="active:bg-surface"
            >
              <View className="min-h-14 flex-row items-center gap-md border-b border-border-subtle px-lg">
                <Text className="flex-1">{item.name}</Text>
                <Radio checked={on} />
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          q.length >= 2 && !exact && !brands.isFetching && items.length === 0 ? (
            <Text variant="bodySmall" className="px-lg pt-lg text-text-3">
              {t("sell.noBrands")}
            </Text>
          ) : null
        }
      />
    </Sheet>
  );
}

export { BrandSheet };
