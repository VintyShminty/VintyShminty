import { useTranslation } from "react-i18next";
import { formatMoney } from "@/lib/money";
import { useLocalName, useReference } from "@/lib/reference";
import { activeFilterCount, type Scope, type SearchState, useSearchStore } from "@/lib/search-store";

export type AppliedChip = { key: string; label: string; remove: () => void };

/** The words for the current value of each filter row, and the removable chips above the results. */
export function useFilterSummary(scope: Scope) {
  const { t } = useTranslation();
  const name = useLocalName();
  const reference = useReference().data;
  const state: SearchState = useSearchStore((s) => s.scopes[scope]);
  const { setFilters, setBrands, setCategory } = useSearchStore.getState();
  const f = state.filters;

  const sizeLabels = new Map(reference?.sizeGroups.flatMap((g) => g.sizes.map((s) => [s.id, s.label])) ?? []);
  const lookup = (list: { id: string; name: { en: string; he: string } }[] | undefined, id: string) =>
    name(list?.find((x) => x.id === id)?.name);

  const brands = (f.brandIds ?? []).map((id) => ({ id, label: state.brandNames[id] ?? t("filters.brand") }));
  const sizes = (f.sizeIds ?? []).map((id) => ({ id, label: sizeLabels.get(id) ?? t("filters.size") }));
  const conditions = (f.conditionIds ?? []).map((id) => ({
    id,
    label: lookup(reference?.conditions, id),
  }));
  const colours = (f.colourIds ?? []).map((id) => ({ id, label: lookup(reference?.colours, id) }));
  const materials = (f.materialIds ?? []).map((id) => ({ id, label: lookup(reference?.materials, id) }));
  const patterns = (f.patternIds ?? []).map((id) => ({ id, label: lookup(reference?.patterns, id) }));

  const price = priceLabel(f.priceMinMinor, f.priceMaxMinor, t);
  const without = (ids: string[] | undefined, id: string) => {
    const left = (ids ?? []).filter((x) => x !== id);
    return left.length > 0 ? left : undefined;
  };

  const chips: AppliedChip[] = [];
  if (f.categoryId) {
    chips.push({
      key: "category",
      label: state.categoryName ?? t("filters.category"),
      remove: () => setCategory(scope, null),
    });
  }
  for (const b of brands) {
    chips.push({
      key: `brand-${b.id}`,
      label: b.label,
      remove: () =>
        setBrands(
          scope,
          brands.filter((x) => x.id !== b.id).map((x) => ({ id: x.id, name: x.label })),
        ),
    });
  }
  const lists = [
    ["sizeIds", "size", sizes],
    ["conditionIds", "condition", conditions],
    ["colourIds", "colour", colours],
    ["materialIds", "material", materials],
    ["patternIds", "pattern", patterns],
  ] as const;
  for (const [field, key, items] of lists) {
    for (const item of items) {
      chips.push({
        key: `${key}-${item.id}`,
        label: item.label,
        remove: () => setFilters(scope, { [field]: without(f[field], item.id) }),
      });
    }
  }
  if (price) {
    chips.push({
      key: "price",
      label: price,
      remove: () => setFilters(scope, { priceMinMinor: undefined, priceMaxMinor: undefined }),
    });
  }

  const join = (items: { label: string }[]) => items.map((i) => i.label).join(", ");
  return {
    state,
    count: activeFilterCount(state),
    chips,
    values: {
      category: state.categoryName ?? "",
      size: join(sizes),
      brand: join(brands),
      condition: join(conditions),
      colour: join(colours),
      material: join(materials),
      pattern: join(patterns),
      price: price ?? "",
    },
  };
}

export function priceLabel(
  min: number | undefined,
  max: number | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (min === undefined && max === undefined) return null;
  const from = min === undefined ? "" : formatMoney(min, "ILS");
  const to = max === undefined ? "" : formatMoney(max, "ILS");
  if (min !== undefined && max !== undefined) return t("filters.priceRange", { from, to });
  return min !== undefined ? t("filters.priceFrom", { from }) : t("filters.priceUpTo", { to });
}
