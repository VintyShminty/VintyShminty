import { describe, expect, it } from "vitest";
import { formatPrice, minorToPriceText, priceTextToMinor } from "./price-format.js";

describe("price text", () => {
  it("shows whole shekels without decimals and keeps the cents otherwise", () => {
    expect(formatPrice(4500, "ILS")).toBe("₪45");
    expect(formatPrice(125000, "ILS")).toBe("₪1,250");
    expect(formatPrice(4550, "ILS")).toBe("₪45.50");
    expect(formatPrice(1000, "EUR")).toBe("€10");
    expect(formatPrice(1000, "GBP")).toBe("GBP 10");
  });

  it("reads what is typed in the price field", () => {
    expect(priceTextToMinor("45")).toBe(4500);
    expect(priceTextToMinor("1,250")).toBe(125000);
    expect(priceTextToMinor("45.5")).toBe(4550);
    expect(priceTextToMinor("")).toBeNull();
    expect(priceTextToMinor("abc")).toBeNull();
  });

  it("goes back to field text", () => {
    expect(minorToPriceText(4500)).toBe("45");
    expect(minorToPriceText(4550)).toBe("45.50");
    expect(minorToPriceText(null)).toBe("");
  });
});
