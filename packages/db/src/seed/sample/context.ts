import { eq } from "drizzle-orm";
import {
  badgeDefinitions,
  brands,
  bumpPlans,
  categories,
  categorySizeGroups,
  colours,
  conditions,
  feeRules,
  materials,
  parcelSizes,
  patterns,
  sizeGroups,
  sizes,
} from "../../schema/index.js";
import type { SeedDb } from "../connection.js";

/** Reference rows loaded once and looked up by slug or name while building sample data. */
export interface RefContext {
  categories: Map<string, typeof categories.$inferSelect>;
  /** Sizes of the first size group of a category, in order. */
  categorySizes: Map<string, string[]>;
  brandByName: Map<string, string>;
  conditionSlugs: { id: string; slug: string; rank: number }[];
  colourIds: string[];
  materialBySlug: Map<string, string>;
  patternIds: string[];
  parcelBySlug: Map<string, typeof parcelSizes.$inferSelect>;
  feeRule: { id: string; buyerFeeBasisPoints: number; buyerFeeFixedMinor: number };
  bumpPlanIds: string[];
  badges: { id: string; slug: string; target: number }[];
  allSizeIds: string[];
}

export async function loadRefContext(db: SeedDb): Promise<RefContext> {
  const cats = await db.select().from(categories);
  const links = await db.select().from(categorySizeGroups);
  const groupRows = await db.select().from(sizeGroups);
  const sizeRows = await db.select().from(sizes);
  const sizesByGroup = new Map<string, string[]>();
  for (const s of sizeRows.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = sizesByGroup.get(s.sizeGroupId) ?? [];
    list.push(s.id);
    sizesByGroup.set(s.sizeGroupId, list);
  }
  void groupRows;
  const categorySizes = new Map<string, string[]>();
  for (const cat of cats) {
    const first = links.filter((l) => l.categoryId === cat.id).sort((a, b) => a.sortOrder - b.sortOrder)[0];
    categorySizes.set(cat.slug, first ? (sizesByGroup.get(first.sizeGroupId) ?? []) : []);
  }
  const brandRows = await db.select().from(brands);
  const conditionRows = await db.select().from(conditions);
  const colourRows = await db.select().from(colours);
  const materialRows = await db.select().from(materials);
  const patternRows = await db.select().from(patterns);
  const parcelRows = await db.select().from(parcelSizes);
  const [rule] = await db.select().from(feeRules).where(eq(feeRules.currency, "ILS")).limit(1);
  if (!rule) throw new Error("No ILS fee rule. Run the reference seed first.");
  const planRows = await db.select().from(bumpPlans);
  const badgeRows = await db.select().from(badgeDefinitions);
  return {
    categories: new Map(cats.map((c) => [c.slug, c])),
    categorySizes,
    brandByName: new Map(brandRows.map((b) => [b.name, b.id])),
    conditionSlugs: conditionRows
      .map((c) => ({ id: c.id, slug: c.slug, rank: c.rank }))
      .sort((a, b) => a.rank - b.rank),
    colourIds: colourRows.map((c) => c.id),
    materialBySlug: new Map(materialRows.map((m) => [m.slug, m.id])),
    patternIds: patternRows.map((p) => p.id),
    parcelBySlug: new Map(parcelRows.map((p) => [p.slug, p])),
    feeRule: {
      id: rule.id,
      buyerFeeBasisPoints: rule.buyerFeeBasisPoints,
      buyerFeeFixedMinor: rule.buyerFeeFixedMinor,
    },
    bumpPlanIds: planRows.map((p) => p.id),
    badges: badgeRows.map((b) => ({ id: b.id, slug: b.slug, target: b.target })),
    allSizeIds: sizeRows.map((s) => s.id),
  };
}
