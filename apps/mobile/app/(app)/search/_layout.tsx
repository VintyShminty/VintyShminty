import { Stack } from "expo-router";
import { colors } from "@/theme";

/** The search task page. It covers the tab bar, like the sell form. */
export default function SearchLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
