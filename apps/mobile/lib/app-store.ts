import { create } from "zustand";
import i18n, { LANGUAGE_PREF_KEY, type Language } from "@/i18n";
import { ensureLayoutDirection } from "@/lib/rtl";
import { writePref } from "@/lib/secure-prefs";

// Small app state lives here. Server data goes through React Query, not this store.
type AppState = {
  language: Language;
  setLanguage: (language: Language) => void;
};

export const useAppStore = create<AppState>((set) => ({
  language: i18n.language as Language,
  setLanguage: (language) => {
    writePref(LANGUAGE_PREF_KEY, language);
    void i18n.changeLanguage(language);
    set({ language });
    ensureLayoutDirection(language);
  },
}));
