import "../global.css";
import "@/i18n";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import type { LucideIcon } from "lucide-react-native";
import { House, LayoutGrid, MessageCircle, PlusCircle, User } from "lucide-react-native";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { ColorValue } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppFonts } from "@/lib/fonts";
import { queryClient } from "@/lib/query-client";
import { ensureLayoutDirection } from "@/lib/rtl";
import { colors } from "@/theme";

void SplashScreen.preventAutoHideAsync();

function tabIcon(Icon: LucideIcon) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Icon color={color as string} size={size} strokeWidth={1.75} />
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    ensureLayoutDirection(i18n.language);
  }, [i18n.language]);

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const labelFamily = i18n.language === "he" ? "Heebo-600" : "Aileron-600";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <BottomSheetModalProvider>
            <StatusBar style="dark" />
            <Tabs
              screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.text3,
                tabBarStyle: {
                  backgroundColor: colors.background,
                  borderTopColor: colors.borderSubtle,
                  borderTopWidth: 1,
                },
                tabBarLabelStyle: {
                  fontFamily: labelFamily,
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                },
                sceneStyle: { backgroundColor: colors.background },
              }}
            >
              <Tabs.Screen name="index" options={{ title: t("tabs.home"), tabBarIcon: tabIcon(House) }} />
              <Tabs.Screen
                name="browse"
                options={{ title: t("tabs.browse"), tabBarIcon: tabIcon(LayoutGrid) }}
              />
              <Tabs.Screen name="sell" options={{ title: t("tabs.sell"), tabBarIcon: tabIcon(PlusCircle) }} />
              <Tabs.Screen
                name="inbox"
                options={{ title: t("tabs.inbox"), tabBarIcon: tabIcon(MessageCircle) }}
              />
              <Tabs.Screen name="profile" options={{ title: t("tabs.profile"), tabBarIcon: tabIcon(User) }} />
              <Tabs.Screen name="(dev)/gallery" options={{ href: null }} />
            </Tabs>
            <PortalHost />
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
