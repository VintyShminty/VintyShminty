import {
  type BrowseTile,
  type CategoryNode,
  groupOfSlug,
  type LocalisedName,
  type TileGroup,
  tileCategoryIds,
} from "@vinty/shared";

/**
 * The item types inside a Browse tile (the strip of photo tiles on its results page). A type is a child category of
 * one of the tile's categories (or that category itself when it has none). The same name under Women, Men and Kids
 * is one type, so "Sneakers" covers all three. `key` is the English name as a slug and goes in the address (`?type=`).
 */
export type SubType = {
  key: string;
  name: LocalisedName;
  ids: string[];
  byGroup: Partial<Record<TileGroup, string[]>>;
};

type Name = { en: string; he: string };

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function walk(nodes: readonly CategoryNode[], visit: (node: CategoryNode) => void) {
  for (const node of nodes) {
    visit(node);
    walk(node.children, visit);
  }
}

export function subTypesOf(tree: readonly CategoryNode[], tile: Pick<BrowseTile, "slugs">): SubType[] {
  const bySlug = new Map<string, CategoryNode>();
  walk(tree, (n) => bySlug.set(n.slug, n));
  const found = new Map<string, SubType>();
  for (const slug of tile.slugs) {
    const node = bySlug.get(slug);
    if (!node) continue;
    for (const child of node.children.length > 0 ? node.children : [node]) {
      const key = slugify(child.name.en);
      if (!key) continue;
      let entry = found.get(key);
      if (!entry) {
        entry = { key, name: child.name as Name, ids: [], byGroup: {} };
        found.set(key, entry);
      }
      if (!entry.ids.includes(child.id)) entry.ids.push(child.id);
      const group = groupOfSlug(child.slug);
      if (group) {
        const list = entry.byGroup[group] ?? [];
        if (!list.includes(child.id)) list.push(child.id);
        entry.byGroup[group] = list;
      }
    }
  }
  return [...found.values()];
}

/** The category ids of a type, optionally only its Women, Men or Kids part. */
export function subTypeIds(sub: SubType, group?: TileGroup): string[] {
  return group ? (sub.byGroup[group] ?? []) : sub.ids;
}

/** The category ids a results page searches: the chosen type, else the whole tile, narrowed to a group if one is chosen. */
export function pageCategoryIds(
  tree: readonly CategoryNode[],
  tile: BrowseTile,
  group: TileGroup | undefined,
  sub: SubType | undefined,
): string[] {
  return sub ? subTypeIds(sub, group) : tileCategoryIds(tree, tile, group);
}

/** The size groups the given categories use (their own, else those of their descendants). Empty when none say. */
export function sizeGroupIdsFor(tree: readonly CategoryNode[], categoryIds: readonly string[]): string[] {
  const wanted = new Set(categoryIds);
  const out = new Set<string>();
  const collect = (node: CategoryNode) => {
    for (const id of node.sizeGroupIds) out.add(id);
    if (node.sizeGroupIds.length === 0) for (const child of node.children) collect(child);
  };
  walk(tree, (n) => {
    if (wanted.has(n.id)) collect(n);
  });
  return [...out];
}
