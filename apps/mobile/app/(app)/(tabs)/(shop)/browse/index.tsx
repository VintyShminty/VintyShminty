import { useRouter, useScrollToTop } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PhotoTile } from "@/components/photo-tile";
import { SearchBar } from "@/components/search-bar";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { type BrowseTile, TILES, tilePhotoUrl } from "@/lib/browse-tiles";
import { useIsRtl } from "@/lib/rtl";

/** One row of two tiles. A single tile keeps its half width. */
function TileRow({ tiles, onOpen }: { tiles: BrowseTile[]; onOpen: (tile: BrowseTile) => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-md">
      {tiles.map((tile) => (
        <PhotoTile
          key={tile.key}
          label={t(`browse.tiles.${tile.key}`)}
          photoUrl={tilePhotoUrl(tile)}
          onPress={() => onOpen(tile)}
          className="aspect-[4/5] flex-1"
        />
      ))}
      {tiles.length === 1 ? <View className="flex-1" /> : null}
    </View>
  );
}

/** The Browse tab: the search bar, then photo tiles by item type and a More tile (D-019, row 5). */
export default function Browse() {
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = useIsRtl();
  const insets = useSafeAreaInsets();
  // Tapping the Browse tab again scrolls back to the top.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const rows: BrowseTile[][] = [];
  for (let i = 0; i < TILES.length; i += 2) rows.push(TILES.slice(i, i + 2));

  return (
    <Screen bottomInset={false}>
      <ScrollView
        ref={scrollRef}
        contentContainerClassName="gap-md px-lg pt-sm"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="heading" accessibilityRole="header" className="pb-xs">
          {t("tabs.browse")}
        </Text>
        <SearchBar />
        {rows.map((row) => (
          <TileRow
            key={row[0]?.key}
            tiles={row}
            onOpen={(tile) => router.push({ pathname: "/browse/tile", params: { tile: tile.key } })}
          />
        ))}
        <Pressable
          onPress={() => router.push("/browse/more")}
          role="button"
          accessibilityLabel={t("browse.more")}
          className="h-16 flex-row items-center justify-between rounded-control bg-accent-tint px-lg active:opacity-90"
        >
          <Text variant="heading" weight={700} className="text-primary">
            {t("browse.more")}
          </Text>
          <Icon as={ArrowRight} size={20} className={rtl ? "rotate-180 text-primary" : "text-primary"} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
