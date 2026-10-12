import { eq, inArray, sql } from "drizzle-orm";
import {
  badgeDefinitions,
  brands,
  bumpPlans,
  categories,
  categorySizeGroups,
  colours,
  conditions,
  currencies,
  feeRules,
  materials,
  parcelSizes,
  patterns,
  platformSettings,
  sizeGroups,
  sizes,
} from "../schema/index.js";
import type { SeedDb } from "./connection.js";
import {
  badgeSeed,
  brandNames,
  bumpPlanSeed,
  colourSeed,
  conditionSeed,
  currencySeed,
  feeRuleSeed,
  flattenCategories,
  materialSeed,
  parcelSizeSeed,
  patternSeed,
  platformSettingSeed,
  sizeGroupSeed,
  slugifyBrand,
} from "./reference/index.js";

export interface ReferenceCounts {
  [table: string]: number;
}

/** Inserts or updates all reference data. Safe to run again and safe in production. */
export async function seedReference(db: SeedDb): Promise<ReferenceCounts> {
  const counts: ReferenceCounts = {};

  await db
    .insert(currencies)
    .values([...currencySeed])
    .onConflictDoUpdate({
      target: currencies.code,
      set: {
        symbol: sql`excluded.symbol`,
        minorUnitExponent: sql`excluded.minor_unit_exponent`,
        nameEn: sql`excluded.name_en`,
        nameHe: sql`excluded.name_he`,
        isEnabled: sql`excluded.is_enabled`,
      },
    });
  counts.currencies = currencySeed.length;

  await db
    .insert(parcelSizes)
    .values(
      parcelSizeSeed.map((p) => ({
        slug: p.slug,
        nameEn: p.en,
        nameHe: p.he,
        descriptionEn: p.descEn,
        descriptionHe: p.descHe,
        maxWeightGrams: p.maxWeightGrams,
        maxLengthMm: p.maxLengthMm,
        priceMinor: p.priceMinor,
        sortOrder: p.sortOrder,
      })),
    )
    .onConflictDoUpdate({
      target: parcelSizes.slug,
      set: {
        nameEn: sql`excluded.name_en`,
        nameHe: sql`excluded.name_he`,
        descriptionEn: sql`excluded.description_en`,
        descriptionHe: sql`excluded.description_he`,
        maxWeightGrams: sql`excluded.max_weight_grams`,
        maxLengthMm: sql`excluded.max_length_mm`,
        priceMinor: sql`excluded.price_minor`,
        sortOrder: sql`excluded.sort_order`,
      },
    });
  counts.parcel_sizes = parcelSizeSeed.length;

  await db
    .insert(conditions)
    .values(
      conditionSeed.map((c) => ({
        slug: c.slug,
        nameEn: c.en,
        nameHe: c.he,
        descriptionEn: c.descEn,
        descriptionHe: c.descHe,
        rank: c.rank,
      })),
    )
    .onConflictDoUpdate({
      target: conditions.slug,
      set: {
        nameEn: sql`excluded.name_en`,
        nameHe: sql`excluded.name_he`,
        descriptionEn: sql`excluded.description_en`,
        descriptionHe: sql`excluded.description_he`,
        rank: sql`excluded.rank`,
      },
    });
  counts.conditions = conditionSeed.length;

  await db
    .insert(colours)
    .values(
      colourSeed.map((c, i) => ({
        slug: c.slug,
        nameEn: c.en,
        nameHe: c.he,
        swatchHex: c.hex,
        sortOrder: i + 1,
      })),
    )
    .onConflictDoUpdate({
      target: colours.slug,
      set: {
        nameEn: sql`excluded.name_en`,
        nameHe: sql`excluded.name_he`,
        swatchHex: sql`excluded.swatch_hex`,
        sortOrder: sql`excluded.sort_order`,
      },
    });
  counts.colours = colourSeed.length;

  await db
    .insert(materials)
    .values(materialSeed.map((m, i) => ({ slug: m.slug, nameEn: m.en, nameHe: m.he, sortOrder: i + 1 })))
    .onConflictDoUpdate({
      target: materials.slug,
      set: {
        nameEn: sql`excluded.name_en`,
        nameHe: sql`excluded.name_he`,
        sortOrder: sql`excluded.sort_order`,
      },
    });
  counts.materials = materialSeed.length;

  await db
    .insert(patterns)
    .values(patternSeed.map((m, i) => ({ slug: m.slug, nameEn: m.en, nameHe: m.he, sortOrder: i + 1 })))
    .onConflictDoUpdate({
      target: patterns.slug,
      set: {
        nameEn: sql`excluded.name_en`,
        nameHe: sql`excluded.name_he`,
        sortOrder: sql`excluded.sort_order`,
      },
    });
  counts.patterns = patternSeed.length;

  // Size groups and sizes
  await db
    .insert(sizeGroups)
    .values(
      sizeGroupSeed.map((g, i) => ({
        slug: g.slug,
        nameEn: g.en,
        nameHe: g.he,
        kind: g.kind,
        sortOrder: i + 1,
      })),
    )
    .onConflictDoUpdate({
      target: sizeGroups.slug,
      set: {
        nameEn: sql`excluded.name_en`,
        nameHe: sql`excluded.name_he`,
        kind: sql`excluded.kind`,
        sortOrder: sql`excluded.sort_order`,
      },
    });
  const groupRows = await db.select({ id: sizeGroups.id, slug: sizeGroups.slug }).from(sizeGroups);
  const groupId = new Map(groupRows.map((g) => [g.slug, g.id]));
  const sizeRows = sizeGroupSeed.flatMap((g) =>
    g.sizes.map((s, i) => ({
      sizeGroupId: groupId.get(g.slug) as string,
      slug: s.slug,
      label: s.label,
      nameEn: s.en,
      nameHe: s.he,
      sortOrder: i + 1,
    })),
  );
  await db
    .insert(sizes)
    .values(sizeRows)
    .onConflictDoUpdate({
      target: [sizes.sizeGroupId, sizes.slug],
      set: {
        label: sql`excluded.label`,
        nameEn: sql`excluded.name_en`,
        nameHe: sql`excluded.name_he`,
        sortOrder: sql`excluded.sort_order`,
      },
    });
  counts.size_groups = sizeGroupSeed.length;
  counts.sizes = sizeRows.length;

  // Brands
  const brandRows = brandNames.map((name, i) => ({
    slug: slugifyBrand(name),
    name,
    popularity: (brandNames.length - i) * 10,
  }));
  await db
    .insert(brands)
    .values(brandRows)
    .onConflictDoUpdate({
      target: brands.slug,
      set: { name: sql`excluded.name`, popularity: sql`excluded.popularity` },
    });
  counts.brands = brandRows.length;

  // Categories, one depth level at a time so parents exist first
  const parcelRows = await db.select({ id: parcelSizes.id, slug: parcelSizes.slug }).from(parcelSizes);
  const parcelId = new Map(parcelRows.map((p) => [p.slug, p.id]));
  const flat = flattenCategories();
  const categoryId = new Map<string, string>();
  const maxDepth = Math.max(...flat.map((f) => f.depth));
  for (let depth = 0; depth <= maxDepth; depth++) {
    const level = flat.filter((f) => f.depth === depth);
    const rows = await db
      .insert(categories)
      .values(
        level.map((f) => ({
          parentId: f.parentSlug ? (categoryId.get(f.parentSlug) ?? null) : null,
          slug: f.slug,
          path: f.path,
          depth: f.depth,
          nameEn: f.en,
          nameHe: f.he,
          icon: f.icon,
          sortOrder: f.sortOrder,
          isLeaf: f.isLeaf,
          brandMode: f.rules.brand,
          sizeMode: f.rules.size,
          conditionMode: f.rules.condition,
          colourMode: f.rules.colour,
          materialMode: f.rules.material,
          patternMode: f.rules.pattern,
          defaultParcelSizeId: parcelId.get(f.parcel) ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          parentId: sql`excluded.parent_id`,
          path: sql`excluded.path`,
          depth: sql`excluded.depth`,
          nameEn: sql`excluded.name_en`,
          nameHe: sql`excluded.name_he`,
          icon: sql`excluded.icon`,
          sortOrder: sql`excluded.sort_order`,
          isLeaf: sql`excluded.is_leaf`,
          brandMode: sql`excluded.brand_mode`,
          sizeMode: sql`excluded.size_mode`,
          conditionMode: sql`excluded.condition_mode`,
          colourMode: sql`excluded.colour_mode`,
          materialMode: sql`excluded.material_mode`,
          patternMode: sql`excluded.pattern_mode`,
          defaultParcelSizeId: sql`excluded.default_parcel_size_id`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: categories.id, slug: categories.slug });
    for (const r of rows) categoryId.set(r.slug, r.id);
  }
  // Category to size group links are rewritten from the seed so removed links do not linger.
  const ids = [...categoryId.values()];
  for (let i = 0; i < ids.length; i += 500) {
    await db.delete(categorySizeGroups).where(inArray(categorySizeGroups.categoryId, ids.slice(i, i + 500)));
  }
  const linkRows = flat.flatMap((f) =>
    f.sizes.map((slug, i) => ({
      categoryId: categoryId.get(f.slug) as string,
      sizeGroupId: groupId.get(slug) as string,
      sortOrder: i + 1,
    })),
  );
  for (let i = 0; i < linkRows.length; i += 500) {
    await db.insert(categorySizeGroups).values(linkRows.slice(i, i + 500));
  }
  counts.categories = flat.length;
  counts.category_size_groups = linkRows.length;

  // Fee rules, bump plans, settings, badges
  for (const rule of feeRuleSeed) {
    const existing = await db
      .select({ id: feeRules.id })
      .from(feeRules)
      .where(eq(feeRules.currency, rule.currency))
      .limit(1);
    if (existing.length === 0) await db.insert(feeRules).values(rule);
  }
  counts.fee_rules = feeRuleSeed.length;

  await db
    .insert(bumpPlans)
    .values(
      bumpPlanSeed.map((b) => ({
        slug: b.slug,
        nameEn: b.en,
        nameHe: b.he,
        durationHours: b.durationHours,
        priceMinor: b.priceMinor,
      })),
    )
    .onConflictDoUpdate({
      target: bumpPlans.slug,
      set: {
        nameEn: sql`excluded.name_en`,
        nameHe: sql`excluded.name_he`,
        durationHours: sql`excluded.duration_hours`,
        priceMinor: sql`excluded.price_minor`,
      },
    });
  counts.bump_plans = bumpPlanSeed.length;

  await db
    .insert(platformSettings)
    .values(platformSettingSeed)
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: sql`excluded.value`, description: sql`excluded.description`, updatedAt: sql`now()` },
    });
  counts.platform_settings = platformSettingSeed.length;

  await db
    .insert(badgeDefinitions)
    .values(
      badgeSeed.map((b) => ({
        slug: b.slug,
        nameEn: b.en,
        nameHe: b.he,
        descriptionEn: b.descEn,
        descriptionHe: b.descHe,
        icon: b.icon,
        target: b.target,
        showOnProfile: b.showOnProfile,
      })),
    )
    .onConflictDoUpdate({
      target: badgeDefinitions.slug,
      set: {
        nameEn: sql`excluded.name_en`,
        nameHe: sql`excluded.name_he`,
        descriptionEn: sql`excluded.description_en`,
        descriptionHe: sql`excluded.description_he`,
        icon: sql`excluded.icon`,
        target: sql`excluded.target`,
        showOnProfile: sql`excluded.show_on_profile`,
      },
    });
  counts.badge_definitions = badgeSeed.length;

  return counts;
}
