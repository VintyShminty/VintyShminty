import { useQueries } from "@tanstack/react-query";
import { searchPageSchema } from "@vinty/shared";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { type SideTile, tileCategoryIds } from "@/lib/browse-tiles";
import { useReference } from "@/lib/reference";

/**
 * The cover of the newest active listing in each tile's categories (D-052), one cached request per tile.
 * A few are asked for so two tiles that cover the same items can each take a different one. Until a cover
 * arrives (or when a tile has no listing) the entry is undefined and the tile keeps its stock photo.
 */
export function useTileCovers(tiles: SideTile[], enabled = true): (string | undefined)[] {
  const tree = useReference().data?.categories;
  const ids = useMemo(
    () => tiles.map((tile) => (tree ? tileCategoryIds(tree, tile, tile.group) : [])),
    [tiles, tree],
  );
  const results = useQueries({
    queries: ids.map((list) => ({
      queryKey: ["browse-cover", list],
      queryFn: async () => {
        const page = await api(`/v1/listings?sort=newest&categoryIds=${list.join(",")}&limit=6`, {
          schema: searchPageSchema,
        });
        return page.items.flatMap((item) => (item.cover ? [item.cover.url] : []));
      },
      enabled: enabled && list.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
  });
  // One string for every tile's covers, so the list can change length (Women and Men have a different number of tiles).
  const key = JSON.stringify(results.map((r) => r.data ?? null));
  // Each tile takes its newest cover that no tile before it already shows.
  return useMemo(() => {
    const taken = new Set<string>();
    return (JSON.parse(key) as (string[] | null)[]).map((urls) => {
      const url = urls?.find((u) => !taken.has(u));
      if (url) taken.add(url);
      return url;
    });
  }, [key]);
}
