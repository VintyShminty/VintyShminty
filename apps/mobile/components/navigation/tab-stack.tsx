import { Stack } from "expo-router";
import { useMemo } from "react";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme";

/**
 * The stack every tab has for itself, so pages opened from a tab push inside that tab (D-017).
 * The tab bar already clears the home indicator, so inside it the bottom safe area is zero. Screens
 * that read the insets (Screen, lists, footers) then do not add the space twice.
 */
export function TabStack() {
  const insets = useSafeAreaInsets();
  const inside = useMemo(() => ({ ...insets, bottom: 0 }), [insets]);
  return (
    <SafeAreaInsetsContext.Provider value={inside}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </SafeAreaInsetsContext.Provider>
  );
}
