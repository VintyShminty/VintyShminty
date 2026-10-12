import "../global.css";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function tab(title: string, icon: IconName) {
  return {
    title,
    tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
      <Ionicons name={icon} size={size} color={color as string} />
    ),
  };
}

export default function RootLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#0d9488" }}>
      <Tabs.Screen name="index" options={tab("Home", "home-outline")} />
      <Tabs.Screen name="browse" options={tab("Browse", "search-outline")} />
      <Tabs.Screen name="sell" options={tab("Sell", "add-circle-outline")} />
      <Tabs.Screen name="inbox" options={tab("Inbox", "chatbubble-outline")} />
      <Tabs.Screen name="profile" options={tab("Profile", "person-outline")} />
    </Tabs>
  );
}
