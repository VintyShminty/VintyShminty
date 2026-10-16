import en from "@vinty/locales/en.json";
import { describe, expect, it } from "vitest";
import { feedPath, homeHref, pagePath, parseMood } from "../lib/feed-url";
import { homeEmptyText } from "../lib/home-empty";
import { switchPath } from "../lib/i18n";
import { loginHref, safeNext, signUpHref } from "../lib/login-links";

const t = (key: string, options?: Record<string, unknown>) =>
  `${key}${options ? JSON.stringify(options) : ""}`;

describe("feed addresses", () => {
  it("reads the mood and falls back to for_you", () => {
    expect(parseMood("new_today")).toBe("new_today");
    expect(parseMood(["under_50", "x"])).toBe("under_50");
    expect(parseMood("weird")).toBe("for_you");
    expect(parseMood(undefined)).toBe("for_you");
  });

  it("builds the feed and home addresses", () => {
    expect(feedPath("for_you")).toBe("/v1/feed");
    expect(feedPath("new_today")).toBe("/v1/feed?mood=new_today");
    expect(homeHref("en", "for_you")).toBe("/en");
    expect(homeHref("he", "under_50")).toBe("/he?mood=under_50");
  });

  it("adds paging with the right separator and encodes the cursor", () => {
    expect(pagePath("/v1/feed")).toBe("/v1/feed?limit=20");
    expect(pagePath("/v1/feed?mood=x", "a b/c")).toBe("/v1/feed?mood=x&limit=20&cursor=a%20b%2Fc");
  });
});

describe("login links", () => {
  it("keeps the page to come back to", () => {
    expect(loginHref("en")).toBe("/en/log-in");
    expect(signUpHref("he", "/he/item/1?x=2")).toBe("/he/sign-up?next=%2Fhe%2Fitem%2F1%3Fx%3D2");
  });

  it("never points to another website", () => {
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(loginHref("en", "//evil.example")).toBe("/en/log-in");
  });

  it("refuses addresses a browser would turn into another website", () => {
    expect(safeNext(decodeURIComponent("/%09/evil.com"))).toBeNull();
    expect(safeNext("/\n/evil.com")).toBeNull();
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("/\\evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
  });

  it("only comes back to pages under a language", () => {
    expect(safeNext("/en/item/123?x=1#y")).toBe("/en/item/123?x=1#y");
    expect(safeNext("/he")).toBe("/he");
    expect(safeNext("/")).toBeNull();
    expect(safeNext("/fr/item/1")).toBeNull();
    expect(safeNext("/english")).toBeNull();
  });
});

describe("empty Home text", () => {
  it("has a title and note for every mood", () => {
    for (const mood of ["for_you", "new_today", "under_50", "your_sizes", "near_you"] as const) {
      const text = homeEmptyText(mood, t, { hasSizes: true, city: "Haifa" });
      expect(text.title).toMatch(/^home\./);
      expect(text.message).toMatch(/^home\./);
    }
  });

  it("says what is missing for sizes and city", () => {
    expect(homeEmptyText("your_sizes", t, { hasSizes: false }).title).toContain("sizesUnset");
    expect(homeEmptyText("near_you", t, { city: null }).title).toContain("cityUnset");
    expect(homeEmptyText("near_you", t, { city: "Haifa" }).title).toContain("Haifa");
  });

  it("uses keys that exist in the language files", () => {
    expect(en.home.empty.sizesUnset.title).toBeTruthy();
    expect(en.home.empty.cityUnset.title).toBeTruthy();
  });
});

describe("language switch path", () => {
  it("swaps the first part", () => {
    expect(switchPath("/en/browse/dresses", "he")).toBe("/he/browse/dresses");
  });
});
