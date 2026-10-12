import { Stack } from "expo-router";
import { colors } from "@/theme";

// Logged out people always start on the welcome screen.
export const unstable_settings = { anchor: "welcome" };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
