import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { FilterFooter } from "@/components/filter-footer";
import { Radio } from "@/components/ui/radio";
import { Row, SectionHeader } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { useFilterSummary } from "@/lib/filter-labels";
import { type Scope, useSearchStore } from "@/lib/search-store";

const SORTS = ["relevance", "newest", "price_asc", "price_desc"] as const;
const SORT_KEYS = {
  relevance: "filters.sortRelevance",
  newest: "filters.sortNewest",
  price_asc: "filters.sortPriceLow",
  price_desc: "filters.sortPriceHigh",
} as const;

/** The Filter page (D-014): a full-screen panel with the sort, one row per filter showing its value, and Show results. */
export default function FilterPanel() {
  const { t } = useTranslation();
  const router = useRouter();
  const { scope: scopeParam } = useLocalSearchParams<{ scope?: string }>();
  const scope: Scope = scopeParam === "browse" ? "browse" : "search";
  const { state, count, values } = useFilterSummary(scope);
  const { setFilters, reset } = useSearchStore.getState();

  const open = (kind: string) => router.push({ pathname: "/filters/[kind]", params: { kind, scope } });
  const clearAll = () => reset(scope, { q: state.q });

  return (
    <Screen bottomInset={false}>
      <TopBar
        leading="close"
        title={t("filters.title")}
        trailing={
          count > 0 ? (
            <Text
              variant="bodySmall"
              weight={600}
              className="text-primary"
              role="button"
              onPress={clearAll}
              accessibilityLabel={t("filters.clearAll")}
            >
              {t("filters.clearAll")}
            </Text>
          ) : null
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-xl">
        <SectionHeader className="pt-sm">{t("filters.sortBy")}</SectionHeader>
        <View>
          {SORTS.map((sort, i) => (
            <Row
              key={sort}
              label={t(SORT_KEYS[sort])}
              last={i === SORTS.length - 1}
              onPress={() => setFilters(scope, { sort })}
              chevron={false}
              trailing={<Radio checked={state.filters.sort === sort} />}
            />
          ))}
        </View>
        <SectionHeader>{t("filters.filterBy")}</SectionHeader>
        <Row
          label={t("filters.category")}
          value={values.category}
          onPress={() => router.push({ pathname: "/filters/category", params: { scope, depth: "1" } })}
        />
        <Row label={t("filters.size")} value={values.size} onPress={() => open("size")} />
        <Row label={t("filters.brand")} value={values.brand} onPress={() => open("brand")} />
        <Row label={t("filters.condition")} value={values.condition} onPress={() => open("condition")} />
        <Row label={t("filters.colour")} value={values.colour} onPress={() => open("colour")} />
        <Row label={t("filters.material")} value={values.material} onPress={() => open("material")} />
        <Row label={t("filters.pattern")} value={values.pattern} onPress={() => open("pattern")} />
        <Row label={t("filters.price")} value={values.price} onPress={() => open("price")} last />
      </ScrollView>
      <FilterFooter scope={scope} />
    </Screen>
  );
}
