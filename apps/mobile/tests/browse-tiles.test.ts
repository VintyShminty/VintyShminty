import { existsSync } from "node:fs";
import { join } from "node:path";
import en from "@vinty/locales/en.json";
import he from "@vinty/locales/he.json";
import { BROWSE_MORE_TILES, BROWSE_TILES } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import { flattenCategories } from "../../../packages/db/src/seed/reference/categories";

// Tiles name categories by slug, and an unknown slug is skipped without any error, so a renamed category would
// silently empty a tile. These checks fail instead.
const slugs = new Set(flattenCategories().map((c) => c.slug));

const tiles = [...BROWSE_TILES, ...BROWSE_MORE_TILES];

describe("browse tiles", () => {
  it("find every tile in the file", () => {
    expect(tiles.every((t) => t.slugs.length > 0)).toBe(true);
    expect(tiles.every((t) => /\.jpg$/.test(t.photo))).toBe(true);
  });

  it("have a photo file in packages/design/browse", () => {
    const dir = join(__dirname, "../../../packages/design/browse");
    expect(tiles.filter((t) => !existsSync(join(dir, t.photo))).map((t) => t.key)).toEqual([]);
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
    expect(BROWSE_TILES).toHaveLength(10);
  });
});

describe("category hints in the picker", () => {
  it("exist in both languages and belong to a real category", () => {
    const enKeys = Object.keys(en.sell.categoryHints).sort();
    expect(Object.keys(he.sell.categoryHints).sort()).toEqual(enKeys);
    expect(enKeys.filter((k) => !slugs.has(k))).toEqual([]);
  });
});
