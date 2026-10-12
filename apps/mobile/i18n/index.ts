import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import he from "./locales/he.json";

export const SUPPORTED_LANGUAGES = ["en", "he"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export function isRtlLanguage(language: string) {
  return language === "he";
}

/** The device language if we support it, otherwise English. */
export function detectLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? "en";
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code) ? (code as Language) : "en";
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, he: { translation: he } },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
