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
