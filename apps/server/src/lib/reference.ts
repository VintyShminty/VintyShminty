import { createHash } from "node:crypto";
import {
  categories,
  categorySizeGroups,
  colours,
  conditions,
  currencies,
  type Database,
  feeRules,
  materials,
  parcelSizes,
  patterns,
  platformSettings,
  sizeGroups,
  sizes,
} from "@vinty/db";
import en from "@vinty/locales/en.json" with { type: "json" };
import he from "@vinty/locales/he.json" with { type: "json" };
import type { CategoryNode, ReferenceData } from "@vinty/shared";
import { asc, desc, eq } from "drizzle-orm";

type Db = NonNullable<Database["db"]>;

/** The platform settings the phone is allowed to see. The rest stay on the server. */
const PUBLIC_SETTINGS = [
  "default_currency",
  "listing_max_photos",
  "listing_min_price_minor",
  "single_market",
];

type BookCondition = Record<string, { name: string; description: string } | undefined>;

/** The reading words for a condition level (books and magazines), from the shared wording. */
function bookWords(slug: string) {
  const inEn = (en.bookCondition as BookCondition)[slug];
  const inHe = (he.bookCondition as BookCondition)[slug];
  if (!inEn || !inHe) return {};
  return {
    forBooks: {
      name: { en: inEn.name, he: inHe.name },
      description: { en: inEn.description, he: inHe.description },
    },
  };
}

/** Reads every reference table and shapes it the way GET /v1/reference answers. Names always carry both languages. */
export async function buildReferenceData(db: Db): Promise<ReferenceData> {
  const [
    categoryRows,
    categoryGroupRows,
    groupRows,
    sizeRows,
    conditionRows,
    colourRows,
    materialRows,
    patternRows,
    parcelRows,
    currencyRows,
    feeRows,
    settingRows,
  ] = await Promise.all([
    db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)),
    db.select().from(categorySizeGroups).orderBy(asc(categorySizeGroups.sortOrder)),
    db.select().from(sizeGroups).orderBy(asc(sizeGroups.sortOrder)),
    db.select().from(sizes).orderBy(asc(sizes.sortOrder)),
    db.select().from(conditions).orderBy(asc(conditions.rank)),
    db.select().from(colours).orderBy(asc(colours.sortOrder)),
    db.select().from(materials).orderBy(asc(materials.sortOrder)),
    db.select().from(patterns).orderBy(asc(patterns.sortOrder)),
    db.select().from(parcelSizes).where(eq(parcelSizes.isActive, true)).orderBy(asc(parcelSizes.sortOrder)),
    db.select().from(currencies).where(eq(currencies.isEnabled, true)),
    db.select().from(feeRules).where(eq(feeRules.isActive, true)).orderBy(desc(feeRules.activeFrom)),
    db.select().from(platformSettings),
  ]);

  const groupsByCategory = new Map<string, string[]>();
  for (const row of categoryGroupRows) {
    const list = groupsByCategory.get(row.categoryId) ?? [];
    list.push(row.sizeGroupId);
    groupsByCategory.set(row.categoryId, list);
  }

  const nodes = new Map<string, CategoryNode>();
  for (const c of categoryRows) {
    nodes.set(c.id, {
      id: c.id,
      slug: c.slug,
      path: c.path,
      name: { en: c.nameEn, he: c.nameHe },
      icon: c.icon,
      isLeaf: c.isLeaf,
      rules: {
        brand: c.brandMode,
        size: c.sizeMode,
        condition: c.conditionMode,
        colour: c.colourMode,
        material: c.materialMode,
        pattern: c.patternMode,
      },
      sizeGroupIds: groupsByCategory.get(c.id) ?? [],
      defaultParcelSizeId: c.defaultParcelSizeId,
      children: [],
    });
  }
  const roots: CategoryNode[] = [];
  for (const c of categoryRows) {
    const node = nodes.get(c.id) as CategoryNode;
    const parent = c.parentId ? nodes.get(c.parentId) : undefined;
    if (parent) parent.children.push(node);
    else if (!c.parentId) roots.push(node);
  }

  const sizesByGroup = new Map<string, ReferenceData["sizeGroups"][number]["sizes"]>();
  for (const s of sizeRows) {
    const list = sizesByGroup.get(s.sizeGroupId) ?? [];
    list.push({ id: s.id, slug: s.slug, label: s.label, name: { en: s.nameEn, he: s.nameHe } });
    sizesByGroup.set(s.sizeGroupId, list);
  }

  // One active rule per currency: the newest.
  const seenFee = new Set<string>();
  const feeRules_: ReferenceData["feeRules"] = [];
  for (const f of feeRows) {
    if (seenFee.has(f.currency)) continue;
    seenFee.add(f.currency);
    feeRules_.push({
      currency: f.currency,
      buyerFeeBasisPoints: f.buyerFeeBasisPoints,
      buyerFeeFixedMinor: f.buyerFeeFixedMinor,
    });
  }

  const data: Omit<ReferenceData, "version"> = {
    categories: roots,
    sizeGroups: groupRows.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: { en: g.nameEn, he: g.nameHe },
      kind: g.kind,
      sizes: sizesByGroup.get(g.id) ?? [],
    })),
    conditions: conditionRows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: { en: c.nameEn, he: c.nameHe },
      description: { en: c.descriptionEn, he: c.descriptionHe },
      rank: c.rank,
      ...bookWords(c.slug),
    })),
    colours: colourRows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: { en: c.nameEn, he: c.nameHe },
      swatchHex: c.swatchHex,
    })),
    materials: materialRows.map((m) => ({ id: m.id, slug: m.slug, name: { en: m.nameEn, he: m.nameHe } })),
    patterns: patternRows.map((p) => ({ id: p.id, slug: p.slug, name: { en: p.nameEn, he: p.nameHe } })),
    parcelSizes: parcelRows.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: { en: p.nameEn, he: p.nameHe },
      description: { en: p.descriptionEn, he: p.descriptionHe },
      maxWeightGrams: p.maxWeightGrams,
      priceMinor: p.priceMinor,
      currency: p.currency,
    })),
    currencies: currencyRows.map((c) => ({
      code: c.code,
      symbol: c.symbol,
      minorUnitExponent: c.minorUnitExponent,
    })),
    feeRules: feeRules_,
    settings: Object.fromEntries(
      settingRows.filter((s) => PUBLIC_SETTINGS.includes(s.key)).map((s) => [s.key, s.value]),
    ),
  };
  // The version is a fingerprint of the content, so it is also the ETag: it changes exactly when the data does.
  const version = createHash("sha1").update(JSON.stringify(data)).digest("hex").slice(0, 16);
  return { version, ...data };
}

/**
 * The reference data kept in memory for ten minutes. It changes by reseeding, not while people use the app. Every load
 * reads about 300 KB from the database, so a short time here multiplied by many server copies used up the hosted
 * database's monthly transfer allowance.
 */
export function createReferenceCache(db: Db, ttlMs = 10 * 60_000) {
  let cached: { at: number; value: ReferenceData } | null = null;
  let pending: Promise<ReferenceData> | null = null;
  return {
    async get(): Promise<ReferenceData> {
      if (cached && Date.now() - cached.at < ttlMs) return cached.value;
      pending ??= buildReferenceData(db)
        .then((value) => {
          cached = { at: Date.now(), value };
          return value;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
    clear() {
      cached = null;
    },
  };
}
export type ReferenceCache = ReturnType<typeof createReferenceCache>;
