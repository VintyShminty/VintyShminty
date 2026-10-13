import type { CategoryNode } from "@vinty/shared";
import { STORAGE_URL } from "@/lib/config";

/**
 * The Browse tiles (D-019, row 5). This is the one place to reorder, add or remove a tile.
 * The first ten show on the Browse tab in this order, the rest sit behind the "More" tile.
 *
 * - `key` names the tile in the language files (`browse.tiles.<key>`).
 * - `photo` is a file in object storage under `browse/` (the sample photos, see `pnpm storage:seed`).
 * - `slugs` are the categories the tile covers. Each one includes everything below it, and a tile may cover
 *   several (Jeans covers the Women, Men and Kids jeans categories).
 */
export type BrowseTile = { key: string; photo: string; slugs: string[] };

export const TILES: BrowseTile[] = [
  { key: "dresses", photo: "01-dress.jpg", slugs: ["women-clothing-dresses", "kids-girls-dresses"] },
  {
    key: "tops",
    photo: "19-t-shirt.jpg",
    slugs: [
      "women-clothing-tops",
      "men-clothing-t-shirts",
      "men-clothing-shirts",
      "kids-girls-tops",
      "kids-boys-tops",
    ],
  },
  {
    key: "jeans",
    photo: "05-jeans.jpg",
    slugs: ["women-clothing-jeans", "men-clothing-jeans", "kids-girls-trousers", "kids-boys-trousers"],
  },
  {
    key: "trousers",
    photo: "06-jeans.jpg",
    slugs: ["women-clothing-trousers", "men-clothing-trousers", "kids-girls-trousers", "kids-boys-trousers"],
  },
  { key: "skirts", photo: "28-skirt.jpg", slugs: ["women-clothing-skirts", "kids-girls-skirts"] },
  {
    key: "coats",
    photo: "22-coat.jpg",
    slugs: [
      "women-clothing-outerwear",
      "men-clothing-outerwear",
      "kids-girls-outerwear",
      "kids-boys-outerwear",
      "kids-baby-outerwear",
    ],
  },
  {
    key: "knitwear",
    photo: "16-sweater.jpg",
    slugs: ["women-clothing-knitwear", "men-clothing-knitwear", "kids-boys-hoodies"],
  },
  {
    key: "sneakers",
    photo: "08-sneakers.jpg",
    slugs: ["women-shoes-sneakers", "men-shoes-sneakers", "kids-shoes-sneakers"],
  },
  { key: "shoes", photo: "26-boots.jpg", slugs: ["women-shoes", "men-shoes", "kids-shoes"] },
  { key: "bags", photo: "14-handbag.jpg", slugs: ["women-bags", "men-accessories-bags"] },
];

/** Behind the "More" tile. Designer is browse only (D-015), so it lives here. */
export const MORE_TILES: BrowseTile[] = [
  { key: "accessories", photo: "33-watch.jpg", slugs: ["women-accessories", "men-accessories"] },
  { key: "kids", photo: "32-kids-clothes.jpg", slugs: ["kids"] },
  {
    key: "sportswear",
    photo: "47-hoodie.jpg",
    slugs: ["sports", "women-clothing-activewear", "men-clothing-activewear"],
  },
  { key: "designer", photo: "15-handbag.jpg", slugs: ["designer"] },
  { key: "home", photo: "41-vase.jpg", slugs: ["home"] },
  { key: "electronics", photo: "37-headphones.jpg", slugs: ["electronics"] },
  { key: "media", photo: "39-books.jpg", slugs: ["media"] },
  { key: "hobbies", photo: "45-camera.jpg", slugs: ["hobbies"] },
];

export const findTile = (key: string | undefined) => [...TILES, ...MORE_TILES].find((t) => t.key === key);

export const tilePhotoUrl = (tile: BrowseTile) => `${STORAGE_URL}/browse/${tile.photo}`;

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
  tile: BrowseTile,
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
export function tileGroups(tile: BrowseTile): TileGroup[] {
  return TILE_GROUPS.filter((g) => tile.slugs.some((s) => groupOfSlug(s) === g));
}
