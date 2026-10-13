import { Stack } from "expo-router";
import { useMemo } from "react";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarClearance } from "@/lib/tab-bar";
import { colors } from "@/theme";

/**
 * The stack every tab has for itself, so pages opened from a tab push inside that tab (D-017).
 * The floating tab bar (D-019) sits over the screens instead of pushing them up, so the bottom safe area
 * inside a tab is the room the bar takes. Everything that already reads the insets (Screen, lists, sticky
 * footers) then leaves that room by itself, and no screen has to know about the bar.
 */
export function TabStack() {
  const insets = useSafeAreaInsets();
  const clearance = useTabBarClearance();
  const inside = useMemo(() => ({ ...insets, bottom: clearance }), [insets, clearance]);
  return (
    <SafeAreaInsetsContext.Provider value={inside}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </SafeAreaInsetsContext.Provider>
  );
}
