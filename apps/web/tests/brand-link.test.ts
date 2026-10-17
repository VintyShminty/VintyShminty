import { describe, expect, it } from "vitest";
import { brandSearchHref } from "../lib/brand-link";
import { parseFilters } from "../lib/filters";

const ID = "0b9f3c1e-4c1a-4f55-9a57-3a8d3e0c7a11";

describe("brand link", () => {
  it("opens the search page with the brand filter", () => {
    const href = brandSearchHref("en", { id: ID, name: "Zara" });
    const params = new URLSearchParams(href.split("?")[1]);
    expect(href.startsWith("/en/search?brand=")).toBe(true);
    expect(parseFilters(params, "relevance").brands).toEqual([{ id: ID, name: "Zara" }]);
  });

  it("searches the name as words for a typed brand", () => {
    const href = brandSearchHref("he", { id: null, name: "Bla & Co" });
    expect(href.startsWith("/he/search?")).toBe(true);
    expect(new URLSearchParams(href.split("?")[1]).get("q")).toBe("Bla & Co");
  });
});
