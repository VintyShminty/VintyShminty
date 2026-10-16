import en from "@vinty/locales/en.json";
import he from "@vinty/locales/he.json";
import { createInstance, type i18n as I18n } from "i18next";

export const LANGUAGES = ["en", "he"] as const;
export type Lang = (typeof LANGUAGES)[number];
export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "lang";

export const isLang = (value: string | null | undefined): value is Lang =>
  (LANGUAGES as readonly string[]).includes(value ?? "");

export const dirOf = (lang: Lang) => (lang === "he" ? "rtl" : "ltr");
export const otherLang = (lang: Lang): Lang => (lang === "he" ? "en" : "he");

const locales = { en, he } as const;

/** The parts of the wording that browser components may need. The page sends only these to the browser. */
const CLIENT_SECTIONS = [
  "web",
  "admin",
  "search",
  "filters",
  "welcome",
  "logIn",
  "signUp",
  "social",
  "forgot",
  "fields",
  "validation",
  "onboarding",
  "home",
  "tabs",
  "sell",
  "inbox",
  "chat",
  "offer",
  "orders",
  "checkout",
  "address",
  "review",
  "bundle",
  "bundleSettings",
  "balance",
  "report",
  "countries",
  "listing",
  "item",
  "profile",
  "time",
  "browse",
  "errors",
  "settings",
  "account",
  "security",
  "privacy",
  "shopping",
  "away",
  "editProfile",
  "savedSearches",
  "favourites",
  "buzz",
  "notifications",
  "languages",
  "common",
  "protectionName",
] as const;

type Resources = Record<string, unknown>;

function build(lang: Lang, resources: Resources): I18n {
  const instance = createInstance();
  void instance.init({
    resources: { [lang]: { translation: resources } },
    lng: lang,
    fallbackLng: false,
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}

const cache = new Map<Lang, I18n>();

/** For server components: `const t = getT(lang)`. */
export function getT(lang: Lang) {
  let instance = cache.get(lang);
  if (!instance) {
    instance = build(lang, locales[lang]);
    cache.set(lang, instance);
  }
  return instance.getFixedT(lang);
}

/** The slice of wording sent to the browser for client components. */
export function clientResources(lang: Lang): Resources {
  const all = locales[lang] as Resources;
  return Object.fromEntries(CLIENT_SECTIONS.map((key) => [key, all[key]]));
}

/** For the client provider. */
export const createClientI18n = build;

/** The same path in the other language: /en/browse becomes /he/browse. */
export function switchPath(pathname: string, to: Lang) {
  const parts = pathname.split("/");
  if (isLang(parts[1])) parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join("/") || `/${to}`;
}
