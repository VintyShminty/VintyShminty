import type { CategoryNode } from "./reference-data.js";

/**
 * The Browse tiles (D-019, row 5), shared by the app and the website. This is the one place to reorder, add or remove a tile.
 * The first ten show on the Browse tab in this order, the rest sit behind the "More" tile.
 *
 * - `key` names the tile in the language files (`browse.tiles.<key>`).
 * - `photo` is a file name in `packages/design/browse/`. The app and the website each turn it into a picture they can show
 *   (the app with `require`, the website with a static import).
 * - `slugs` are the categories the tile covers. Each one includes everything below it, and a tile may cover
 *   several (Jeans covers the Women, Men and Kids jeans categories).
 */
export type BrowseTile = { key: string; photo: string; slugs: string[] };

export const BROWSE_TILES: BrowseTile[] = [
  {
    key: "dresses",
    photo: "01-dress.jpg",
    slugs: ["women-clothing-dresses", "kids-girls-dresses"],
  },
  {
    key: "tops",
    photo: "19-t-shirt.jpg",
    slugs: [
      "women-clothing-tops-t-shirts",
      "women-clothing-tops-tank-tops",
      "women-clothing-tops-crop-tops",
      "women-clothing-tops-long-sleeve",
      "women-clothing-tops-bodysuits",
      "men-clothing-tops",
      "kids-girls-tops-t-shirts",
      "kids-girls-tops-polos",
      "kids-girls-tops-long-sleeve",
      "kids-boys-tops-t-shirts",
      "kids-boys-tops-polos",
      "kids-boys-tops-long-sleeve",
    ],
  },
  {
    key: "shirts",
    photo: "31-shirt.jpg",
    slugs: [
      "women-clothing-tops-button-up",
      "women-clothing-tops-blouses",
      "women-clothing-tops-overshirts",
      "men-clothing-shirts",
      "kids-girls-tops-shirts",
      "kids-boys-tops-shirts",
    ],
  },
  {
    key: "jeans",
    photo: "05-jeans.jpg",
    slugs: [
      "women-clothing-jeans",
      "men-clothing-jeans",
      "kids-girls-trousers-jeans",
      "kids-boys-trousers-jeans",
    ],
  },
  {
    key: "trousers",
    photo: "06-jeans.jpg",
    slugs: [
      "women-clothing-trousers",
      "women-clothing-shorts",
      "men-clothing-trousers",
      "men-clothing-shorts",
      "kids-girls-trousers-trousers",
      "kids-girls-trousers-leggings",
      "kids-girls-trousers-joggers",
      "kids-girls-shorts",
      "kids-boys-trousers-trousers",
      "kids-boys-trousers-leggings",
      "kids-boys-trousers-joggers",
      "kids-boys-shorts",
    ],
  },
  {
    key: "skirts",
    photo: "28-skirt.jpg",
    slugs: ["women-clothing-skirts", "kids-girls-skirts"],
  },
  {
    key: "coats",
    photo: "22-coat.jpg",
    slugs: [
      "women-clothing-coats",
      "women-clothing-jackets",
      "men-clothing-coats",
      "men-clothing-jackets",
      "kids-girls-outerwear",
      "kids-boys-outerwear",
      "kids-baby-outerwear",
    ],
  },
  {
    key: "knitwear",
    photo: "16-sweater.jpg",
    slugs: [
      "women-clothing-knitwear",
      "women-clothing-sweatshirts",
      "men-clothing-knitwear",
      "men-clothing-sweatshirts",
      "kids-girls-sweatshirts",
      "kids-boys-sweatshirts",
      "kids-baby-knitwear",
    ],
  },
  {
    key: "sneakers",
    photo: "08-sneakers.jpg",
    slugs: ["women-shoes-sneakers", "men-shoes-sneakers", "kids-shoes-sneakers"],
  },
  {
    key: "shoes",
    photo: "26-boots.jpg",
    slugs: ["women-shoes", "men-shoes", "kids-shoes"],
  },
];

/** Behind the "More" tile. Designer is browse only (D-015), so it lives here. */
export const BROWSE_MORE_TILES: BrowseTile[] = [
  {
    key: "bags",
    photo: "14-handbag.jpg",
    slugs: ["women-bags", "men-accessories-bags"],
  },
  {
    key: "accessories",
    photo: "33-watch.jpg",
    slugs: ["women-accessories", "men-accessories"],
  },
  { key: "kids", photo: "32-kids-clothes.jpg", slugs: ["kids"] },
  {
    key: "sportswear",
    photo: "47-hoodie.jpg",
    slugs: [
      "sports",
      "women-clothing-sportswear",
      "men-clothing-sportswear",
      "kids-girls-sportswear",
      "kids-boys-sportswear",
    ],
  },
  { key: "designer", photo: "15-handbag.jpg", slugs: ["designer"] },
  { key: "home", photo: "41-vase.jpg", slugs: ["home"] },
  { key: "electronics", photo: "37-headphones.jpg", slugs: ["electronics"] },
  { key: "media", photo: "39-books.jpg", slugs: ["media"] },
  { key: "hobbies", photo: "45-camera.jpg", slugs: ["hobbies"] },
];

/** The picture of the "More" tile (a fallback file in `packages/design/browse/`, never a listing). */
export const BROWSE_MORE_PHOTO = "20-t-shirt.jpg";

/** The two sides of the website's Browse panel. */
export const BROWSE_GENDERS = ["women", "men"] as const;
export type BrowseGender = (typeof BROWSE_GENDERS)[number];

/** Men's tiles that need their own fallback picture, because the shared one shows a woman or a woman's item. */
const MEN_PHOTOS: Record<string, string> = {
  coats: "24-coat.jpg",
  knitwear: "18-sweater.jpg",
  sneakers: "09-sneakers.jpg",
};

/** Tiles that sit behind More for everyone else but are among the ten for Men (Men has no Dresses or Skirts). */
const MEN_EXTRA_KEYS = ["accessories", "sportswear"];

/**
 * The ten tiles of the website's Browse panel for one side. Each tile keeps only that side's categories (so Jeans for
 * Men covers just the men's jeans), and a tile that side has nothing for is left out (no Dresses or Skirts for Men).
 * The tile pages take `?group=women|men` to open on the same side.
 */
export function browseTilesFor(gender: BrowseGender): BrowseTile[] {
  const pool = [...BROWSE_TILES, ...BROWSE_MORE_TILES];
  const keys = BROWSE_TILES.map((t) => t.key);
  if (gender === "men") keys.push(...MEN_EXTRA_KEYS);
  const out: BrowseTile[] = [];
  for (const key of keys) {
    const tile = pool.find((t) => t.key === key);
    if (!tile) continue;
    const slugs = tile.slugs.filter((s) => groupOfSlug(s) === gender);
    if (slugs.length === 0) continue;
    out.push({ key, photo: (gender === "men" && MEN_PHOTOS[key]) || tile.photo, slugs });
  }
  return out.slice(0, 10);
}

export const findBrowseTile = (key: string | undefined) =>
  [...BROWSE_TILES, ...BROWSE_MORE_TILES].find((t) => t.key === key);

/** The chips inside a tile's results. */
export const TILE_GROUPS = ["women", "men", "kids"] as const;
export type TileGroup = (typeof TILE_GROUPS)[number];

/** Which of Women, Men or Kids a category slug belongs to. Everything else (Home, Designer...) has none. */
export function groupOfSlug(slug: string): TileGroup | null {
  const first = slug.split("-")[0];
  return TILE_GROUPS.find((g) => g === first) ?? null;
}

function walk(nodes: readonly CategoryNode[], visit: (node: CategoryNode) => void) {
  for (const node of nodes) {
    visit(node);
    walk(node.children, visit);
  }
}

/** The category ids a tile covers, optionally only the Women, Men or Kids part. Unknown slugs are skipped. */
export function tileCategoryIds(
  tree: readonly CategoryNode[],
  tile: Pick<BrowseTile, "slugs">,
  group?: TileGroup,
): string[] {
  const bySlug = new Map<string, string>();
  walk(tree, (node) => bySlug.set(node.slug, node.id));
  const ids: string[] = [];
  for (const slug of tile.slugs) {
    if (group && groupOfSlug(slug) !== group) continue;
    const id = bySlug.get(slug);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Women, Men and Kids parts a tile actually has, in order. */
export function tileGroups(tile: Pick<BrowseTile, "slugs">): TileGroup[] {
  return TILE_GROUPS.filter((g) => tile.slugs.some((s) => groupOfSlug(s) === g));
}
