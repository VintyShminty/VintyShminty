import { useQuery } from "@tanstack/react-query";
import type { CategoryNode, SavedSearch } from "@vinty/shared";
import { useRouter } from "expo-router";
import { Bell, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Pressable, RefreshControl, View } from "react-native";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { ForwardIcon, TopBar } from "@/components/ui/top-bar";
import { savedSearchesQuery, useDeleteSavedSearch, useUpdateSavedSearch } from "@/lib/item-queries";
import { formatMoney } from "@/lib/money";
import { useLocalName, useReference } from "@/lib/reference";
import { colors } from "@/theme";

function findCategory(nodes: CategoryNode[] | undefined, id: string): CategoryNode | undefined {
  for (const node of nodes ?? []) {
    if (node.id === id) return node;
    const inside = findCategory(node.children, id);
    if (inside) return inside;
  }
  return undefined;
}

/** The saved filters as the query string of the search screen: lists are comma separated (`brandIds=a,b`). */
function searchParams(search: SavedSearch): Record<string, string> {
  const { filters } = search;
  const params: Record<string, string> = {};
  const q = search.queryText ?? filters.q;
  if (q) params.q = q;
  if (filters.categoryId) params.categoryId = filters.categoryId;
  for (const key of [
    "brandIds",
    "sizeIds",
    "conditionIds",
    "colourIds",
    "materialIds",
    "patternIds",
  ] as const) {
    const list = filters[key];
    if (list && list.length > 0) params[key] = list.join(",");
  }
  if (filters.priceMinMinor !== undefined) params.priceMinMinor = String(filters.priceMinMinor);
  if (filters.priceMaxMinor !== undefined) params.priceMaxMinor = String(filters.priceMaxMinor);
  if (filters.sort && filters.sort !== "relevance") params.sort = filters.sort;
  return params;
}

/** One saved search: the words, a short line of what is filtered, the alert switch and delete. Tap runs it again. */
function SavedSearchRow({ search }: { search: SavedSearch }) {
  const { t } = useTranslation();
  const router = useRouter();
  const reference = useReference();
  const name = useLocalName();
  const update = useUpdateSavedSearch();
  const remove = useDeleteSavedSearch();
  const { filters } = search;

  // Money is shown in the currency of the app (shekels).
  const parts: string[] = [];
  const category = filters.categoryId
    ? findCategory(reference.data?.categories, filters.categoryId)
    : undefined;
  if (category) parts.push(name(category.name));
  const counts = [
    ["brands", filters.brandIds],
    ["sizes", filters.sizeIds],
    ["conditions", filters.conditionIds],
    ["colours", filters.colourIds],
    ["materials", filters.materialIds],
    ["patterns", filters.patternIds],
  ] as const;
  for (const [key, list] of counts) {
    if (list && list.length > 0) parts.push(t(`savedSearches.${key}`, { count: list.length }));
  }
  const { priceMinMinor: min, priceMaxMinor: max } = filters;
  if (min !== undefined && max !== undefined) {
    parts.push(t("savedSearches.priceRange", { min: formatMoney(min, "ILS"), max: formatMoney(max, "ILS") }));
  } else if (min !== undefined) {
    parts.push(t("savedSearches.priceFrom", { min: formatMoney(min, "ILS") }));
  } else if (max !== undefined) {
    parts.push(t("savedSearches.priceTo", { max: formatMoney(max, "ILS") }));
  }
  const words = search.queryText ?? filters.q;
  const title = words || (parts.length > 0 ? t("savedSearches.filtersOnly") : t("savedSearches.allItems"));

  const confirmDelete = () =>
    Alert.alert(t("savedSearches.deleteTitle"), t("savedSearches.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("savedSearches.delete"), style: "destructive", onPress: () => remove.mutate(search.id) },
    ]);

  return (
    <View className="border-b border-border-subtle px-lg py-md">
      <Pressable
        onPress={() => router.push({ pathname: "/search", params: searchParams(search) })}
        role="button"
        accessibilityLabel={[title, parts.join(", ")].filter(Boolean).join(", ")}
        className="flex-row items-center gap-md active:opacity-70"
      >
        <View className="flex-1 gap-xs">
          <Text weight={600} numberOfLines={1} className="self-start">
            {title}
          </Text>
          {parts.length > 0 ? (
            <Text variant="bodySmall" className="self-start text-text-3" numberOfLines={2}>
              {parts.join(" · ")}
            </Text>
          ) : null}
        </View>
        <ForwardIcon />
      </Pressable>
      <View className="mt-md flex-row items-center gap-md">
        <Icon as={Bell} size={16} className="text-text-3" />
        <Text variant="bodySmall" className="flex-1 text-text-2">
          {t("savedSearches.notify")}
        </Text>
        <Switch
          checked={search.notifyOnNew}
          onCheckedChange={(notifyOnNew) => update.mutate({ id: search.id, notifyOnNew })}
          accessibilityLabel={t("savedSearches.notify")}
        />
        <Pressable
          onPress={confirmDelete}
          hitSlop={8}
          role="button"
          accessibilityLabel={t("savedSearches.delete")}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-pressed"
        >
          <Icon as={Trash2} size={18} className="text-destructive" />
        </Pressable>
      </View>
    </View>
  );
}

/** Your saved searches (spec, Saved searches). Tapping one runs the search again with its filters. */
export default function SavedSearches() {
  const { t } = useTranslation();
  const query = useQuery(savedSearchesQuery());
  const items = query.data?.items ?? [];

  return (
    <Screen>
      <TopBar title={t("savedSearches.title")} />
      {query.isPending ? (
        <Spinner size="large" />
      ) : query.isError && !query.data ? (
        <View className="gap-lg px-lg">
          <Banner variant="error">{t("errors.loadFailed")}</Banner>
          <Button variant="outline" onPress={() => query.refetch()}>
            <Text>{t("common.tryAgain")}</Text>
          </Button>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <SavedSearchRow search={item} />}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View className="items-center gap-sm px-xl py-2xl">
              <Text variant="heading" className="text-center">
                {t("savedSearches.empty")}
              </Text>
              <Text variant="subtitle" className="text-center text-text-3">
                {t("savedSearches.emptyNote")}
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}
