import { useQuery } from "@tanstack/react-query";
import type { LocalisedName } from "@vinty/shared";
import { useTranslation } from "react-i18next";
import { referenceQuery } from "@/lib/queries";

/** Reference data names carry both languages. This picks the one the app is in. */
export function useLocalName() {
  const { i18n } = useTranslation();
  const lang = i18n.language === "he" ? "he" : "en";
  return (name: LocalisedName | null | undefined) => (name ? name[lang] : "");
}

/** The cached reference data (categories, sizes, conditions and so on). */
export function useReference() {
  return useQuery(referenceQuery());
}
