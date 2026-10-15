import { useLocalSearchParams, useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { openSearch } from "@/components/search-bar";
import { SearchResults } from "@/components/search-results";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { findTile, type TileGroup, tileCategoryIds, tileGroups } from "@/lib/browse-tiles";
import { trackCategoryVisit } from "@/lib/events";
import { useReference } from "@/lib/reference";
import { useSearchStore } from "@/lib/search-store";

/**
 * Results for one Browse tile (an item type) across Women, Men and Kids, with those as chips above the filter row.
 * The tile's categories travel as `categoryIds`, so one search covers all of them (D-019, row 5).
 */
export default function BrowseTile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { tile: tileKey } = useLocalSearchParams<{ tile: string }>();
  const tile = findTile(tileKey);
  const categories = useReference().data?.categories;
  const [group, setGroup] = useState<TileGroup | "all">("all");
  const [ready, setReady] = useState(false);
  const title = tile ? t(`browse.tiles.${tile.key}`) : undefined;
  const groups = tile ? tileGroups(tile) : [];

  // Start a fresh browse search for this tile once the categories are known.
  useEffect(() => {
    if (!tile || !categories) return;
    const ids = tileCategoryIds(categories, tile);
    for (const id of ids.slice(0, 6)) trackCategoryVisit(id);
    useSearchStore.getState().reset("browse", { filters: { sort: "newest", categoryIds: ids } });
    setGroup("all");
    setReady(true);
  }, [tile, categories]);

  const choose = (next: TileGroup | "all") => {
    if (!tile || !categories) return;
    setGroup(next);
    useSearchStore.getState().setFilters("browse", {
      categoryIds: tileCategoryIds(categories, tile, next === "all" ? undefined : next),
    });
  };

  return (
    <Screen bottomInset={false}>
      <TopBar
        title={title}
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
      {groups.length > 1 ? (
        <View>
          <ScrollView
            horizontal
            className="grow-0"
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-sm px-lg pt-xs"
          >
            <Chip label={t("browse.all")} selected={group === "all"} onPress={() => choose("all")} />
            {groups.map((g) => (
              <Chip
                key={g}
                label={t(`browse.groups.${g}`)}
                selected={group === g}
                onPress={() => choose(g)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      {ready ? <SearchResults scope="browse" bottomPadding={8} /> : null}
    </Screen>
  );
}
