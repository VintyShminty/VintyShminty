import { useRouter, useScrollToTop } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrowseMoreTile } from "@/components/browse-more-tile";
import { PhotoTile } from "@/components/photo-tile";
import { SearchBar } from "@/components/search-bar";
import { Chip } from "@/components/ui/chip";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTileCovers } from "@/lib/browse-covers";
import { type BrowseGender, restFor, type SideTile, tilesFor } from "@/lib/browse-tiles";
import { readPref, writePref } from "@/lib/secure-prefs";

const GENDER_PREF = "browse.gender";
const GENDERS: BrowseGender[] = ["women", "men"];

const savedGender = (): BrowseGender => (readPref(GENDER_PREF) === "men" ? "men" : "women");

/** Rows of two tiles with their covers. A single tile keeps its half width. */
function TileGrid({
  tiles,
  covers,
  onOpen,
}: {
  tiles: SideTile[];
  covers: (string | undefined)[];
  onOpen: (tile: SideTile) => void;
}) {
  const { t } = useTranslation();
  const rows: number[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(i + 1 < tiles.length ? [i, i + 1] : [i]);
  return (
    <>
      {rows.map((row) => (
        <View key={tiles[row[0] as number]?.key} className="flex-row gap-md">
          {row.map((i) => {
            const tile = tiles[i] as SideTile;
            return (
              <PhotoTile
                key={tile.key}
                label={t(`browse.tiles.${tile.key}`)}
                photo={tile.photo}
                imageUrl={covers[i]}
                onPress={() => onOpen(tile)}
                className="aspect-[4/5] flex-1"
              />
            );
          })}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </>
  );
}

/**
 * The Browse tab: the search bar, a Women and Men switch, ten photo tiles showing the newest listing's cover (stock photo
 * until it arrives) and a More tile that opens the rest in place (D-055, same ideas as the website's D-052 and D-054).
 */
export default function Browse() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Tapping the Browse tab again scrolls back to the top.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const [gender, setGender] = useState<BrowseGender>(savedGender);
  const [expanded, setExpanded] = useState(false);
  const tiles = useMemo(() => tilesFor(gender), [gender]);
  const rest = useMemo(() => restFor(gender), [gender]);
  // One list so covers never repeat between the ten and the rest.
  const all = useMemo(() => [...tiles, ...rest], [tiles, rest]);
  const covers = useTileCovers(all, true);

  const choose = useCallback((next: BrowseGender) => {
    setGender(next);
    setExpanded(false);
    writePref(GENDER_PREF, next);
  }, []);
  const open = (tile: SideTile) =>
    router.push({
      pathname: "/browse/tile",
      params: tile.group ? { tile: tile.key, group: tile.group } : { tile: tile.key },
    });

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
        <View className="flex-row gap-sm">
          {GENDERS.map((g) => (
            <Chip key={g} label={t(`browse.groups.${g}`)} selected={gender === g} onPress={() => choose(g)} />
          ))}
        </View>
        <TileGrid tiles={tiles} covers={covers} onOpen={open} />
        <BrowseMoreTile
          previews={rest.map((tile) => tile.photo)}
          count={rest.length}
          expanded={expanded}
          onPress={() => setExpanded((v) => !v)}
        />
        {expanded ? (
          <Animated.View
            entering={FadeIn.duration(220).easing(Easing.out(Easing.quad)).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
            className="gap-md"
          >
            <Text variant="sectionLabel" accessibilityRole="header" className="pt-sm">
              {t("browse.moreTitle")}
            </Text>
            <TileGrid tiles={rest} covers={covers.slice(tiles.length)} onOpen={open} />
            <Pressable
              onPress={() => router.push("/browse/more")}
              role="button"
              className="h-12 items-center justify-center rounded-control active:bg-pressed"
            >
              <Text variant="button" weight={700} className="text-primary">
                {t("browse.allCategories")}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
