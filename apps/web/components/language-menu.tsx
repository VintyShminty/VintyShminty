"use client";

import { Check, Globe } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LANG_COOKIE, LANGUAGES, type Lang, switchPath } from "@/lib/i18n";
import { cn, FOCUS_RING, MENU_ROW } from "@/lib/utils";

/**
 * The language picker (D-035): a globe button with the current language's short name that opens a small menu with
 * English and עברית, a check on the current one. Choosing one remembers it in the `lang` cookie and opens the same page
 * in that language. It follows the usual menu button pattern: Arrow keys move, Home and End jump, Escape closes and
 * gives the focus back to the button, Tab leaves, and a click anywhere else closes it. `up` opens it above the button
 * (the phone drawer, where there is no room below).
 */
export function LanguageMenu({ lang, up = false }: { lang: Lang; up?: boolean }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const items = useCallback(
    () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const all = items();
    (all.find((el) => el.getAttribute("aria-checked") === "true") ?? all[0])?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, items]);

  const onKeyDown = (e: KeyboardEvent) => {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => {
      e.preventDefault();
      all[(i + all.length) % all.length]?.focus();
    };
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    } else if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(all.length - 1);
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={t("settings.language")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className={cn(
          "inline-flex h-10 items-center gap-xs rounded-control px-md text-body-sm font-semibold text-text-2 hover:text-primary",
          FOCUS_RING,
        )}
      >
        <Globe size={16} aria-hidden />
        {t("web.nav.languageShort")}
      </button>
      {open ? (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          onKeyDown={onKeyDown}
          aria-label={t("settings.language")}
          className={cn(
            "absolute end-0 z-50 w-[160px] rounded-window border border-border bg-background p-sm",
            up ? "bottom-full mb-sm" : "top-full mt-sm",
          )}
        >
          {LANGUAGES.map((language) => {
            const current = language === lang;
            return (
              <Link
                key={language}
                href={switchPath(pathname, language)}
                hrefLang={language}
                lang={language}
                role="menuitemradio"
                aria-checked={current}
                tabIndex={-1}
                onClick={() => {
                  // biome-ignore lint/suspicious/noDocumentCookie: a plain one-line cookie, the Cookie Store API is not in every browser yet
                  document.cookie = `${LANG_COOKIE}=${language}; path=/; max-age=31536000; samesite=lax`;
                  setOpen(false);
                }}
                className={cn(
                  "flex h-10 w-full items-center gap-md rounded-control px-md text-start text-body-sm text-text-1",
                  MENU_ROW,
                  current ? "font-bold" : "font-semibold",
                )}
              >
                <span className="min-w-0 flex-1">{t(`languages.${language}`)}</span>
                {current ? <Check size={16} aria-hidden className="text-primary" /> : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
