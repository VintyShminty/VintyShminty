import { create } from "zustand";
import i18n, { type Language } from "@/i18n";
import { ensureLayoutDirection } from "@/lib/rtl";

// Small app state lives here. Server data goes through React Query, not this store.
type AppState = {
  language: Language;
  setLanguage: (language: Language) => void;
};

export const useAppStore = create<AppState>((set) => ({
  language: i18n.language as Language,
  setLanguage: (language) => {
    void i18n.changeLanguage(language);
    set({ language });
    ensureLayoutDirection(language);
  },
}));
