import { describe, expect, it } from "vitest";
import en from "../i18n/locales/en.json";
import he from "../i18n/locales/he.json";
import { HELP_ARTICLE_IDS, HELP_GROUPS } from "../lib/help-topics";

// The Help Centre is bundled (no server route), so this checks every article listed has words in both languages.
describe("help topics", () => {
  for (const [name, locale] of [
    ["en", en],
    ["he", he],
  ] as const) {
    it(`${name} has a title and a body for every article, and a name for every group`, () => {
      for (const group of HELP_GROUPS) {
        expect(locale.help.groups[group.id], `${name} group ${group.id}`).toBeTruthy();
      }
      const articles = locale.help.articles as Record<string, { title: string; body: string }>;
      for (const id of HELP_ARTICLE_IDS) {
        expect(articles[id]?.title, `${name} ${id} title`).toBeTruthy();
        expect(articles[id]?.body, `${name} ${id} body`).toBeTruthy();
      }
      expect(Object.keys(articles).sort()).toEqual([...HELP_ARTICLE_IDS].sort());
    });
  }
});
