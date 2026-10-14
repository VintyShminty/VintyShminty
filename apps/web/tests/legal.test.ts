import en from "@vinty/locales/legal/en.json";
import he from "@vinty/locales/legal/he.json";
import { describe, expect, it } from "vitest";

type Doc = { sections: { id: string; blocks: (string | string[])[] }[] };
const pages = ["terms", "privacy", "about"] as const;
const text = (doc: Doc) => doc.sections.flatMap((s) => s.blocks.flat());
const notes = (doc: Doc) =>
  text(doc)
    .join(" ")
    .match(/\[[^\]]+\]/g)?.length ?? 0;

describe("legal pages", () => {
  for (const page of pages) {
    it(`${page} has the same sections, blocks and lawyer notes in both languages`, () => {
      const a = en[page] as Doc;
      const b = he[page] as Doc;
      expect(b.sections.map((s) => s.id)).toEqual(a.sections.map((s) => s.id));
      expect(b.sections.map((s) => s.blocks.map((x) => (Array.isArray(x) ? x.length : 0)))).toEqual(
        a.sections.map((s) => s.blocks.map((x) => (Array.isArray(x) ? x.length : 0))),
      );
      expect(notes(b)).toBe(notes(a));
    });

    it(`${page} follows the writing rules`, () => {
      for (const doc of [en[page], he[page]] as Doc[]) {
        expect(JSON.stringify(doc)).not.toMatch(/[–—;]/);
      }
    });
  }
});
