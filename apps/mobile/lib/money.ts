/** Whole shekels show without decimals, as in the design (₪45, ₪1,250). Other currencies use their own symbol. */
const SYMBOLS: Record<string, string> = { ILS: "₪", EUR: "€", USD: "$" };

export function formatMoney(minor: number, currency: string): string {
  const major = minor / 100;
  const text = major.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${SYMBOLS[currency] ?? `${currency} `}${text}`;
}

/** "45", "45.5" or "1,250" typed in the price field to minor units. Null when empty or not a number. */
export function priceTextToMinor(text: string): number | null {
  const clean = text.replace(/[,\s₪]/g, "");
  if (clean === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(Number.parseFloat(clean) * 100);
}

/** Minor units back to what the price field shows: whole shekels without decimals. */
export function minorToPriceText(minor: number | null): string {
  if (minor === null) return "";
  const major = minor / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}
