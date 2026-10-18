import { type CategoryNode, categoryTrail, findCategory } from "@vinty/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LayoutGrid, Search } from "lucide-react-native";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryRow } from "@/components/category-row";
import { openSearch } from "@/components/search-bar";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { TopBar } from "@/components/ui/top-bar";
import { categoryIcon } from "@/lib/category-icons";
import { trackCategoryVisit } from "@/lib/events";
import { useLocalName, useReference } from "@/lib/reference";

/**
 * A Browse category panel (D-009, D-010): back arrow, centred title, search icon, an "All" row, then the next level.
 * A row with children pushes another panel, a leaf or "All" opens the results for that level.
 */
export default function BrowseCategory() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const name = useLocalName();
  const reference = useReference();
  const { parent, depth: depthParam } = useLocalSearchParams<{ parent: string; depth?: string }>();
  const depth = Number(depthParam ?? "1");
  const all = reference.data?.categories ?? [];
  const node = findCategory(all, parent);

  // Opening a panel is a visit to that category, and so is opening its results.
  useEffect(() => {
    if (parent) trackCategoryVisit(parent);
  }, [parent]);

  const showResults = (row: CategoryNode) => {
    if (row.id !== parent) trackCategoryVisit(row.id);
    router.push({ pathname: "/browse/results", params: { categoryId: row.id, title: name(row.name) } });
  };
  const iconFor = (row: CategoryNode) => {
    if (row.icon) return categoryIcon(row.icon, row.slug);
    return categoryIcon(categoryTrail(all, row.id).findLast((p) => p.icon)?.icon, row.slug);
  };

  return (
    <Screen bottomInset={false}>
      <TopBar
        title={node ? name(node.name) : undefined}
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
      {!node ? (
        <Spinner size="large" />
      ) : (
        <FlatList
          data={node.children}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <CategoryRow
              kind="branch"
              label={t("browse.all")}
              icon={LayoutGrid}
              onPress={() => showResults(node)}
            />
          }
          renderItem={({ item }) => (
            <CategoryRow
              kind="branch"
              label={name(item.name)}
              icon={iconFor(item)}
              onPress={() =>
                item.isLeaf || item.children.length === 0
                  ? showResults(item)
                  : router.push({
                      pathname: "/browse/category",
                      params: { parent: item.id, depth: String(depth + 1) },
                    })
              }
            />
          )}
        />
      )}
    </Screen>
  );
}
