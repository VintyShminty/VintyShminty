import { useQuery } from "@tanstack/react-query";
import { Tabs, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { FloatingTabBar } from "@/components/navigation/floating-tab-bar";
import { authClient } from "@/lib/auth-client";
import { unreadQuery } from "@/lib/messaging-queries";
import { colors } from "@/theme";

/** The five tabs behind the floating bar (D-019). The bar itself is `FloatingTabBar`. */
export default function TabsLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  // The count pill on the Inbox tab: chats with something new plus unread notifications.
  const { data: session } = authClient.useSession();
  const { data: unread } = useQuery({ ...unreadQuery(), enabled: Boolean(session) });
  const unreadTotal = (unread?.messages ?? 0) + (unread?.notifications ?? 0);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="(home)" options={{ title: t("tabs.home") }} />
      <Tabs.Screen name="(shop)" options={{ title: t("tabs.browse") }} />
      {/* Sell is a launcher: it opens the full-screen sell form over the tabs (spec, Sell form). */}
      <Tabs.Screen
        name="sell"
        options={{ title: t("tabs.sell") }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push("/sell-form");
          },
        }}
      />
      <Tabs.Screen
        name="(inbox)"
        options={{
          title: t("tabs.inbox"),
          tabBarBadge: unreadTotal > 0 ? (unreadTotal > 99 ? "99+" : unreadTotal) : undefined,
        }}
      />
      <Tabs.Screen name="(profile)" options={{ title: t("tabs.profile") }} />
      <Tabs.Screen name="(dev)/gallery" options={{ href: null }} />
    </Tabs>
  );
}
