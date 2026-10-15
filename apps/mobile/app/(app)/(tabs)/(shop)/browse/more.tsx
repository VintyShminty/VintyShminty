import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryRow } from "@/components/category-row";
import { PhotoTile } from "@/components/photo-tile";
import { openSearch } from "@/components/search-bar";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { type BrowseTile, MORE_TILES } from "@/lib/browse-tiles";
import { categoryIcon } from "@/lib/category-icons";
import { useLocalName, useReference } from "@/lib/reference";

/**
 * Behind the More tile: the rest of the photo tiles, then the whole category tree as rows,
 * so every deeper category (Heels, Hoodies, Wallets...) stays one tap away (D-009, D-010).
 */
export default function BrowseMore() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const name = useLocalName();
  const categories = useReference().data?.categories ?? [];

  const rows: BrowseTile[][] = [];
  for (let i = 0; i < MORE_TILES.length; i += 2) rows.push(MORE_TILES.slice(i, i + 2));

  return (
    <Screen bottomInset={false}>
      <TopBar
        title={t("browse.moreTitle")}
        trailing={
          <Pressable
            onPress={() => openSearch(router)}
            hitSlop={8}
            role="button"
            accessibilityLabel={t("browse.search")}
            className="h-11 w-11 items-center justify-center rounded-full bg-transparent active:bg-pressed"
          >
            <Icon as={Search} size={22} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-md px-lg pt-sm">
          {rows.map((row) => (
            <View key={row[0]?.key} className="flex-row gap-md">
              {row.map((tile) => (
                <PhotoTile
                  key={tile.key}
                  label={t(`browse.tiles.${tile.key}`)}
                  photo={tile.photo}
                  onPress={() => router.push({ pathname: "/browse/tile", params: { tile: tile.key } })}
                  className="aspect-[4/5] flex-1"
                />
              ))}
              {row.length === 1 ? <View className="flex-1" /> : null}
            </View>
          ))}
        </View>
        {categories.length > 0 ? (
          <View className="pt-xl">
            <Text variant="sectionLabel" className="px-lg pb-sm" accessibilityRole="header">
              {t("browse.allCategories")}
            </Text>
            {categories.map((category) => (
              <CategoryRow
                key={category.id}
                kind="branch"
                label={name(category.name)}
                icon={categoryIcon(category.icon)}
                onPress={() =>
                  router.push({ pathname: "/browse/category", params: { parent: category.id, depth: "1" } })
                }
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
