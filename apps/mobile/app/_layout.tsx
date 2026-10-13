import "../global.css";
import "@/i18n";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppState, LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppLock } from "@/components/app-lock";
import { authClient } from "@/lib/auth-client";
import { useBiometricSupport } from "@/lib/biometrics";
import { useAppFonts } from "@/lib/fonts";
import { useIsLocked, useLockStore } from "@/lib/lock-store";
import { queryClient } from "@/lib/query-client";
import { ensureNativeLtr, layoutDirection } from "@/lib/rtl";
import { colors } from "@/theme";

void SplashScreen.preventAutoHideAsync();

// A known harmless React Native warning. In development its banner covers the bottom of the screen (tab bar, buttons).
LogBox.ignoreLogs(["Sending `onAnimatedValueUpdate` with no listeners registered"]);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const { i18n } = useTranslation();
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;
  const signedIn = Boolean(session);
  const locked = useIsLocked(userId);
  const support = useBiometricSupport();

  // The phone's own direction stays left to right. The app sets the direction below (D-018).
  useEffect(() => {
    ensureNativeLtr();
  }, []);
  const direction = layoutDirection(i18n.language);

  // Keep the splash screen up until the fonts are ready and we know whether someone is logged in,
  // so the first thing on screen is the right screen.
  const ready = (fontsLoaded || Boolean(fontError)) && !isPending;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Coming back after a while asks for Face ID again.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") useLockStore.getState().noteBackground();
      else if (state === "active") useLockStore.getState().noteForeground(userId);
    });
    return () => sub.remove();
  }, [userId]);

  if (!ready) return null;

  const usePassword = async () => {
    await authClient.signOut();
    queryClient.clear();
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, direction }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <BottomSheetModalProvider>
            <StatusBar style="dark" />
            {/* The app, not the phone, decides the layout direction (the style on the root view above), so a language switch mirrors everything at once, sheets included (D-018). */}
            <View style={{ flex: 1 }}>
              <LocaleProvider direction={direction}>
                <Stack
                  screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
                >
                  <Stack.Protected guard={!signedIn}>
                    <Stack.Screen name="(auth)" />
                  </Stack.Protected>
                  <Stack.Protected guard={signedIn}>
                    <Stack.Screen name="(app)" />
                  </Stack.Protected>
                </Stack>
              </LocaleProvider>
            </View>
            {signedIn && locked ? (
              <AppLock kind={support?.kind ?? "generic"} onUsePassword={usePassword} />
            ) : null}
            <PortalHost />
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
