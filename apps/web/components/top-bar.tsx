import { Camera, LayoutGrid, Search } from "lucide-react";
import { getT, type Lang } from "@/lib/i18n";
import { LanguageSwitch } from "./language-switch";

/** The laptop top bar of D-030. The buttons do nothing yet, the pages they open come in later steps. */
export function TopBar({ lang }: { lang: Lang }) {
  const t = getT(lang);
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <nav
        aria-label={t("web.nav.mainNavigation")}
        className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-md px-lg py-md md:px-xl"
      >
        <span className="text-[22px] font-extrabold tracking-tight text-primary">Vinty</span>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-sm rounded-control px-md text-body-sm font-semibold text-text-1 hover:bg-pressed"
        >
          <LayoutGrid size={16} aria-hidden />
          {t("tabs.browse")}
        </button>
        <div className="order-last flex h-10 w-full items-center gap-sm rounded-bar border border-border bg-surface px-lg md:order-none md:max-w-[560px] md:flex-1">
          <Search size={17} className="shrink-0 text-text-3" aria-hidden />
          <input
            type="search"
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            className="min-w-0 flex-1 bg-transparent text-body-sm text-text-1 outline-none placeholder:text-text-3"
          />
        </div>
        <div className="ms-auto">
          <LanguageSwitch
            lang={lang}
            label={t("web.nav.otherLanguage")}
            title={t("web.nav.switchLanguage")}
          />
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-control px-md text-body-sm font-semibold text-text-1 hover:bg-pressed"
        >
          {t("welcome.logIn")}
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-control border border-primary px-md text-body-sm font-semibold text-primary hover:bg-accent-tint"
        >
          {t("welcome.signUp")}
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-sm rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90"
        >
          <Camera size={16} aria-hidden />
          {t("tabs.sell")}
        </button>
      </nav>
    </header>
  );
}
