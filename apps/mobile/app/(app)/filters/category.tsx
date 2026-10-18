import { type CategoryNode, categoryTrail, findCategory } from "@vinty/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LayoutGrid, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryRow } from "@/components/category-row";
import { FilterFooter } from "@/components/filter-footer";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { TopBar } from "@/components/ui/top-bar";
import { categoryIcon } from "@/lib/category-icons";
import { useLocalName, useReference } from "@/lib/reference";
import { type Scope, useSearchStore } from "@/lib/search-store";

/**
 * The category row of the Filter page (D-010): full-screen panels that push in from the trailing edge. Every level
 * after the first starts with an "All <category>" row. Choosing a category closes the panels.
 */
export default function FilterCategory() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const name = useLocalName();
  const reference = useReference();
  const {
    parent,
    depth: depthParam,
    scope: scopeParam,
  } = useLocalSearchParams<{
    parent?: string;
    depth?: string;
    scope?: string;
  }>();
  const scope: Scope = scopeParam === "browse" ? "browse" : "search";
  const depth = Number(depthParam ?? "1");
  const selectedId = useSearchStore((s) => s.scopes[scope].filters.categoryId);
  const { setCategory } = useSearchStore.getState();

  const all = reference.data?.categories ?? [];
  const node = parent ? findCategory(all, parent) : null;
  const rows = node ? node.children : all;

  const choose = (row: CategoryNode) => {
    setCategory(scope, { id: row.id, name: name(row.name) });
    router.dismiss(depth);
  };
  const iconFor = (row: CategoryNode) => {
    if (row.icon) return categoryIcon(row.icon, row.slug);
    return categoryIcon(categoryTrail(all, row.id).findLast((p) => p.icon)?.icon, row.slug);
  };

  const closeButton = (
    <Pressable
      onPress={() => router.dismiss(depth)}
      hitSlop={8}
      role="button"
      accessibilityLabel={t("common.close")}
      className="h-11 w-11 items-center justify-center rounded-full bg-transparent active:bg-pressed"
    >
      <Icon as={X} size={24} />
    </Pressable>
  );

  return (
    <Screen bottomInset={false}>
      {node ? (
        <TopBar title={name(node.name)} trailing={closeButton} />
      ) : (
        <TopBar title={t("filters.category")} />
      )}
      {!reference.data ? (
        <Spinner size="large" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            node ? (
              <CategoryRow
                kind="leaf"
                label={t("filters.allIn", { name: name(node.name) })}
                icon={LayoutGrid}
                selected={selectedId === node.id}
                onPress={() => choose(node)}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <CategoryRow
              kind={item.isLeaf ? "leaf" : "branch"}
              label={name(item.name)}
              icon={iconFor(item)}
              selected={item.id === selectedId}
              onPress={() =>
                item.isLeaf
                  ? choose(item)
                  : router.push({
                      pathname: "/filters/category",
                      params: { parent: item.id, depth: String(depth + 1), scope },
                    })
              }
            />
          )}
        />
      )}
      <FilterFooter scope={scope} closes={depth + 1} />
    </Screen>
  );
}
