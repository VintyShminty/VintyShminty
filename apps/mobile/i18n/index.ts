import en from "@vinty/locales/en.json";
import he from "@vinty/locales/he.json";
import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { readPref } from "@/lib/secure-prefs";

export const SUPPORTED_LANGUAGES = ["en", "he"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export function isRtlLanguage(language: string) {
  return language === "he";
}

export const LANGUAGE_PREF_KEY = "vinty.language";

const isSupported = (code: string | null | undefined): code is Language =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(code ?? "");

/** The language the person picked in the app, else the device language if we support it, else English. */
export function detectLanguage(): Language {
  const picked = readPref(LANGUAGE_PREF_KEY);
  if (isSupported(picked)) return picked;
  const code = getLocales()[0]?.languageCode;
  return isSupported(code) ? code : "en";
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, he: { translation: he } },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
