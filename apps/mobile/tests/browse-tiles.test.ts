import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { flattenCategories } from "../../../packages/db/src/seed/reference/categories";
import en from "../i18n/locales/en.json";
import he from "../i18n/locales/he.json";

// Tiles name categories by slug, and an unknown slug is skipped without any error, so a renamed category would
// silently empty a tile. These checks fail instead.
const slugs = new Set(flattenCategories().map((c) => c.slug));

// The tile file loads pictures with require(), which a plain test run cannot do, so the file is read as text.
const source = readFileSync(join(__dirname, "../lib/browse-tiles.ts"), "utf8");
const tiles = [...source.matchAll(/key:\s*"(\w+)"[\s\S]*?slugs:\s*\[([^\]]*)\]/g)].map((m) => ({
  key: m[1] as string,
  slugs: [...(m[2] as string).matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1] as string),
}));
const shown = source.slice(0, source.indexOf("export const MORE_TILES"));

describe("browse tiles", () => {
  it("find every tile in the file", () => {
    expect(tiles.every((t) => t.slugs.length > 0)).toBe(true);
  });

  it("only name categories that exist in the category seed", () => {
    const unknown = tiles.flatMap((tile) =>
      tile.slugs.filter((s) => !slugs.has(s)).map((s) => `${tile.key}: ${s}`),
    );
    expect(unknown).toEqual([]);
  });

  it("has a name in both languages for every tile", () => {
    for (const tile of tiles) {
      expect(en.browse.tiles).toHaveProperty(tile.key);
      expect(he.browse.tiles).toHaveProperty(tile.key);
    }
  });

  it("shows ten tiles on Browse", () => {
    expect(tiles.length).toBeGreaterThan(10);
    expect([...shown.matchAll(/key:\s*"/g)]).toHaveLength(10);
  });
});

describe("category hints in the picker", () => {
  it("exist in both languages and belong to a real category", () => {
    const enKeys = Object.keys(en.sell.categoryHints).sort();
    expect(Object.keys(he.sell.categoryHints).sort()).toEqual(enKeys);
    expect(enKeys.filter((k) => !slugs.has(k))).toEqual([]);
  });
});
