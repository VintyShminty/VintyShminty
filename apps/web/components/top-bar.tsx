import { Bookmark } from "lucide-react";
import Link from "next/link";
import { AccountMenu } from "@/components/auth/account-menu";
import { BrowsePanel } from "@/components/browse-panel";
import { BrowseTiles } from "@/components/browse-tiles";
import { BellLink, InboxLink } from "@/components/inbox/inbox-link";
import { MobileDrawer } from "@/components/mobile-drawer";
import { SearchField } from "@/components/search-field";
import { SellButton } from "@/components/sell-button";
import { getT, type Lang } from "@/lib/i18n";
import { loginHref, signUpHref } from "@/lib/login-links";
import type { Viewer } from "@/lib/viewer";

const iconLink =
  "inline-flex h-10 w-10 items-center justify-center rounded-control text-text-2 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

/**
 * The top bar of D-030, in the language layout so every page has it. On a laptop: the wordmark, one Browse button that
 * opens the photo tiles, the search field (a plain form that opens `/[lang]/search?q=`), then Log in and Sign up, or
 * inbox, hearts and your photo when logged in, and Sell. Below `md` it shrinks to the wordmark, the search field and a
 * menu button (the drawer holds Sell, the tiles and the links).
 */
export function TopBar({ lang, viewer }: { lang: Lang; viewer: Viewer | null }) {
  const t = getT(lang);
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/95 backdrop-blur">
      <nav
        aria-label={t("web.nav.mainNavigation")}
        className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-md px-lg py-md md:px-xl lg:px-[48px] xl:px-[80px]"
      >
        <Link
          href={`/${lang}`}
          aria-label={t("web.nav.homeLink")}
          className="text-[23px] font-bold tracking-tight text-text-1"
        >
          Yadii
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
        <search className="relative order-last flex h-10 w-full items-center gap-sm rounded-full border border-border bg-background focus-within:border-primary md:order-none md:max-w-[560px] md:flex-1">
          <SearchField lang={lang} />
        </search>
        <div className="ms-auto hidden items-center gap-sm md:flex">
          {viewer ? (
            <>
              <BellLink lang={lang} className={iconLink} />
              <InboxLink lang={lang} className={iconLink} />
              <Link href={`/${lang}/favourites`} aria-label={t("web.nav.favourites")} className={iconLink}>
                <Bookmark size={20} aria-hidden />
              </Link>
              <AccountMenu lang={lang} viewer={viewer} />
            </>
          ) : (
            <>
              <Link
                href={loginHref(lang)}
                className="inline-flex h-[34px] items-center rounded-[8px] px-sm text-body-sm font-semibold text-text-1 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {t("welcome.logIn")}
              </Link>
              <Link
                href={signUpHref(lang)}
                className="inline-flex h-[34px] items-center rounded-full border border-border px-[16px] text-body-sm font-semibold text-text-1 hover:border-text-1"
              >
                {t("welcome.signUp")}
              </Link>
            </>
          )}
          <SellButton lang={lang} className="ms-sm" />
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
