"use client";

import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Globe,
  Lock,
  LogOut,
  type LucideIcon,
  MapPin,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  User,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLogOut } from "@/components/auth/log-out";
import { cn } from "@/lib/utils";

type Item = { path: string; icon: LucideIcon; label: string };

/**
 * Settings (D-030, decision 8): on a laptop the list of sections sits at the start and the page of the chosen section
 * at the end (two columns). On a phone the list is the Settings page and a section opens as its own page with a Back
 * link, like the app. Phone alerts have no meaning in a browser, so Alerts shows email only.
 */
export function SettingsFrame({ lang, children }: { lang: string; children: ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname().replace(/\/$/, "");
  const base = `/${lang}/settings`;
  const isIndex = pathname === base;
  const { logOut, busy } = useLogOut(lang);

  const items: Item[] = [
    { path: "profile", icon: User, label: t("settings.profileDetails") },
    { path: "account", icon: UserCog, label: t("settings.account") },
    { path: "security", icon: ShieldCheck, label: t("settings.security") },
    { path: "privacy", icon: Lock, label: t("settings.privacy") },
    { path: "shopping", icon: SlidersHorizontal, label: t("shopping.title") },
    { path: "addresses", icon: MapPin, label: t("address.title") },
    { path: "away-mode", icon: Moon, label: t("away.title") },
    { path: "alerts", icon: Bell, label: t("settings.notifications") },
    { path: "language", icon: Globe, label: t("settings.language") },
  ];
  const rowClass =
    "flex min-h-12 w-full items-center gap-md rounded-control px-md text-start text-body-sm font-semibold hover:bg-pressed";

  return (
    <main className="mx-auto w-full max-w-[1100px] px-lg pb-2xl pt-xl md:grid md:grid-cols-[280px_minmax(0,1fr)] md:items-start md:gap-2xl md:px-xl">
      <nav aria-label={t("settings.title")} className={cn(!isIndex && "hidden md:block")}>
        {isIndex ? (
          <h1 className="mb-md text-title font-bold text-text-1">{t("settings.title")}</h1>
        ) : (
          <p className="mb-md text-title font-bold text-text-1">{t("settings.title")}</p>
        )}
        <ul className="flex flex-col gap-xs">
          {items.map(({ path, icon: Icon, label }) => {
            const href = `${base}/${path}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={path}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(rowClass, active ? "bg-accent-tint text-primary" : "text-text-1")}
                >
                  <Icon size={18} aria-hidden className={active ? "text-primary" : "text-text-3"} />
                  <span className="min-w-0 flex-1">{label}</span>
                  <ChevronRight size={16} aria-hidden className="text-text-4 md:hidden rtl:-scale-x-100" />
                </Link>
              </li>
            );
          })}
          <li className="mt-md border-t border-border-subtle pt-md">
            <Link href={`/${lang}/help`} className={cn(rowClass, "text-text-1")}>
              <CircleHelp size={18} aria-hidden className="text-text-3" />
              <span className="min-w-0 flex-1">{t("web.auth.menu.help")}</span>
              <ChevronRight size={16} aria-hidden className="text-text-4 md:hidden rtl:-scale-x-100" />
            </Link>
          </li>
          <li>
            <button type="button" onClick={logOut} disabled={busy} className={cn(rowClass, "text-error")}>
              <LogOut size={18} aria-hidden />
              <span className="min-w-0 flex-1">{t("settings.logOut")}</span>
            </button>
          </li>
        </ul>
      </nav>
      <div className={cn("min-w-0", isIndex && "hidden md:block")}>
        {isIndex ? (
          <p className="py-2xl text-subtitle text-text-3">{t("web.settings.pickSection")}</p>
        ) : (
          <>
            <Link
              href={base}
              className="mb-md inline-flex h-10 items-center gap-xs text-body-sm font-semibold text-primary hover:underline md:hidden"
            >
              <ChevronLeft size={18} aria-hidden className="rtl:-scale-x-100" />
              {t("settings.title")}
            </Link>
            {children}
          </>
        )}
      </div>
    </main>
  );
}
