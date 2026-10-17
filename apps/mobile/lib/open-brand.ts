import type { useRouter } from "expo-router";
import { brandSearchState } from "@/lib/brand-search";
import { useSearchStore } from "@/lib/search-store";

/** Opens the search results for one brand (see `brandSearchState`). */
export function openBrandSearch(
  router: ReturnType<typeof useRouter>,
  brand: { id?: string | null; name: string } | null,
) {
  if (!brand) return;
  useSearchStore.getState().reset("search", brandSearchState(brand));
  router.push("/search");
}
