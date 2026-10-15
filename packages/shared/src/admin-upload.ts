import type { AdminListingItemInput } from "./admin.js";
import { allowedSizeIds, attributeMode, findCategory, stripHiddenAttributes } from "./listing-rules.js";
import type { CategoryNode, ReferenceData } from "./reference-data.js";

/**
 * Pure helpers for the admin batch upload, used by the website and the phone app: grouping photos into items,
 * and reading the reference data (leaf categories, the sizes a category accepts, its parcel size).
 */

/**
 * Splits an ordered list into groups of at most `size`, keeping the order. One drop of photos becomes one item,
 * and photos past the listing photo maximum start further items.
 */
export function splitIntoGroups<T>(items: readonly T[], size: number): T[][] {
  const step = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step));
  return out;
}

export type LeafOption = { id: string; path: string; node: CategoryNode; search: string };

/** Lower case, with anything that is not a letter or digit turned into a space, so "T-shirts" is the words "t shirts". */
const searchWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Every category you can list in, with its path in the page language and a text to search in (both languages). */
export function leafOptions(reference: ReferenceData, lang: "en" | "he"): LeafOption[] {
  const out: LeafOption[] = [];
  const walk = (nodes: CategoryNode[], trail: CategoryNode[]) => {
    for (const node of nodes) {
      const next = [...trail, node];
      if (node.isLeaf) {
        out.push({
          id: node.id,
          node,
          path: next.map((n) => n.name[lang]).join(" > "),
          search: searchWords(next.flatMap((n) => [n.name.en, n.name.he]).join(" ")),
        });
      } else {
        walk(node.children, next);
      }
    }
  };
  walk(reference.categories, []);
  return out;
}

/**
 * Leaf categories that match every word typed, in either language. Each typed word must start a word of the
 * category, so "jea" finds Jeans and "men" finds Men but not Women.
 */
export function searchLeaves(options: LeafOption[], query: string, limit = 60): LeafOption[] {
  const words = searchWords(query).split(" ").filter(Boolean);
  if (words.length === 0) return options.slice(0, limit);
  return options.filter((o) => words.every((w) => ` ${o.search}`.includes(` ${w}`))).slice(0, limit);
}

/** The sizes this category accepts, grouped as the reference data groups them. Empty when the category hides size. */
export function sizeOptionsFor(
  reference: ReferenceData,
  category: CategoryNode | null,
): { id: string; label: string }[] {
  if (!category || attributeMode(category, "size") === "hidden") return [];
  const allowed = allowedSizeIds(reference, category);
  const out: { id: string; label: string }[] = [];
  for (const group of reference.sizeGroups) {
    for (const size of group.sizes) if (allowed.has(size.id)) out.push({ id: size.id, label: size.label });
  }
  return out;
}

/** The parcel size every uploaded item gets: the category's usual one, else the first. */
export function parcelSizeFor(reference: ReferenceData, category: CategoryNode | null): string | null {
  return category?.defaultParcelSizeId ?? reference.parcelSizes[0]?.id ?? null;
}

// What an item holds and what is sent, the same on the website and on the phone

/** The fields of one upload item that the listing rules look at. Prices are already in minor units (null when not a number). */
export type UploadItemFields = {
  title: string;
  description: string;
  categoryId: string | null;
  brandId: string | null;
  /** The brand as written. Used only when `brandId` is null. */
  brandText: string;
  sizeId: string | null;
  conditionId: string | null;
  colourIds: readonly string[];
  priceMinor: number | null;
};

/** The values the listing rules look at, with the rows the category hides cleared (as the server does). */
export function listingValuesOf(fields: UploadItemFields, donePhotos: number, reference: ReferenceData) {
  const category = fields.categoryId ? findCategory(reference.categories, fields.categoryId) : null;
  const values = stripHiddenAttributes(
    {
      title: fields.title,
      description: fields.description,
      categoryId: fields.categoryId,
      brandId: fields.brandId,
      brandName: fields.brandId ? null : fields.brandText.trim() || null,
      sizeId: fields.sizeId,
      conditionId: fields.conditionId,
      colourIds: [...fields.colourIds],
      parcelSizeId: parcelSizeFor(reference, category),
      priceMinor: fields.priceMinor,
      photoCount: donePhotos,
    },
    category,
  );
  return { values, category };
}

/** One uploaded photo as the server wants it. */
export type UploadedPhoto = { key: string; width: number; height: number };

/** One item as the server wants it. The item must be complete. */
export function buildPublishItem(
  fields: UploadItemFields,
  photos: readonly UploadedPhoto[],
  reference: ReferenceData,
  extra: { clientId: string; ownerFullName?: string },
): AdminListingItemInput {
  const { values, category } = listingValuesOf(fields, photos.length, reference);
  return {
    clientId: extra.clientId,
    ...(extra.ownerFullName ? { ownerFullName: extra.ownerFullName } : {}),
    title: fields.title.trim(),
    description: fields.description.trim(),
    categoryId: fields.categoryId as string,
    brandId: values.brandId ?? null,
    brandName: values.brandId ? null : (values.brandName ?? null),
    sizeId: values.sizeId ?? null,
    conditionId: values.conditionId ?? null,
    colourIds: [...(values.colourIds ?? [])],
    parcelSizeId: parcelSizeFor(reference, category),
    priceMinor: fields.priceMinor as number,
    photos: photos.map((p) => ({
      key: p.key,
      width: p.width,
      height: p.height,
      contentType: "image/jpeg" as const,
    })),
  };
}
