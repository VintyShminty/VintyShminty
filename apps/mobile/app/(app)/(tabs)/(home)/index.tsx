import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { ListingGrid } from "@/components/listing-grid";
import { SearchBar } from "@/components/search-bar";
import { Chip } from "@/components/ui/chip";
import { Screen } from "@/components/ui/screen";
import { type FeedParams, feedQuery } from "@/lib/discovery-queries";
import { useReference } from "@/lib/reference";

type ChipKey = "all" | "women" | "men" | "trending" | "designer" | "kids";
const CHIPS: ChipKey[] = ["all", "women", "men", "trending", "designer", "kids"];

/** Home: the search bar, the category chips and the feed (personalised when the settings allow). */
export default function Home() {
  const { t } = useTranslation();
  const reference = useReference();
  const [chip, setChip] = useState<ChipKey>("all");

  const idOf = (slug: string) => reference.data?.categories.find((c) => c.slug === slug)?.id;
  const params: FeedParams =
    chip === "all" ? {} : chip === "trending" ? { trending: true } : { categoryId: idOf(chip) };
  const query = useInfiniteQuery(feedQuery(params));

  const header = (
    <View className="gap-md pb-md">
      <View className="px-lg pt-sm">
        <SearchBar />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm px-lg">
        {CHIPS.filter((key) => key === "all" || key === "trending" || idOf(key)).map((key) => (
          <Chip
            key={key}
            label={t(`home.chips.${key}`)}
            selected={chip === key}
            onPress={() => setChip(key)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen bottomInset={false}>
      <ListingGrid
        query={query}
        header={header}
        bottomPadding={16}
        emptyTitle={t("home.emptyTitle")}
        emptyMessage={t("home.emptyMessage")}
      />
    </Screen>
  );
}
