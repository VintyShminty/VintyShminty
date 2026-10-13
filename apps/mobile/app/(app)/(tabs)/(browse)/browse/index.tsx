import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { SearchBar } from "@/components/search-bar";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { categoryIcon } from "@/lib/category-icons";
import { useLocalName, useReference } from "@/lib/reference";

/** The Browse tab: the search bar, then the main categories as a two column grid of tiles (D-009). */
export default function Browse() {
  const { t } = useTranslation();
  const router = useRouter();
  const name = useLocalName();
  const reference = useReference();
  const categories = reference.data?.categories ?? [];

  const rows: (typeof categories)[] = [];
  for (let i = 0; i < categories.length; i += 2) rows.push(categories.slice(i, i + 2));

  return (
    <Screen bottomInset={false}>
      <ScrollView
        contentContainerClassName="gap-md px-lg pb-xl pt-sm"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="heading" accessibilityRole="header" className="pb-xs">
          {t("tabs.browse")}
        </Text>
        <SearchBar />
        {reference.isPending
          ? [0, 1, 2, 3].map((n) => (
              <View key={n} className="flex-row gap-md">
                <View className="h-24 flex-1 rounded-control bg-pressed" />
                <View className="h-24 flex-1 rounded-control bg-pressed" />
              </View>
            ))
          : null}
        {reference.isError && categories.length === 0 ? (
          <Text variant="subtitle" className="py-xl text-center text-text-3">
            {t("errors.general")}
          </Text>
        ) : null}
        {rows.map((row) => (
          <View key={row[0]?.id} className="flex-row gap-md">
            {row.map((category) => (
              <Pressable
                key={category.id}
                onPress={() =>
                  router.push({ pathname: "/browse/category", params: { parent: category.id, depth: "1" } })
                }
                role="button"
                accessibilityLabel={name(category.name)}
                className="h-24 flex-1 overflow-hidden rounded-control bg-accent-tint p-md active:scale-[0.98]"
              >
                <Text weight={700} numberOfLines={2} className="text-primary">
                  {name(category.name)}
                </Text>
                <View className="absolute bottom-md end-md">
                  <Icon as={categoryIcon(category.icon)} size={32} className="text-primary opacity-70" />
                </View>
              </Pressable>
            ))}
            {row.length === 1 ? <View className="flex-1" /> : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
