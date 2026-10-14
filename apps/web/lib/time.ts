import type { TFunction } from "i18next";

/** "2 days ago", in the language of `t`. Rough on purpose: the largest whole unit. Same as the app. */
export function timeAgo(iso: string, t: TFunction, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return t("time.justNow");
  if (hours < 1) return t("time.minutesAgo", { count: minutes });
  if (days < 1) return t("time.hoursAgo", { count: hours });
  if (days < 30) return t("time.daysAgo", { count: days });
  if (days < 365) return t("time.monthsAgo", { count: Math.floor(days / 30) });
  return t("time.yearsAgo", { count: Math.floor(days / 365) });
}

/** "Oct 12, 2026". In UTC so the server and the browser always write the same day. */
export function formatDate(iso: string, language: string): string {
  return new Date(iso).toLocaleDateString(language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Oct 12" for when away mode ends. */
export function formatDay(iso: string, language: string): string {
  return new Date(iso).toLocaleDateString(language, { day: "numeric", month: "short", timeZone: "UTC" });
}
