import enLegal from "@vinty/locales/legal/en.json";
import heLegal from "@vinty/locales/legal/he.json";
import type { Lang } from "@/lib/i18n";

/** A block is a paragraph (text) or a bullet list (array of text). */
export type LegalBlock = string | string[];
export type LegalSection = { id: string; heading: string; blocks: LegalBlock[] };
export type LegalDoc = { title: string; description: string; intro: string; sections: LegalSection[] };
export type LegalPage = "terms" | "privacy" | "about";

const docs = { en: enLegal, he: heLegal } as const;

/** The long text of the Terms, Privacy and About pages (packages/locales/legal). */
export function getLegalDoc(lang: Lang, page: LegalPage): LegalDoc {
  return docs[lang][page] as LegalDoc;
}
