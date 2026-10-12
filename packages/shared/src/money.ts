import { z } from "zod";

/** Number of digits after the decimal point for the currencies we may use. Default 2. */
export const CURRENCY_EXPONENT: Readonly<Record<string, number>> = {
  ILS: 2,
  EUR: 2,
  USD: 2,
  GBP: 2,
  JPY: 0,
};

export const DEFAULT_CURRENCY = "ILS";

export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, "Use a 3 letter ISO currency code");
export const minorUnitsSchema = z.number().int().min(0).max(2_000_000_000);

export interface Money {
  amountMinor: number;
  currency: string;
}
export const moneySchema = z.object({ amountMinor: minorUnitsSchema, currency: currencyCodeSchema });

export function currencyExponent(currency: string): number {
  return CURRENCY_EXPONENT[currency] ?? 2;
}

/** "12.50" style major units to integer minor units, rounded to the nearest unit. */
export function toMinorUnits(major: number, currency: string = DEFAULT_CURRENCY): number {
  return Math.round(major * 10 ** currencyExponent(currency));
}

export function fromMinorUnits(minor: number, currency: string = DEFAULT_CURRENCY): number {
  return minor / 10 ** currencyExponent(currency);
}

/** Display text such as "₪125.00" or "125.00 ₪" depending on the locale. */
export function formatMoney(minor: number, currency: string, locale: string): string {
  const exponent = currencyExponent(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(fromMinorUnits(minor, currency));
}
