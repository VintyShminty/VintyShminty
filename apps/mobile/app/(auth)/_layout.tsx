import { Stack } from "expo-router";
import { colors } from "@/theme";

// Logged out people always start on the welcome screen.
export const unstable_settings = { anchor: "welcome" };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      {/* Log in and sign up slide up from the bottom over the welcome photo and swipe down to close (D-026). */}
      <Stack.Screen
        name="log-in"
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="sign-up"
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
    </Stack>
  );
}
