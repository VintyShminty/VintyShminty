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
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CaptchaHost } from "@/components/captcha-host";
import { authClient } from "@/lib/auth-client";
import { useAppFonts } from "@/lib/fonts";
import { queryClient } from "@/lib/query-client";
import { ensureNativeLtr, layoutDirection } from "@/lib/rtl";
import { Warmup } from "@/lib/warmup";
import { colors } from "@/theme";

void SplashScreen.preventAutoHideAsync();

// A known harmless React Native warning. In development its banner covers the bottom of the screen (tab bar, buttons).
LogBox.ignoreLogs(["Sending `onAnimatedValueUpdate` with no listeners registered"]);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const { i18n } = useTranslation();
  const { data: session, isPending } = authClient.useSession();
  const signedIn = Boolean(session);

  // The phone's own direction stays left to right. The app sets the direction below (D-018).
  useEffect(() => {
    ensureNativeLtr();
  }, []);
  const direction = layoutDirection(i18n.language);

  // Keep the splash screen up until the fonts are ready and we know whether someone is logged in,
  // so the first thing on screen is the right screen.
  // When the phone already holds a saved, unexpired session, Better Auth puts it in `session` at once and only
  // checks with the server afterwards. So a known person does not wait for the network: if the server later says
  // the session is gone, `session` turns empty and the app moves to the login screens by itself.
  const sessionKnown = !isPending || Boolean(session);
  const ready = (fontsLoaded || Boolean(fontError)) && sessionKnown;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, direction }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Warmup />
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
            <PortalHost />
            {/* The hidden bot check page (lib/captcha.ts). Last, so its card covers the log in screens when it shows. */}
            <CaptchaHost />
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
