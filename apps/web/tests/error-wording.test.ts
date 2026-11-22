import en from "@vinty/locales/en.json";
import he from "@vinty/locales/he.json";
import { describe, expect, it } from "vitest";

describe("error page wording", () => {
  it("has the same keys in English and Hebrew, all filled in", () => {
    expect(Object.keys(he.web.error).sort()).toEqual(Object.keys(en.web.error).sort());
    for (const lang of [en, he]) {
      for (const value of [...Object.values(lang.web.error), lang.common.tryAgain]) {
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});
