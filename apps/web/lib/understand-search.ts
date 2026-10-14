import type { QueryClient } from "@tanstack/react-query";
import { referenceDataSchema, searchUnderstandingSchema } from "@vinty/shared";
import { clientApi } from "@/lib/api-client";
import { categoryNameMap, understoodHref } from "@/lib/search-assist";

/** Longer than this and the visitor gets the plain search instead of waiting. */
const WAIT_MS = 5000;

/**
 * Asks the server what the words mean and returns the results address with the filters switched on, or null for
 * "search the exact words" (not understood, failed, or too slow). Never throws.
 */
export async function understandSearch(
  text: string,
  lang: "en" | "he",
  brandFallback: string,
  queryClient: QueryClient,
): Promise<string | null> {
  const work = async () => {
    const understanding = await clientApi("/v1/search/understand", {
      method: "POST",
      body: { text, language: lang },
      schema: searchUnderstandingSchema,
    });
    if (!understanding.understood) return null;
    const brands = Object.fromEntries(understanding.brands.map((b) => [b.id, b.name]));
    const reference = understanding.categoryId
      ? await queryClient.fetchQuery({
          queryKey: ["reference", lang],
          queryFn: () => clientApi("/v1/reference", { schema: referenceDataSchema, lang }),
          staleTime: 60 * 60_000,
        })
      : null;
    return understoodHref(lang, text, understanding, {
      brands,
      categories: reference ? categoryNameMap(reference.categories, lang) : {},
      brandFallback,
    });
  };
  try {
    return await Promise.race([
      work(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), WAIT_MS)),
    ]);
  } catch {
    return null;
  }
}
