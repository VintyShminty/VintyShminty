import { feedPageSchema, homeFeedPageSchema, type ListingCard, searchPageSchema } from "@vinty/shared";
import type { ZodType } from "zod";
import { clientApi } from "@/lib/api-client";
import { FEED_PAGE_SIZE, pagePath } from "@/lib/feed-url";

export type GridPage = { items: ListingCard[]; nextCursor: string | null };

const SCHEMAS = { feed: homeFeedPageSchema, listings: searchPageSchema, plain: feedPageSchema } as const;
export type GridKind = keyof typeof SCHEMAS;

/**
 * The TanStack Query settings for one infinite grid. `InfiniteItemGrid` reads it, and Home also uses it to load the
 * other mood chips' first page in the background, so both must share the same key and the same fetcher.
 */
export function gridQueryOptions(kind: GridKind, endpoint: string, lang: string) {
  return {
    queryKey: ["grid", kind, endpoint, lang],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }: { pageParam: string | undefined }): Promise<GridPage> =>
      clientApi(pagePath(endpoint, pageParam, FEED_PAGE_SIZE), {
        schema: SCHEMAS[kind] as unknown as ZodType<GridPage>,
        lang,
      }),
    getNextPageParam: (last: GridPage) => last.nextCursor ?? undefined,
  };
}
