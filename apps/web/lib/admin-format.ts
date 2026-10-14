import type { AdminAction } from "@vinty/shared";
import { formatMoney } from "@vinty/shared";
import type { TFunction } from "i18next";

/** Dollars from micro dollars (millionths). Under one cent keeps the small digits, for example $0.0031. */
export function formatUsd(micros: number, language: string): string {
  const dollars = micros / 1_000_000;
  const digits = dollars === 0 || dollars >= 0.01 ? 2 : dollars >= 0.0001 ? 4 : 6;
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(dollars);
}

/** Agorot from micro dollars at a rate of shekels per dollar. */
export function usdMicrosToIlsMinor(micros: number, rate: number): number {
  return Math.round((micros * rate) / 10_000);
}

/** Shekels, for example "₪12.40". */
export function formatIls(minor: number, language: string): string {
  return formatMoney(minor, "ILS", language);
}

/** A big number with separators, for example 12,400. */
export function formatCount(value: number, language: string): string {
  return new Intl.NumberFormat(language).format(value);
}

/** "2026-10" for a date, in UTC like the server. */
export function monthOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** The month before or after a YYYY-MM one. */
export function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  return monthOf(new Date(Date.UTC(year, m - 1 + by, 1)));
}

/** "October 2026". */
export function monthLabel(month: string, language: string): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString(language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Oct 12" for the Monday a week starts on. */
export function weekLabel(weekStart: string, language: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString(language, {
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  });
}

/** How an AI provider's name is written. Names we have no entry for are shown as they are stored. */
const PROVIDER_NAMES: Record<string, string> = { anthropic: "Anthropic", openai: "OpenAI", google: "Google" };
export function providerName(provider: string): string {
  return PROVIDER_NAMES[provider] ?? provider;
}

/** "5 minutes ago", "yesterday", in the page language. */
export function relativeTime(iso: string, language: string, now: number = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 2_592_000) return rtf.format(Math.round(seconds / 86_400), "day");
  if (abs < 31_536_000) return rtf.format(Math.round(seconds / 2_592_000), "month");
  return rtf.format(Math.round(seconds / 31_536_000), "year");
}

/** Amount typed in major units ("12.5") to minor units (1250). Null when it is not a number of zero or more. */
export function parseMinor(text: string): number | null {
  const value = Number(text.trim().replace(",", "."));
  if (!text.trim() || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** What an AI action is called on screen. Falls back to the raw name for one we have no wording for. */
export function aiActionName(action: string, t: TFunction): string {
  return t(`admin.aiActions.${action}`, { defaultValue: action });
}

const asText = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

/** One plain sentence for a row of the activity log. */
export function describeAction(action: AdminAction, t: TFunction): string {
  const d = action.details;
  switch (action.action) {
    case "user_role_changed":
      return d.to === "admin" ? t("admin.actions.madeAdmin") : t("admin.actions.removedAdmin");
    case "user_deleted":
      return t("admin.actions.userDeleted", {
        name: asText(d.username) ?? asText(d.email) ?? t("admin.actions.aPerson"),
      });
    case "admin_granted":
      return t("admin.actions.adminGranted");
    case "expenses_config_saved":
      return t("admin.actions.expensesConfigSaved");
    case "expenses_month_saved":
      return t("admin.actions.expensesMonthSaved", { month: action.targetId ?? "" });
    case "expenses_month_cleared":
      return t("admin.actions.expensesMonthCleared", { month: action.targetId ?? "" });
    case "switch_changed": {
      const name = t(`admin.security.switches.${action.targetId ?? ""}.name`, {
        defaultValue: action.targetId ?? "",
      });
      return d.enabled === true
        ? t("admin.actions.switchedOn", { name })
        : t("admin.actions.switchedOff", { name });
    }
    case "ai_auto_disabled":
      return t("admin.actions.aiAutoDisabled", { reason: asText(d.reason) ?? "" });
    default:
      return action.action;
  }
}
