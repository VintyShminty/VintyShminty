import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Originality rule (docs/originality.md, guideline 3): some words are another app's words, so they must never reach
// a user. This test reads every sentence in both language files (and the legal pages) and fails if one comes back.
const BANNED_EN: [string, RegExp][] = [
  ["Vinted", /vinted/i],
  ["Buyer Protection", /buyer protection/i],
  ["Bump", /\bbump(?:ed|s|ing)?\b/i],
  ["members", /\bmembers?\b/i],
  ["wardrobe", /wardrobe/i],
  ["Bundle discounts", /bundle discounts?/i],
  ["Holiday mode", /holiday/i],
  ["Personalisation", /personali[sz]ation/i],
  ["Satisfactory", /satisfactory/i],
  ["Frequent uploads", /frequent uploads?/i],
  ["Speedy shipping", /speedy shipping/i],
  ["Ask seller", /ask (?:the )?seller/i],
  ['"incl." under a price', /\bincl\./i],
  ["Order shipped", /order shipped/i],
  ["Delivered", /\bdelivered\b/i],
  ["Your sale is complete", /sale is complete/i],
];

const BANNED_HE: [string, RegExp][] = [
  ["members", /חברים|חבר שנמחק/],
  ["Buyer Protection", /הגנת קונה|הגנת הקונה/],
  ["Bundle discounts", /הנחות? על חבילות|הנחת חבילה|קנייה בחבילה/],
  ["Holiday mode", /חופשה/],
  ["Bump", /קידום|מקודם/],
  ["Personalisation", /התאמה אישית/],
  ["Satisfactory", /במצב סביר/],
  ["Frequent uploads", /העלאות תכופות/],
  ["Speedy shipping", /שליחה מהירה/],
  ["Ask seller", /שאל[וי]? את המוכר/],
  ["incl.", /כולל/],
  ["Order shipped", /ההזמנה נשלחה/],
  ["Delivered", /ההזמנה נמסרה/],
  ["Your sale is complete", /המכירה הושלמה/],
];

function sentences(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => sentences(child, path ? `${path}.${key}` : key));
  }
  return [];
}

function load(lang: string) {
  const locales = join(__dirname, "..", "..", "..", "packages", "locales");
  // The app and website wording, plus the website's Terms, Privacy and About (packages/locales/legal).
  return [`${lang}.json`, join("legal", `${lang}.json`)].flatMap((file) =>
    sentences(JSON.parse(readFileSync(join(locales, file), "utf8"))),
  );
}

describe("banned words", () => {
  for (const [lang, banned] of [
    ["en", BANNED_EN],
    ["he", BANNED_HE],
  ] as const) {
    it(`${lang}.json has none of them`, () => {
      const found: string[] = [];
      for (const [path, text] of load(lang)) {
        for (const [name, pattern] of banned) {
          if (pattern.test(text)) found.push(`${path}  "${text}"  (${name})`);
        }
      }
      expect(found).toEqual([]);
    });
  }

  it("catches a banned word when one is there", () => {
    expect(BANNED_EN.some(([, pattern]) => pattern.test("Bump for 3 days"))).toBe(true);
    expect(BANNED_HE.some(([, pattern]) => pattern.test("הגנת קונה"))).toBe(true);
  });
});
