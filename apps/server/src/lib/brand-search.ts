import { brands } from "@vinty/db";
import { type SQL, sql } from "drizzle-orm";

/** Escapes the characters that mean something to LIKE, so a search for "100%" finds "100%". */
export const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * True for brands whose English name, Hebrew name or an alias starts with the text, or has a word that starts with it
 * ("Ralph" finds "Polo Ralph Lauren", "מייקל" finds "מייקל קורס"). Capitals do not matter. `escaped` is already
 * lower case and escaped for LIKE.
 */
export function brandNameMatches(escaped: string): SQL {
  const start = `${escaped}%`;
  const word = `% ${escaped}%`;
  return sql`(
    lower(${brands.name}) like ${start} or lower(${brands.name}) like ${word}
    or lower(${brands.nameHe}) like ${start} or lower(${brands.nameHe}) like ${word}
    or exists (select 1 from unnest(${brands.aliases}) as alias where lower(alias) like ${start} or lower(alias) like ${word})
  )`;
}

/** True when a name, Hebrew name or alias STARTS with the text, so those come before names that only have a word with it. */
export function brandStartsWith(escaped: string): SQL {
  const start = `${escaped}%`;
  return sql`(
    lower(${brands.name}) like ${start} or lower(${brands.nameHe}) like ${start}
    or exists (select 1 from unnest(${brands.aliases}) as alias where lower(alias) like ${start})
  )`;
}
