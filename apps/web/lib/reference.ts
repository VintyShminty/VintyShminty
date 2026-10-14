import { type ReferenceData, referenceDataSchema } from "@vinty/shared";
import { serverApi } from "@/lib/api";
import type { Lang } from "@/lib/i18n";

/** For server components: the reference data (categories, sizes, conditions, colours...). Cached for an hour. */
export function getReference(lang: Lang): Promise<ReferenceData> {
  return serverApi("/v1/reference", { lang, schema: referenceDataSchema, anonymous: true, revalidate: 3600 });
}

/** Condition slug to its name in the page language, for the card's BRAND · SIZE · CONDITION line. */
export async function getConditionNames(lang: Lang): Promise<Record<string, string>> {
  try {
    const reference = await getReference(lang);
    return Object.fromEntries(reference.conditions.map((c) => [c.slug, c.name[lang]]));
  } catch {
    return {};
  }
}
