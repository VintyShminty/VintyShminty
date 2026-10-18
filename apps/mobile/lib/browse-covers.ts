import { useQuery } from "@tanstack/react-query";
import { type BrowseGender, browseCoversSchema } from "@vinty/shared";
import { useMemo } from "react";
import { api } from "@/lib/api";
import type { SideTile } from "@/lib/browse-tiles";

/**
 * The cover of the newest active listing in each tile's categories (D-052), all of one side in one cached request
 * (one request per tile used to start a server copy each). A few are sent per tile so two tiles that cover the same
 * items can each take a different one. Until the covers arrive (or when a tile has no listing) the entry is undefined
 * and the tile keeps its stock photo.
 */
export function useTileCovers(side: BrowseGender, tiles: SideTile[], enabled = true): (string | undefined)[] {
  const { data } = useQuery({
    queryKey: ["browse-covers", side],
    queryFn: () => api(`/v1/browse/covers?side=${side}`, { schema: browseCoversSchema }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  // Each tile takes its newest cover that no tile before it already shows.
  return useMemo(() => {
    const taken = new Set<string>();
    return tiles.map((tile) => {
      const url = data?.covers[tile.key]?.find((u) => !taken.has(u));
      if (url) taken.add(url);
      return url;
    });
  }, [data, tiles]);
}
