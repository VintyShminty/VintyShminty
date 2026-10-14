import { Heart, Inbox } from "lucide-react";
import Link from "next/link";
import { AccountMenu } from "@/components/auth/account-menu";
import { BrowsePanel } from "@/components/browse-panel";
import { BrowseTiles } from "@/components/browse-tiles";
import { LanguageSwitch } from "@/components/language-switch";
import { MobileDrawer } from "@/components/mobile-drawer";
import { SearchField } from "@/components/search-field";
import { SellButton } from "@/components/sell-button";
import { getT, type Lang } from "@/lib/i18n";
import { loginHref, signUpHref } from "@/lib/login-links";
import type { Viewer } from "@/lib/viewer";

const iconLink =
  "inline-flex h-10 w-10 items-center justify-center rounded-control text-text-2 hover:bg-pressed";

/**
 * The top bar of D-030, in the language layout so every page has it. On a laptop: the wordmark, one Browse button that
 * opens the photo tiles, the search field (a plain form that opens `/[lang]/search?q=`), then Log in and Sign up, or
 * inbox, hearts and your photo when logged in, and Sell. Below `md` it shrinks to the wordmark, the search field and a
 * menu button (the drawer holds Sell, the tiles and the links).
 */
export function TopBar({ lang, viewer }: { lang: Lang; viewer: Viewer | null }) {
  const t = getT(lang);
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <nav
        aria-label={t("web.nav.mainNavigation")}
        className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-md px-lg py-md md:px-xl"
      >
        <Link
          href={`/${lang}`}
          aria-label={t("web.nav.homeLink")}
          className="text-[22px] font-extrabold tracking-tight text-primary"
        >
          Vinty
        </Link>
        <div className="hidden md:block">
          <BrowsePanel>
            <BrowseTiles
              lang={lang}
              withMore
              className="grid-cols-4"
              tileClassName="h-[120px]"
              sizes="170px"
            />
          </BrowsePanel>
        </div>
        <search className="relative order-last flex h-10 w-full items-center gap-sm rounded-bar border border-border bg-surface px-lg focus-within:border-primary md:order-none md:max-w-[560px] md:flex-1">
          <SearchField lang={lang} />
        </search>
        <div className="ms-auto hidden items-center gap-sm md:flex">
          <LanguageSwitch
            lang={lang}
            label={t("web.nav.otherLanguage")}
            title={t("web.nav.switchLanguage")}
          />
          {viewer ? (
            <>
              <Link href={`/${lang}/inbox`} aria-label={t("tabs.inbox")} className={iconLink}>
                <Inbox size={20} aria-hidden />
              </Link>
              <Link href={`/${lang}/favourites`} aria-label={t("web.nav.favourites")} className={iconLink}>
                <Heart size={20} aria-hidden />
              </Link>
              <AccountMenu lang={lang} viewer={viewer} />
            </>
          ) : (
            <>
              <Link
                href={loginHref(lang)}
                className="inline-flex h-10 items-center rounded-control px-md text-body-sm font-semibold text-text-1 hover:bg-pressed"
              >
                {t("welcome.logIn")}
              </Link>
              <Link
                href={signUpHref(lang)}
                className="inline-flex h-10 items-center rounded-control border border-primary px-md text-body-sm font-semibold text-primary hover:bg-accent-tint"
              >
                {t("welcome.signUp")}
              </Link>
            </>
          )}
          <SellButton lang={lang} />
        </div>
        <div className="ms-auto md:hidden">
          <MobileDrawer lang={lang}>
            <BrowseTiles
              lang={lang}
              withMore
              className="grid-cols-2"
              tileClassName="h-[96px]"
              sizes="170px"
            />
          </MobileDrawer>
        </div>
      </nav>
    </header>
  );
}
