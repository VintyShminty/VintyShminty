export const currencySeed = [
  {
    code: "ILS",
    symbol: "₪",
    minorUnitExponent: 2,
    nameEn: "Israeli shekel",
    nameHe: "שקל חדש",
    isEnabled: true,
  },
  { code: "EUR", symbol: "€", minorUnitExponent: 2, nameEn: "Euro", nameHe: "אירו", isEnabled: false },
  {
    code: "USD",
    symbol: "$",
    minorUnitExponent: 2,
    nameEn: "US dollar",
    nameHe: "דולר אמריקאי",
    isEnabled: false,
  },
] as const;
