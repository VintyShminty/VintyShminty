import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { AuthMotionProvider } from "@/components/auth-motion";

// Logged out people always start on the welcome screen.
export const unstable_settings = { anchor: "welcome" };

const clear = { backgroundColor: "transparent" };
// The navigation theme paints every screen with a grey. Here it paints nothing, so the photo behind shows through.
const clearTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: "transparent" } };

/**
 * Welcome, log in and sign up are one surface (D-026): the photo lives behind the stack (AuthMotionProvider)
 * and the three screens are see-through, so tapping Log in or Sign up does not push a page. The welcome text
 * fades out while the form sheet rises, all driven by one motion value. Forgot password is the same kind of sheet with a back arrow, so going to it and back is a quiet swap in place.
 */
export default function AuthLayout() {
  return (
    <AuthMotionProvider>
      <ThemeProvider value={clearTheme}>
        <Stack screenOptions={{ headerShown: false, contentStyle: clear }}>
          {/* Welcome is listed first so it is the screen at the bottom of the pile. */}
          <Stack.Screen name="welcome" options={{ presentation: "transparentModal", animation: "none" }} />
          <Stack.Screen
            name="log-in"
            options={{ presentation: "transparentModal", animation: "none", gestureEnabled: false }}
          />
          <Stack.Screen
            name="sign-up"
            options={{ presentation: "transparentModal", animation: "none", gestureEnabled: false }}
          />
          <Stack.Screen
            name="forgot-password"
            options={{ presentation: "transparentModal", animation: "none", gestureEnabled: false }}
          />
        </Stack>
      </ThemeProvider>
    </AuthMotionProvider>
  );
}
