import { cleanBrandName, formatBrandName, slugifyBrand } from "@vinty/shared";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { brands, listings, userEvents } from "../schema/index.js";
import type { SeedDb } from "./connection.js";
import { brandNames } from "./reference/index.js";

/**
 * One-time (and safe to run again) tidy of the brand list:
 * 1. every brand name is written properly ("MICHAEL KORS" becomes "Michael Kors"), keeping the spelling of the starter
 *    list exactly ("H&M", "COS", "IKEA"),
 * 2. brands that differ only in capitals or spacing become one (listings and followers move to the one that stays),
 * 3. every listing shows the name of its brand,
 * 4. listings that only have a typed brand name are linked to the brand with the same name.
 * Running it twice changes nothing the second time.
 */

export type BrandRow = {
  id: string;
  slug: string;
  name: string;
  nameHe: string | null;
  aliases: string[];
  popularity: number;
  isActive: boolean;
  createdAt: Date;
};

export type BrandPlan = {
  /** Brands that keep existing, with their new name and the Hebrew name and aliases they inherit from merged brands. */
  keep: { id: string; oldName: string; name: string; nameHe: string | null; aliases: string[] }[];
  /** Brands that disappear into another one. */
  merge: { id: string; name: string; into: string; intoName: string }[];
};

/** The properly written name: the starter list's spelling when the brand is on it, otherwise the capitals rule. */
export function properBrandName(
  row: Pick<BrandRow, "slug" | "name">,
  starter: Map<string, string> = starterSpellings(),
): string {
  return starter.get(row.slug) ?? starter.get(slugifyBrand(row.name)) ?? formatBrandName(row.name);
}

/** Starter list spellings by web address. */
export function starterSpellings(names: readonly string[] = brandNames): Map<string, string> {
  return new Map(names.map((name) => [slugifyBrand(name), name]));
}

/** Works out what the tidy would do, without touching the database. */
export function planBrandCleanup(rows: BrandRow[], starter = starterSpellings()): BrandPlan {
  const groups = new Map<string, { row: BrandRow; name: string }[]>();
  for (const row of rows) {
    const name = properBrandName(row, starter);
    // Hebrew names have no Latin letters for a web address, so they group by their lower case text.
    const key = slugifyBrand(name) || cleanBrandName(name).toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), { row, name }]);
  }

  const plan: BrandPlan = { keep: [], merge: [] };
  for (const [key, members] of groups) {
    const rank = (m: { row: BrandRow }) => [
      m.row.slug === key && starter.has(key) ? 0 : 1, // the starter list's own row first
      m.row.isActive ? 0 : 1,
      -m.row.popularity,
      m.row.createdAt.getTime(),
      m.row.id,
    ];
    const sorted = [...members].sort((a, b) => {
      const x = rank(a);
      const y = rank(b);
      for (let i = 0; i < x.length; i++) {
        if (x[i] === y[i]) continue;
        return (x[i] as number | string) < (y[i] as number | string) ? -1 : 1;
      }
      return 0;
    });
    const [winner, ...losers] = sorted;
    if (!winner) continue;
    // The survivor inherits what the others knew: a Hebrew name, aliases, and the odd spellings they had.
    const aliases = new Set(winner.row.aliases);
    let nameHe = winner.row.nameHe;
    for (const { row } of losers) {
      nameHe ??= row.nameHe;
      for (const alias of row.aliases) aliases.add(alias);
    }
    plan.keep.push({
      id: winner.row.id,
      oldName: winner.row.name,
      name: winner.name,
      nameHe,
      aliases: [...aliases],
    });
    for (const { row } of losers) {
      plan.merge.push({ id: row.id, name: row.name, into: winner.row.id, intoName: winner.name });
    }
  }
  return plan;
}

export type CleanupReport = {
  renamed: { from: string; to: string }[];
  merged: { from: string; into: string; listings: number; followers: number }[];
  listingsRenamed: number;
  listingsLinked: { brandName: string; brand: string; listings: number }[];
};

class DryRun extends Error {}

/** Runs the tidy in one transaction. With `dryRun` everything is worked out and printed, then rolled back. */
export async function cleanBrands(db: SeedDb, { dryRun = false } = {}): Promise<CleanupReport> {
  const report: CleanupReport = { renamed: [], merged: [], listingsRenamed: 0, listingsLinked: [] };
  try {
    await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: brands.id,
          slug: brands.slug,
          name: brands.name,
          nameHe: brands.nameHe,
          aliases: brands.aliases,
          popularity: brands.popularity,
          isActive: brands.isActive,
          createdAt: brands.createdAt,
        })
        .from(brands);
      const plan = planBrandCleanup(rows);

      for (const m of plan.merge) {
        const moved = await tx
          .update(listings)
          .set({ brandId: m.into })
          .where(eq(listings.brandId, m.id))
          .returning({ id: listings.id });
        // A person following both spellings keeps one follow.
        const followers = await tx.execute(
          sql`insert into user_brands (user_id, brand_id, created_at)
              select user_id, ${m.into}::uuid, created_at from user_brands where brand_id = ${m.id}
              on conflict do nothing`,
        );
        await tx.update(userEvents).set({ brandId: m.into }).where(eq(userEvents.brandId, m.id));
        // Only after the move: the brand row is deleted last (its follows go with it, they were copied above).
        await tx.delete(brands).where(eq(brands.id, m.id));
        report.merged.push({
          from: m.name,
          into: m.intoName,
          listings: moved.length,
          followers: followers.count,
        });
      }

      for (const k of plan.keep) {
        const row = rows.find((r) => r.id === k.id);
        if (!row) continue;
        const sameAliases =
          k.aliases.length === row.aliases.length && k.aliases.every((a) => row.aliases.includes(a));
        if (k.name === row.name && k.nameHe === row.nameHe && sameAliases) continue;
        await tx
          .update(brands)
          .set({ name: k.name, nameHe: k.nameHe, aliases: k.aliases })
          .where(eq(brands.id, k.id));
        if (k.name !== row.name) report.renamed.push({ from: row.name, to: k.name });
      }

      // Every listing shows the name of its brand.
      const stale = await tx
        .update(listings)
        .set({
          brandName: sql`(select ${brands.name} from ${brands} where ${brands.id} = ${listings.brandId})`,
        })
        .where(
          and(
            isNotNull(listings.brandId),
            sql`${listings.brandName} is distinct from (select ${brands.name} from ${brands} where ${brands.id} = ${listings.brandId})`,
          ),
        )
        .returning({ id: listings.id });
      report.listingsRenamed = stale.length;

      // Listings with only a typed name join the brand with the same name (any capitals, same web address).
      const typed = await tx
        .selectDistinct({ brandName: listings.brandName })
        .from(listings)
        .where(and(isNull(listings.brandId), isNotNull(listings.brandName)));
      const active = await tx
        .select({ id: brands.id, name: brands.name, slug: brands.slug })
        .from(brands)
        .where(eq(brands.isActive, true));
      for (const { brandName } of typed) {
        if (!brandName) continue;
        const slug = slugifyBrand(brandName);
        const lower = cleanBrandName(brandName).toLowerCase();
        const brand = active.find((b) => (slug && b.slug === slug) || b.name.toLowerCase() === lower);
        if (!brand) continue;
        const linked = await tx
          .update(listings)
          .set({ brandId: brand.id, brandName: brand.name })
          .where(and(isNull(listings.brandId), eq(listings.brandName, brandName)))
          .returning({ id: listings.id });
        report.listingsLinked.push({ brandName, brand: brand.name, listings: linked.length });
      }

      if (dryRun) throw new DryRun();
    });
  } catch (error) {
    if (!(error instanceof DryRun)) throw error;
  }
  return report;
}

/** The report as lines for the console. */
export function describeCleanup(report: CleanupReport, dryRun: boolean): string[] {
  const lines: string[] = [dryRun ? "DRY RUN, nothing was saved" : "Saved", ""];
  lines.push(`Names rewritten: ${report.renamed.length}`);
  for (const r of report.renamed) lines.push(`  ${r.from}  ->  ${r.to}`);
  lines.push(`Duplicates merged: ${report.merged.length}`);
  for (const m of report.merged) {
    lines.push(`  ${m.from}  ->  ${m.into}  (${m.listings} listings, ${m.followers} followers moved)`);
  }
  lines.push(`Listings whose brand name was rewritten: ${report.listingsRenamed}`);
  const linked = report.listingsLinked.reduce((sum, l) => sum + l.listings, 0);
  lines.push(`Typed brand names linked to a brand: ${linked} listings`);
  for (const l of report.listingsLinked) lines.push(`  "${l.brandName}"  ->  ${l.brand}  (${l.listings})`);
  return lines;
}
