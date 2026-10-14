"use client";

import { Inbox, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLogOut } from "@/components/auth/log-out";
import { LanguageSwitch } from "@/components/language-switch";
import { SellButton } from "@/components/sell-button";
import { useViewer } from "@/components/site-context";
import { ACCOUNT_LINKS } from "@/lib/account-links";
import type { Lang } from "@/lib/i18n";
import { loginHref, signUpHref } from "@/lib/login-links";

/**
 * The phone browser menu (D-030): a menu button that opens a drawer from the end side with Sell, the Browse tiles
 * (passed in as `children` from the server page) and links (Log in and Sign up when logged out). The drawer is the
 * browser's modal dialog, so focus stays inside, Escape closes it, and a tap on the dim area or on any link closes it.
 * Shown below the `md` width only, laptops use the full top bar.
 */
export function MobileDrawer({ lang, children }: { lang: Lang; children: ReactNode }) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const { logOut, busy } = useLogOut(lang);

  // biome-ignore lint/correctness/useExhaustiveDependencies: closing when the page changes is the point
  useEffect(() => dialog.current?.close(), [pathname]);

  const linkClass =
    "flex h-11 items-center gap-md rounded-control px-md text-body-sm font-semibold text-text-1 hover:bg-pressed";
  return (
    <>
      <button
        type="button"
        aria-label={t("web.nav.menu")}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex h-10 w-10 items-center justify-center rounded-control text-text-1 hover:bg-pressed md:hidden"
      >
        <Menu size={22} aria-hidden />
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the click only closes on the dim area or a link, Escape already closes the dialog natively */}
      <dialog
        ref={dialog}
        aria-label={t("web.nav.menu")}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target === dialog.current || target.closest("a")) dialog.current?.close();
        }}
        className="me-0 ms-auto mb-0 mt-0 h-dvh max-h-dvh w-[min(88vw,360px)] overflow-y-auto border-0 bg-background p-lg text-text-1 backdrop:bg-backdrop md:hidden"
      >
        <div className="flex items-center justify-between pb-md">
          <span className="text-[22px] font-extrabold tracking-tight text-primary">Vinty</span>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => dialog.current?.close()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-control hover:bg-pressed"
          >
            <X size={22} aria-hidden />
          </button>
        </div>
        <SellButton lang={lang} className="w-full" />
        <nav aria-label={t("web.nav.menu")} className="mt-md flex flex-col">
          {viewer ? (
            <>
              <Link href={`/${lang}/inbox`} className={linkClass}>
                <Inbox size={18} aria-hidden />
                {t("tabs.inbox")}
              </Link>
              {ACCOUNT_LINKS.map(({ key, path, icon: Icon }) => (
                <Link key={key} href={`/${lang}${path}`} className={linkClass}>
                  <Icon size={18} aria-hidden />
                  {t(`web.auth.menu.${key}`)}
                </Link>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  dialog.current?.close();
                  void logOut();
                }}
                className={`${linkClass} w-full text-start`}
              >
                <LogOut size={18} aria-hidden />
                {t("web.auth.menu.logOut")}
              </button>
            </>
          ) : (
            <>
              <Link href={loginHref(lang)} className={linkClass}>
                {t("welcome.logIn")}
              </Link>
              <Link href={signUpHref(lang)} className={linkClass}>
                {t("welcome.signUp")}
              </Link>
            </>
          )}
        </nav>
        <h2 className="mb-sm mt-lg text-section-label font-semibold uppercase text-text-3">
          {t("web.nav.browseTitle")}
        </h2>
        {children}
        <div className="mt-lg border-t border-border pt-md">
          <LanguageSwitch
            lang={lang}
            label={t("web.nav.otherLanguage")}
            title={t("web.nav.switchLanguage")}
          />
        </div>
      </dialog>
    </>
  );
}
