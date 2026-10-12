import { Tabs, useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { House, LayoutGrid, MessageCircle, PlusCircle, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { ColorValue } from "react-native";
import { colors } from "@/theme";

function tabIcon(Icon: LucideIcon) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Icon color={color as string} size={size} strokeWidth={1.75} />
  );
}

export default function TabsLayout() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const labelFamily = i18n.language === "he" ? "Heebo-600" : "Aileron-600";

  return (
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
      <Tabs.Screen name="browse" options={{ title: t("tabs.browse"), tabBarIcon: tabIcon(LayoutGrid) }} />
      {/* Sell is a launcher: it opens the full-screen sell form over the tabs (spec, Sell form). */}
      <Tabs.Screen
        name="sell"
        options={{ title: t("tabs.sell"), tabBarIcon: tabIcon(PlusCircle) }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push("/sell-form");
          },
        }}
      />
      <Tabs.Screen name="inbox" options={{ title: t("tabs.inbox"), tabBarIcon: tabIcon(MessageCircle) }} />
      <Tabs.Screen name="profile" options={{ title: t("tabs.profile"), tabBarIcon: tabIcon(User) }} />
      <Tabs.Screen name="(dev)/gallery" options={{ href: null }} />
    </Tabs>
  );
}
