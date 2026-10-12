import { useInfiniteQuery } from "@tanstack/react-query";
import { SEARCH_TOTAL_CAP } from "@vinty/shared";
import { useRouter } from "expo-router";
import { SlidersHorizontal, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { ListingGrid } from "@/components/listing-grid";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { searchQuery } from "@/lib/discovery-queries";
import { useFilterSummary } from "@/lib/filter-labels";
import { activeFilters, type Scope } from "@/lib/search-store";

/** The scrolling row above results: the Filter button first, then the applied filters you can remove (D-008). */
function FilterBar({ scope }: { scope: Scope }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { chips, count } = useFilterSummary(scope);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="items-center gap-sm px-lg py-sm"
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => router.push({ pathname: "/filters", params: { scope } })}
        role="button"
        accessibilityLabel={count > 0 ? t("filters.titleWithCount", { count }) : t("filters.title")}
        className="h-8 min-w-10 shrink-0 flex-row items-center justify-center gap-xs rounded-full border border-text-4 bg-background px-[12px] active:bg-pressed"
      >
        <Icon as={SlidersHorizontal} size={16} className="text-text-1" />
        {count > 0 ? (
          <Text variant="pill" weight={700} className="text-primary">
            {count}
          </Text>
        ) : null}
      </Pressable>
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          onPress={chip.remove}
          role="button"
          accessibilityLabel={t("filters.removeFilter", { name: chip.label })}
          className="h-8 shrink-0 flex-row items-center gap-xs rounded-full border-[1.5px] border-primary bg-background px-[12px] active:bg-pressed"
        >
          <Text variant="pill" className="text-text-1">
            {chip.label}
          </Text>
          <Icon as={X} size={13} className="text-text-1" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Search or category results for one scope: the filter row, the count, and the item grid with paging. */
export function SearchResults({ scope, bottomPadding }: { scope: Scope; bottomPadding?: number }) {
  const { t } = useTranslation();
  const { state } = useFilterSummary(scope);
  const query = useInfiniteQuery(searchQuery(activeFilters(state)));
  const first = query.data?.pages[0];
  return (
    <View className="flex-1">
      <FilterBar scope={scope} />
      <ListingGrid
        query={query}
        bottomPadding={bottomPadding}
        header={
          first ? (
            <Text variant="bodySmall" className="px-lg pb-md text-text-3" accessibilityLiveRegion="polite">
              {first.totalCapped
                ? t("search.resultsCapped", { count: SEARCH_TOTAL_CAP })
                : t("search.results", { count: first.total })}
            </Text>
          ) : null
        }
        emptyTitle={t("search.noResults")}
        emptyMessage={t("search.noResultsHint")}
      />
    </View>
  );
}
