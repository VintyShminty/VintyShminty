"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ToastProvider } from "@/components/admin/toast";
import { LanguageMenu } from "@/components/language-menu";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

/**
 * The frame of the back office: a sidebar on a laptop, a title bar with a menu on a phone. It sits on top of the
 * shop's own header and footer (a fixed full screen layer), so the admin area looks like its own place.
 */
export function AdminShell({ lang, children }: { lang: string; children: ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/${lang}/admin`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the phone menu whenever the page changes
  useEffect(() => setOpen(false), [pathname]);

  const links = (
    <ul className="flex flex-col gap-xs">
      {ADMIN_NAV.map(({ key, path, icon: Icon }) => {
        const href = `${base}${path}`;
        const active = path === "" ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={key}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-md rounded-control px-md text-body-sm font-semibold",
                active ? "bg-primary text-on-accent" : "text-text-2 hover:bg-pressed",
              )}
            >
              <Icon size={18} aria-hidden />
              {t(`admin.nav.${key}`)}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const footer = (
    <div className="flex items-center justify-between gap-sm">
      <Link href={`/${lang}`} className="text-body-sm font-semibold text-text-2 hover:text-text-1">
        {t("admin.backToSite")}
      </Link>
      <LanguageMenu lang={lang === "he" ? "he" : "en"} up />
    </div>
  );

  return (
    <ToastProvider>
      <div className="fixed inset-0 z-[100] flex flex-col bg-background md:flex-row">
        <aside className="hidden w-64 shrink-0 flex-col gap-lg border-e border-border bg-surface p-lg md:flex">
          <p className="px-md text-heading font-extrabold text-primary">{t("admin.title")}</p>
          <nav aria-label={t("admin.title")} className="flex-1">
            {links}
          </nav>
          {footer}
        </aside>

        <header className="relative shrink-0 border-b border-border bg-surface md:hidden">
          <div className="flex h-14 items-center justify-between px-lg">
            <p className="text-heading font-extrabold text-primary">{t("admin.title")}</p>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={t("admin.menu")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-control text-text-1 hover:bg-pressed"
            >
              {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
            </button>
          </div>
          {open ? (
            <nav
              aria-label={t("admin.title")}
              className="absolute inset-x-0 top-full z-10 flex flex-col gap-md border-b border-border bg-surface p-lg shadow-lg"
            >
              {links}
              {footer}
            </nav>
          ) : null}
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-lg md:p-xl">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
