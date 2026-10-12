import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

// Runs only when DATABASE_URL is set (a migrated local database). CI has none, so it is skipped there.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("database smoke test", () => {
  const sql = url ? postgres(url, { max: 1 }) : (undefined as never);

  afterAll(async () => {
    await sql?.end();
  });

  it("is reachable", async () => {
    const [row] = await sql`select 1 as ok`;
    expect(row?.ok).toBe(1);
  });

  it("has the migrated tables", async () => {
    const rows = await sql`select table_name from information_schema.tables where table_schema = 'public'`;
    const names = rows.map((r) => r.table_name);
    for (const table of ["users", "listings", "orders", "messages", "categories"]) {
      expect(names).toContain(table);
    }
  });

  it("builds a Hebrew and English search vector", async () => {
    const [row] = await sql`select to_tsvector('simple', 'ג׳ינס Levis כחול')::text as v`;
    expect(String(row?.v)).toContain("levis");
  });

  it("has the full text index and the feed index on listings", async () => {
    const rows = await sql`select indexname from pg_indexes where tablename = 'listings'`;
    const names = rows.map((r) => r.indexname);
    expect(names).toContain("listings_search_idx");
    expect(names).toContain("listings_feed_idx");
  });
});
