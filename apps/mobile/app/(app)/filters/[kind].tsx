import { useQuery } from "@tanstack/react-query";
import type { Brand } from "@vinty/shared";
import { useLocalSearchParams } from "expo-router";
import { Search } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, SectionList, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FilterFooter } from "@/components/filter-footer";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { minorToPriceText, priceTextToMinor } from "@/lib/money";
import { brandsQuery } from "@/lib/queries";
import { useLocalName, useReference } from "@/lib/reference";
import { type Scope, type SearchState, useSearchStore } from "@/lib/search-store";
import { useDebounced } from "@/lib/use-debounced";
import { colors } from "@/theme";

type ListKind = "size" | "condition" | "colour" | "material" | "pattern";
type Option = { id: string; label: string; detail?: string; swatch?: string };

const FIELD = {
  size: "sizeIds",
  condition: "conditionIds",
  colour: "colourIds",
  material: "materialIds",
  pattern: "patternIds",
} as const;

/** A sub-page of the Filter panel: size, brand, condition, colour, material, pattern or price. Choices apply at once. */
export default function FilterKind() {
  const { t } = useTranslation();
  const { kind, scope: scopeParam } = useLocalSearchParams<{ kind: string; scope?: string }>();
  const scope: Scope = scopeParam === "browse" ? "browse" : "search";
  const title = t(`filters.${kind === "price" ? "price" : kind}`);

  return (
    <Screen bottomInset={false}>
      <TopBar title={title} />
      {kind === "price" ? (
        <PriceBody scope={scope} />
      ) : kind === "brand" ? (
        <BrandBody scope={scope} />
      ) : kind === "size" ? (
        <SizeBody scope={scope} />
      ) : (
        <OptionsBody scope={scope} kind={kind as Exclude<ListKind, "size">} />
      )}
      <FilterFooter scope={scope} closes={2} />
    </Screen>
  );
}

function OptionRow({ option, on, onPress }: { option: Option; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      role="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={option.detail ? `${option.label}, ${option.detail}` : option.label}
      className="active:bg-surface"
    >
      <View className="min-h-14 flex-row items-center gap-md border-b border-border-subtle px-lg py-md">
        {option.swatch ? (
          <View
            className="h-5 w-5 rounded-full border border-border"
            style={{ backgroundColor: option.swatch }}
          />
        ) : null}
        <View className="flex-1 gap-xs">
          <Text>{option.label}</Text>
          {option.detail ? (
            <Text variant="bodySmall" className="text-text-3">
              {option.detail}
            </Text>
          ) : null}
        </View>
        <Checkbox checked={on} />
      </View>
    </Pressable>
  );
}

function selected(state: SearchState, kind: ListKind): string[] {
  return state.filters[FIELD[kind]] ?? [];
}

function useToggle(scope: Scope, kind: ListKind) {
  const state = useSearchStore((s) => s.scopes[scope]);
  const on = selected(state, kind);
  const toggle = (id: string) => {
    const next = on.includes(id) ? on.filter((x) => x !== id) : [...on, id];
    useSearchStore.getState().setFilters(scope, { [FIELD[kind]]: next.length > 0 ? next : undefined });
  };
  return { on, toggle };
}

function OptionsBody({ scope, kind }: { scope: Scope; kind: Exclude<ListKind, "size"> }) {
  const reference = useReference().data;
  const name = useLocalName();
  const insets = useSafeAreaInsets();
  const { on, toggle } = useToggle(scope, kind);
  if (!reference) return <Spinner size="large" />;
  const options: Option[] =
    kind === "condition"
      ? reference.conditions.map((o) => ({ id: o.id, label: name(o.name), detail: name(o.description) }))
      : kind === "colour"
        ? reference.colours.map((o) => ({ id: o.id, label: name(o.name), swatch: o.swatchHex }))
        : (kind === "material" ? reference.materials : reference.patterns).map((o) => ({
            id: o.id,
            label: name(o.name),
          }));
  return (
    <FlatList
      data={options}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      renderItem={({ item }) => (
        <OptionRow option={item} on={on.includes(item.id)} onPress={() => toggle(item.id)} />
      )}
    />
  );
}

/** Sizes in their size groups. With a category chosen, only the groups that category uses. */
function SizeBody({ scope }: { scope: Scope }) {
  const reference = useReference().data;
  const name = useLocalName();
  const insets = useSafeAreaInsets();
  const categoryId = useSearchStore((s) => s.scopes[scope].filters.categoryId);
  const { on, toggle } = useToggle(scope, "size");
  if (!reference) return <Spinner size="large" />;
  const wanted = categoryId ? findGroups(reference.categories, categoryId) : null;
  const groups = reference.sizeGroups.filter((g) => !wanted || wanted.includes(g.id));
  return (
    <SectionList
      sections={groups.map((g) => ({
        title: name(g.name),
        data: g.sizes.map((s) => ({ id: s.id, label: s.label || name(s.name) })),
      }))}
      keyExtractor={(o) => o.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      renderSectionHeader={({ section }) => (
        <Text variant="sectionLabel" className="bg-background px-lg pb-sm pt-lg">
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <OptionRow option={item} on={on.includes(item.id)} onPress={() => toggle(item.id)} />
      )}
    />
  );
}

/** The size groups of a category, or of the nearest parent that has some. */
function findGroups(
  nodes: { id: string; sizeGroupIds: string[]; children: unknown[] }[],
  id: string,
): string[] | null {
  type N = { id: string; sizeGroupIds: string[]; children: N[] };
  const walk = (list: N[]): string[] | null => {
    for (const n of list) {
      if (n.id === id) return n.sizeGroupIds.length > 0 ? n.sizeGroupIds : null;
      const inner = walk(n.children);
      if (inner) return inner;
    }
    return null;
  };
  return walk(nodes as N[]);
}

function BrandBody({ scope }: { scope: Scope }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHe = i18n.language === "he";
  const [text, setText] = useState("");
  const q = useDebounced(text.trim());
  const brands = useQuery(brandsQuery(q));
  const state = useSearchStore((s) => s.scopes[scope]);
  const chosen = (state.filters.brandIds ?? []).map((id) => ({
    id,
    name: state.brandNames[id] ?? t("filters.brand"),
  }));
  const toggle = (brand: { id: string; name: string }) => {
    const exists = chosen.some((b) => b.id === brand.id);
    useSearchStore
      .getState()
      .setBrands(scope, exists ? chosen.filter((b) => b.id !== brand.id) : [...chosen, brand]);
  };
  const items = brands.data?.items ?? [];
  const rows: Brand[] | { id: string; name: string }[] =
    q === "" ? [...chosen, ...items.filter((b) => !chosen.some((c) => c.id === b.id))] : items;
  return (
    <View className="flex-1">
      <View className="px-lg pb-sm">
        <View className="h-11 flex-row items-center gap-sm rounded-bar border border-border bg-surface px-md">
          <Icon as={Search} size={18} className="text-text-3" />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("filters.searchBrands")}
            placeholderTextColor={colors.text4}
            selectionColor={colors.accent}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel={t("filters.searchBrands")}
            className="flex-1 font-aileron-400 text-body text-text-1 rtl:font-heebo-400"
            style={{ textAlign: isHe ? "right" : "left", writingDirection: isHe ? "rtl" : "ltr" }}
          />
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(b) => b.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          q === "" ? (
            <Text variant="sectionLabel" className="px-lg pb-sm pt-sm">
              {t("filters.popularBrands")}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          brands.isPending ? (
            <Spinner />
          ) : (
            <Text variant="subtitle" className="px-lg py-xl text-center text-text-3">
              {t("filters.noBrands")}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <OptionRow
            option={{ id: item.id, label: item.name }}
            on={chosen.some((b) => b.id === item.id)}
            onPress={() => toggle({ id: item.id, name: item.name })}
          />
        )}
      />
    </View>
  );
}

function PriceBody({ scope }: { scope: Scope }) {
  const { t } = useTranslation();
  const filters = useSearchStore.getState().scopes[scope].filters;
  const [min, setMin] = useState(minorToPriceText(filters.priceMinMinor ?? null));
  const [max, setMax] = useState(minorToPriceText(filters.priceMaxMinor ?? null));
  const { setFilters } = useSearchStore.getState();
  const minMinor = priceTextToMinor(min);
  const maxMinor = priceTextToMinor(max);
  const invalid = minMinor !== null && maxMinor !== null && minMinor > maxMinor;

  const apply = (nextMin: string, nextMax: string) => {
    const a = priceTextToMinor(nextMin);
    const b = priceTextToMinor(nextMax);
    if (a !== null && b !== null && a > b) return;
    setFilters(scope, { priceMinMinor: a ?? undefined, priceMaxMinor: b ?? undefined });
  };

  return (
    <ScreenScroll contentContainerClassName="gap-lg pt-sm">
      <View className="flex-row gap-md">
        <Input
          label={t("filters.priceMin")}
          prefix="₪"
          value={min}
          onChangeText={(v) => {
            setMin(v);
            apply(v, max);
          }}
          keyboardType="decimal-pad"
          placeholder="0"
          containerClassName="flex-1"
        />
        <Input
          label={t("filters.priceMax")}
          prefix="₪"
          value={max}
          onChangeText={(v) => {
            setMax(v);
            apply(min, v);
          }}
          keyboardType="decimal-pad"
          placeholder={t("filters.priceNoLimit")}
          containerClassName="flex-1"
        />
      </View>
      {invalid ? (
        <Text variant="bodySmall" className="text-error" accessibilityLiveRegion="polite">
          {t("filters.priceInvalid")}
        </Text>
      ) : null}
    </ScreenScroll>
  );
}
