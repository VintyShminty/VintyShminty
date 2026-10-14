"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLogOut } from "@/components/auth/log-out";
import { ACCOUNT_LINKS } from "@/lib/account-links";
import type { Viewer } from "@/lib/viewer";

const itemClass =
  "flex h-10 w-full items-center gap-md rounded-control px-md text-start text-body-sm font-semibold text-text-1 hover:text-primary focus-visible:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary";

/**
 * The avatar in the top bar opens a small menu: Profile, My orders, Balance, Favourites, Saved searches, Settings,
 * Help and Log out. It follows the usual menu button pattern: Arrow keys move, Home and End jump, Escape closes and
 * gives the focus back to the avatar, Tab leaves, and a click anywhere else closes it.
 */
export function AccountMenu({ lang, viewer }: { lang: string; viewer: Viewer }) {
  const { t } = useTranslation();
  const { logOut, busy } = useLogOut(lang);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const items = useCallback(
    () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
    [],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: closing when the page changes is the point
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
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
        aria-label={t("web.nav.account")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-pressed text-body-sm font-bold text-primary"
      >
        {viewer.avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: a small avatar, no image optimisation on purpose
          <img src={viewer.avatarUrl} alt="" width={40} height={40} className="h-full w-full object-cover" />
        ) : (
          (viewer.username ?? viewer.name).slice(0, 1).toUpperCase()
        )}
      </button>
      {open ? (
        <div
          ref={menu}
          role="menu"
          onKeyDown={onKeyDown}
          aria-label={t("web.nav.account")}
          className="absolute end-0 top-full z-50 mt-sm w-[240px] rounded-window border border-border bg-background p-sm"
        >
          {ACCOUNT_LINKS.map(({ key, path, icon: Icon }) => (
            <Link key={key} href={`/${lang}${path}`} role="menuitem" tabIndex={-1} className={itemClass}>
              <Icon size={18} aria-hidden />
              {t(`web.auth.menu.${key}`)}
            </Link>
          ))}
          <hr className="my-xs border-border-subtle" />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={busy}
            onClick={() => void logOut()}
            className={itemClass}
          >
            <LogOut size={18} aria-hidden />
            {t("web.auth.menu.logOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
