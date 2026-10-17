import { type CategoryNode, isReadingCategory, type ReferenceData, referenceDataSchema } from "@vinty/shared";
import { serverApi } from "@/lib/api";
import type { Lang } from "@/lib/i18n";

/** For server components: the reference data (categories, sizes, conditions, colours...). Cached for an hour. */
export function getReference(lang: Lang): Promise<ReferenceData> {
  return serverApi("/v1/reference", { lang, schema: referenceDataSchema, anonymous: true, revalidate: 3600 });
}

/** The reference data asked fresh every time. The sell form sends category and size ids back to the server, so an hour old copy could hold ids that changed. */
export function getFreshReference(lang: Lang): Promise<ReferenceData> {
  return serverApi("/v1/reference", { lang, schema: referenceDataSchema, anonymous: true });
}

/** Condition names for the card's BRAND · SIZE · CONDITION line, with the reading words books and magazines use. */
export type ConditionNames = {
  /** Condition slug to its name in the page language. */
  names: Record<string, string>;
  /** The same for books and magazines ("Well read"). */
  forBooks: Record<string, string>;
  /** Every category whose items use the reading words. */
  readingCategoryIds: string[];
};

export async function getConditionNames(lang: Lang): Promise<ConditionNames> {
  try {
    const reference = await getReference(lang);
    const readingCategoryIds: string[] = [];
    const walk = (nodes: CategoryNode[]) => {
      for (const node of nodes) {
        if (isReadingCategory(node)) readingCategoryIds.push(node.id);
        walk(node.children);
      }
    };
    walk(reference.categories);
    return {
      names: Object.fromEntries(reference.conditions.map((c) => [c.slug, c.name[lang]])),
      forBooks: Object.fromEntries(reference.conditions.map((c) => [c.slug, (c.forBooks ?? c).name[lang]])),
      readingCategoryIds,
    };
  } catch {
    return { names: {}, forBooks: {}, readingCategoryIds: [] };
  }
}
