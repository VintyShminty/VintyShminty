"use client";

import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

type Part = "morning" | "afternoon" | "evening";

/** Morning until noon, afternoon until 5 in the evening, evening after that (and through the night), like the app. */
export function partOfDay(date: Date): Part {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

const subscribe = () => () => {};

/**
 * The big Home greeting (D-030, row 7). Logged out: "Welcome in". Logged in: "Good morning," in light weight and the
 * first name in heavy weight, the part of the day taken from the visitor's own clock in the browser (the server
 * does not know their time zone), so the first line appears just after the page loads.
 */
export function HomeGreeting({ name }: { name: string | null }) {
  const { t } = useTranslation();
  const part = useSyncExternalStore(
    subscribe,
    () => partOfDay(new Date()),
    () => null,
  );
  if (!name) {
    return <h1 className="text-display font-extrabold text-text-1">{t("home.greetingGuest")}</h1>;
  }
  return (
    <h1 className="text-text-1">
      <span className="block min-h-[40px] text-display font-light">
        {part ? t(`home.greeting.${part}`) : ""}
      </span>
      <span className="block truncate text-display font-extrabold">{name}</span>
    </h1>
  );
}
