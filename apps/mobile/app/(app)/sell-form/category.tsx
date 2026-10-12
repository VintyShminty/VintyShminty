import { type CategoryNode, categoryTrail, findCategory, stripHiddenAttributes } from "@vinty/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryRow } from "@/components/category-row";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { categoryIcon } from "@/lib/category-icons";
import { useLocalName, useReference } from "@/lib/reference";
import { useSellStore } from "@/lib/sell-store";
import { colors } from "@/theme";

type SearchHit = { node: CategoryNode; path: string; icon: string | null };

/**
 * The category picker of the sell form (D-010): full-screen panels that push in from the trailing edge.
 * The first level has a close cross, the title "Category" and Find a category. Deeper levels have a back arrow and
 * a close cross. Leaves carry a radio. Choosing a leaf closes every panel and grows the form.
 */
export default function CategoryPanel() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const name = useLocalName();
  const { parent, depth: depthParam } = useLocalSearchParams<{ parent?: string; depth?: string }>();
  const depth = Number(depthParam ?? "1");
  const reference = useReference();
  const selectedId = useSellStore((s) => s.values.categoryId);
  const [query, setQuery] = useState("");
  const isHe = i18n.language === "he";

  const tree = reference.data?.categories ?? [];
  const node = parent ? findCategory(tree, parent) : null;
  const rows = node ? node.children : tree;

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const found: SearchHit[] = [];
    const walk = (nodes: CategoryNode[], trail: CategoryNode[]) => {
      for (const n of nodes) {
        const here = [...trail, n];
        if (n.isLeaf && name(n.name).toLowerCase().includes(q)) {
          found.push({
            node: n,
            path: trail.map((p) => name(p.name)).join(", "),
            icon: here.findLast((p) => p.icon)?.icon ?? null,
          });
        }
        walk(n.children, here);
      }
    };
    walk(tree, []);
    return found.slice(0, 50);
  }, [query, tree, name]);

  const closeAll = () => router.dismiss(depth);

  const choose = (leaf: CategoryNode) => {
    const ref = reference.data;
    if (!ref) return;
    const { values, set, clearError } = useSellStore.getState();
    const cleaned = stripHiddenAttributes(
      {
        brandId: values.brand?.id ?? null,
        sizeId: values.sizeId,
        conditionId: values.conditionId,
        colourIds: values.colourIds,
        materialId: values.materialId,
        patternId: values.patternId,
      },
      leaf,
    );
    // A size from another category's size chart no longer fits.
    const sizeFits =
      cleaned.sizeId &&
      ref.sizeGroups.some(
        (g) => leaf.sizeGroupIds.includes(g.id) && g.sizes.some((s) => s.id === cleaned.sizeId),
      );
    set({
      categoryId: leaf.id,
      brand: cleaned.brandId ? values.brand : null,
      sizeId: sizeFits ? cleaned.sizeId : null,
      conditionId: cleaned.conditionId ?? null,
      colourIds: [...(cleaned.colourIds ?? [])],
      materialId: cleaned.materialId ?? null,
      patternId: cleaned.patternId ?? null,
      // The category recommends a parcel size until the seller picks one.
      ...(values.parcelChosen
        ? {}
        : { parcelSizeId: leaf.defaultParcelSizeId ?? ref.parcelSizes[0]?.id ?? null }),
    });
    clearError("categoryId");
    closeAll();
  };

  const open = (row: CategoryNode) => {
    if (row.isLeaf) {
      choose(row);
      return;
    }
    router.push({ pathname: "/sell-form/category", params: { parent: row.id, depth: String(depth + 1) } });
  };

  // The icon of a row: its own, or the nearest one above it.
  const iconFor = (row: CategoryNode) => {
    if (row.icon) return categoryIcon(row.icon);
    const trail = categoryTrail(tree, row.id);
    return categoryIcon(trail.findLast((p) => p.icon)?.icon);
  };

  const closeButton = (
    <Pressable
      onPress={closeAll}
      hitSlop={8}
      role="button"
      accessibilityLabel={t("common.close")}
      className="h-11 w-11 items-center justify-center rounded-full active:bg-pressed"
    >
      <Icon as={X} size={24} />
    </Pressable>
  );

  return (
    <Screen bottomInset={false}>
      {node ? (
        <TopBar title={name(node.name)} trailing={closeButton} />
      ) : (
        <TopBar leading="close" title={t("sell.category")} />
      )}
      {!node ? (
        <View className="px-lg pb-sm">
          <View className="h-11 flex-row items-center gap-sm rounded-bar border border-border bg-surface px-md">
            <Icon as={Search} size={18} className="text-text-3" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("sell.findCategory")}
              placeholderTextColor={colors.text4}
              selectionColor={colors.accent}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={t("sell.findCategory")}
              className="flex-1 font-aileron-400 text-body text-text-1 rtl:font-heebo-400"
              style={{ textAlign: isHe ? "right" : "left", writingDirection: isHe ? "rtl" : "ltr" }}
            />
          </View>
        </View>
      ) : null}
      {!reference.data ? (
        <Spinner size="large" />
      ) : query.trim().length >= 2 && !node ? (
        <FlatList
          data={hits}
          keyExtractor={(h) => h.node.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <Text variant="subtitle" className="px-lg py-xl text-center">
              {t("sell.noCategories")}
            </Text>
          }
          renderItem={({ item }) => (
            <CategoryRow
              kind="leaf"
              label={name(item.node.name)}
              detail={item.path}
              icon={categoryIcon(item.icon)}
              selected={item.node.id === selectedId}
              onPress={() => choose(item.node)}
            />
          )}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <CategoryRow
              kind={item.isLeaf ? "leaf" : "branch"}
              label={name(item.name)}
              icon={iconFor(item)}
              selected={item.id === selectedId}
              onPress={() => open(item)}
            />
          )}
        />
      )}
    </Screen>
  );
}
