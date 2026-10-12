import { DevSettings, I18nManager, Platform } from "react-native";
import { isRtlLanguage } from "@/i18n";

/**
 * Right-to-left layout with Expo.
 *
 * Layout direction is decided by the native layer when the app starts, so changing it while the app
 * runs needs a restart. Two cases:
 * 1. The device is set to Hebrew and "he" is listed in the expo-localization plugin's supportedLocales
 *    (app.json). The OS then starts the app in RTL on its own. Nothing to do here.
 * 2. The user picks a language inside the app that differs from the device language. We call
 *    I18nManager.allowRTL and forceRTL, then restart the app. In development DevSettings.reload()
 *    does the restart. A production build needs expo-updates (Updates.reloadAsync), which is not
 *    installed yet. Add it when the in-app language picker ships.
 *
 * Expo Go forgets forced RTL when you reopen it, so test real RTL with a development build.
 * Style rule: only logical styles (ps-, pe-, ms-, me-, start-, end-, text-start), never left or right.
 */
export function ensureLayoutDirection(language: string) {
  if (Platform.OS === "web") return;
  const wantRtl = isRtlLanguage(language);
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== wantRtl) {
    I18nManager.forceRTL(wantRtl);
    if (__DEV__) DevSettings.reload();
  }
}
