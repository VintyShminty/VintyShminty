import en from "@vinty/locales/en.json";
import he from "@vinty/locales/he.json";
import { describe, expect, it } from "vitest";
import { formatUsd, parseMinor, shiftMonth, usdMicrosToIlsMinor } from "../lib/admin-format";
import { ADMIN_NAV } from "../lib/admin-nav";

describe("admin money", () => {
  it("keeps the small digits of a cost under one cent", () => {
    expect(formatUsd(3100, "en")).toBe("$0.0031");
    expect(formatUsd(2_500_000, "en")).toBe("$2.50");
    expect(formatUsd(0, "en")).toBe("$0.00");
  });

  it("turns micro dollars into agorot", () => {
    expect(usdMicrosToIlsMinor(1_000_000, 3.6)).toBe(360);
    expect(usdMicrosToIlsMinor(10_000_000, 3.6)).toBe(3600);
  });

  it("reads typed amounts", () => {
    expect(parseMinor("12.5")).toBe(1250);
    expect(parseMinor("12,50")).toBe(1250);
    expect(parseMinor("")).toBeNull();
    expect(parseMinor("-1")).toBeNull();
    expect(parseMinor("abc")).toBeNull();
  });
});

describe("admin months", () => {
  it("moves across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("admin wording", () => {
  it("has a name for every page in both languages", () => {
    for (const { key } of ADMIN_NAV) {
      expect((en.admin.nav as Record<string, string>)[key]).toBeTruthy();
      expect((he.admin.nav as Record<string, string>)[key]).toBeTruthy();
    }
  });
});
