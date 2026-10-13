import { Stack } from "expo-router";
import { colors } from "@/theme";

/** The Browse tab. Category panels push in from the trailing edge with the tab bar still showing (D-009). */
export default function BrowseLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="category" />
      <Stack.Screen name="results" />
    </Stack>
  );
}
