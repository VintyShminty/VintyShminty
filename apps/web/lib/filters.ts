import {
  LISTING_SORTS,
  type ListingSort,
  type ReferenceData,
  TILE_GROUPS,
  type TileGroup,
} from "@vinty/shared";
import type { Lang } from "@/lib/i18n";

/**
 * The filters of the Browse and Search pages. They live in the address (shareable, the back button works, the
 * server builds the first page from it). Lists repeat their key (`?size=a&size=b`), a brand carries its name
 * (`?brand=<id>~Zara`) so the chip can show it without another lookup, and prices are whole shekels (`?min=50&max=100`).
 */
export type BrandChoice = { id: string; name: string };
export type Filters = {
  sort: ListingSort;
  sizeIds: string[];
  brands: BrandChoice[];
  conditionIds: string[];
  colourIds: string[];
  /** Whole shekels. */
  min?: number;
  max?: number;
};

type Source = URLSearchParams | Record<string, string | string[] | undefined>;

/** Keys this module owns in the address. Everything else (q, group, type, view) is left alone. */
const MANAGED = ["sort", "size", "brand", "condition", "colour", "min", "max"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SHEKELS = 1_000_000;

export function paramValues(src: Source, key: string): string[] {
  if (src instanceof URLSearchParams) return src.getAll(key);
  const value = src[key];
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export function paramValue(src: Source, key: string): string | undefined {
  return paramValues(src, key)[0];
}

const ids = (src: Source, key: string, max: number) =>
  [...new Set(paramValues(src, key).filter((v) => UUID.test(v)))].slice(0, max);

const shekels = (value: string | undefined) => {
  if (!value || !/^\d{1,7}$/.test(value)) return undefined;
  const n = Number(value);
  return n <= MAX_SHEKELS ? n : undefined;
};

export function parseFilters(src: Source, defaultSort: ListingSort): Filters {
  const sort = paramValue(src, "sort");
  const brands: BrandChoice[] = [];
  for (const raw of paramValues(src, "brand")) {
    const [id, ...name] = raw.split("~");
    if (id && UUID.test(id) && !brands.some((b) => b.id === id)) {
      brands.push({ id, name: name.join("~") || id });
    }
  }
  return {
    sort: LISTING_SORTS.find((s) => s === sort) ?? defaultSort,
    sizeIds: ids(src, "size", 30),
    brands: brands.slice(0, 20),
    conditionIds: ids(src, "condition", 5),
    colourIds: ids(src, "colour", 10),
    min: shekels(paramValue(src, "min")),
    max: shekels(paramValue(src, "max")),
  };
}

/** Puts the filters into an address query, replacing the ones that were there. Defaults are left out. */
export function writeFilters(params: URLSearchParams, f: Filters, defaultSort: ListingSort): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of MANAGED) next.delete(key);
  if (f.sort !== defaultSort) next.set("sort", f.sort);
  for (const id of f.sizeIds) next.append("size", id);
  for (const b of f.brands) next.append("brand", `${b.id}~${b.name}`);
  for (const id of f.conditionIds) next.append("condition", id);
  for (const id of f.colourIds) next.append("colour", id);
  if (f.min !== undefined) next.set("min", String(f.min));
  if (f.max !== undefined) next.set("max", String(f.max));
  return next;
}

export function hasFilters(f: Filters): boolean {
  return (
    f.sizeIds.length + f.brands.length + f.conditionIds.length + f.colourIds.length > 0 ||
    f.min !== undefined ||
    f.max !== undefined
  );
}

/** The same filters with everything but the sort taken off. */
export function clearedFilters(f: Filters): Filters {
  return { sort: f.sort, sizeIds: [], brands: [], conditionIds: [], colourIds: [] };
}

/** The query for GET /v1/listings and /v1/listings/count (no paging). */
export function listingQuery(f: Filters, extra: { categoryIds?: string[]; q?: string } = {}): string {
  const p = new URLSearchParams();
  p.set("sort", f.sort);
  const q = extra.q?.trim();
  if (q) p.set("q", q);
  if (extra.categoryIds?.length) p.set("categoryIds", extra.categoryIds.join(","));
  if (f.brands.length) p.set("brandIds", f.brands.map((b) => b.id).join(","));
  if (f.sizeIds.length) p.set("sizeIds", f.sizeIds.join(","));
  if (f.conditionIds.length) p.set("conditionIds", f.conditionIds.join(","));
  if (f.colourIds.length) p.set("colourIds", f.colourIds.join(","));
  if (f.min !== undefined) p.set("priceMinMinor", String(f.min * 100));
  if (f.max !== undefined) p.set("priceMaxMinor", String(f.max * 100));
  return p.toString();
}

export const isGroup = (value: string | undefined): value is TileGroup =>
  (TILE_GROUPS as readonly string[]).includes(value ?? "");

/** What the pills need from the reference data, in the page language. Plain data, safe to send to the browser. */
export type FilterOptions = {
  sizeGroups: { id: string; name: string; sizes: { id: string; label: string }[] }[];
  /** Every size id to its label, for the applied chips. */
  sizeLabels: Record<string, string>;
  conditions: { id: string; name: string }[];
  colours: { id: string; name: string; swatch: string }[];
};

/** `sizeGroupIds` limits the size groups to those a category uses. Without it (search) every group is offered. */
export function buildFilterOptions(
  reference: ReferenceData,
  lang: Lang,
  sizeGroupIds?: string[] | null,
): FilterOptions {
  const label = (s: { label: string; name: { en: string; he: string } }) => s.label || s.name[lang];
  const wanted = sizeGroupIds?.length ? new Set(sizeGroupIds) : null;
  return {
    sizeGroups: reference.sizeGroups
      .filter((g) => !wanted || wanted.has(g.id))
      .map((g) => ({
        id: g.id,
        name: g.name[lang],
        sizes: g.sizes.map((s) => ({ id: s.id, label: label(s) })),
      })),
    sizeLabels: Object.fromEntries(reference.sizeGroups.flatMap((g) => g.sizes.map((s) => [s.id, label(s)]))),
    conditions: [...reference.conditions]
      .sort((a, b) => a.rank - b.rank)
      .map((c) => ({ id: c.id, name: c.name[lang] })),
    colours: reference.colours.map((c) => ({ id: c.id, name: c.name[lang], swatch: c.swatchHex })),
  };
}
