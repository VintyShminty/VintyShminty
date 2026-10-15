import { useTranslation } from "react-i18next";
import { DevSettings, I18nManager, Platform } from "react-native";
import { isRtlLanguage } from "@/i18n";
import { readPref, writePref } from "@/lib/secure-prefs";

/**
 * Right-to-left layout, controlled by the app (D-018).
 *
 * The phone's own layout direction is fixed when the app starts, so using it would need a restart to
 * switch language. Instead the native side always stays left to right and the app says the direction
 * out loud from the app language:
 * - app/_layout.tsx puts `direction: "rtl" | "ltr"` on the root view. Every row, margin and padding
 *   written with logical names (ps-, pe-, ms-, me-, start-, end-) follows it at once.
 * - app/_layout.tsx also wraps the navigation in expo-router's LocaleProvider, which tells React
 *   Navigation and react-native-screens which way pages push in and which screen edge swipes back.
 * - Anything that needs the direction in code (arrows, alignment) uses useIsRtl(), never
 *   I18nManager.isRTL, which is always false now.
 * - NativeWind's `rtl:` variant reads I18nManager too, so it never fires. Pick styles from the language.
 *
 * Style rule: only logical styles (ps-, pe-, ms-, me-, start-, end-), never left or right. Text and
 * Input set their text alignment from the language.
 */

/** True while the app language is written right to left. Re-renders the moment the language changes. */
export function useIsRtl() {
  const { i18n } = useTranslation();
  return isRtlLanguage(i18n.language);
}

/** The direction to give the root view and the navigation. */
export function layoutDirection(language: string) {
  return isRtlLanguage(language) ? "rtl" : "ltr";
}

/**
 * Keeps the phone's native direction left to right. Older builds forced it right to left for Hebrew and
 * the phone remembers that, so the first start after the update resets it and reloads once (development
 * only, a store build never had the old setting).
 */
export function ensureNativeLtr() {
  if (Platform.OS === "web") return;
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
  if (I18nManager.isRTL) {
    // Never reload twice in a row, so a stubborn setting cannot cause a loop.
    const marker = String(Math.floor(Date.now() / 15_000));
    if (readPref("vinty.rtl.restart") === marker) return;
    writePref("vinty.rtl.restart", marker);
    if (__DEV__) DevSettings.reload();
  }
}

const HEBREW = /[֐-׿]/;
const LATIN = /[A-Za-z]/;

/**
 * True when typed text should run right to left. The first letter decides (Hebrew or Latin), the way a
 * person reads it, so Hebrew typed into an English app sits on the right. No letters yet (empty, only
 * numbers or emoji) follows the app language, so placeholders and prices stay where they were.
 */
export function isRtlText(text: string | undefined, appIsRtl: boolean): boolean {
  for (const char of text ?? "") {
    if (HEBREW.test(char)) return true;
    if (LATIN.test(char)) return false;
  }
  return appIsRtl;
}

/** Alignment and writing direction for a text box, from what is typed in it (see isRtlText). */
export function inputDirectionStyle(text: string | undefined, appIsRtl: boolean) {
  const rtl = isRtlText(text, appIsRtl);
  return { textAlign: rtl ? "right" : "left", writingDirection: rtl ? "rtl" : "ltr" } as const;
}
