import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAppStore } from "@/lib/app-store";
import { authClient } from "@/lib/auth-client";
import { useBiometricSupport } from "@/lib/biometrics";
import { events } from "@/lib/events";
import { isFaceIdEnabled, useIsLocked, wasFaceIdOffered } from "@/lib/lock-store";
import { useOnboardingPending } from "@/lib/onboarding";
import { meQuery, settingsQuery } from "@/lib/queries";
import { readPref, writePref } from "@/lib/secure-prefs";
import { beforeSignOut } from "@/lib/sign-out-hooks";
import { useMessagingSession } from "@/lib/use-messaging-session";
import { colors } from "@/theme";

/** Everything you see once you are logged in. */
export default function AppLayout() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const sessionId = session?.session.id;
  const { data: me } = useQuery({ ...meQuery(), enabled: Boolean(userId) });
  const support = useBiometricSupport();
  const offered = useRef(false);
  useMessagingSession();
  const { data: settings } = useQuery({ ...settingsQuery(), enabled: Boolean(userId) });
  const onboarding = useOnboardingPending(userId);
  const onboardingShown = useRef(false);
  const locked = useIsLocked(userId);

  // The small "card seen" and "time on item" actions are collected only for a signed in person whose personalised
  // feed is on. They go out when the app goes to the background and just before sign out.
  const collecting = Boolean(userId) && settings?.personaliseFeed !== false;
  useEffect(() => {
    events.setEnabled(collecting);
    return () => events.setEnabled(false);
  }, [collecting]);
  useEffect(() => {
    const unhook = beforeSignOut(() => events.flush());
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") void events.flush();
    });
    return () => {
      unhook();
      sub.remove();
    };
  }, []);

  // Right after a new account is made: the two short questions, then Home.
  // The lock closes it (below), so it opens again once Face ID lets the person back in.
  useEffect(() => {
    if (locked) onboardingShown.current = false;
    if (!onboarding || locked || onboardingShown.current) return;
    onboardingShown.current = true;
    router.push("/onboarding");
  }, [onboarding, locked, router]);

  // Your language on the server wins right after you log in, so Hebrew stays Hebrew on a new phone.
  useEffect(() => {
    if (!me || !sessionId) return;
    const key = `vinty.langsync.${sessionId}`;
    if (readPref(key)) return;
    writePref(key, "1");
    const { language, setLanguage } = useAppStore.getState();
    if (me.locale !== language) setLanguage(me.locale);
  }, [me, sessionId]);

  // The first time after logging in, offer Face ID (once per person per phone).
  useEffect(() => {
    if (offered.current || onboarding || !userId || !me || !support?.available) return;
    if (isFaceIdEnabled(userId) || wasFaceIdOffered(userId)) return;
    offered.current = true;
    router.push("/face-id-offer");
  }, [userId, me, support, router, onboarding]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      {/* Native modals open above the whole app, so above the Face ID lock too. While the app is locked they are
          closed and cannot be opened, not even from a link like vinty://sell-form. */}
      <Stack.Protected guard={!locked}>
        <Stack.Screen
          name="onboarding"
          options={{ presentation: "fullScreenModal", gestureEnabled: false }}
        />
        <Stack.Screen name="face-id-offer" options={{ presentation: "modal" }} />
        <Stack.Screen name="sell-form" options={{ presentation: "fullScreenModal" }} />
      </Stack.Protected>
      <Stack.Screen name="filters" />
      <Stack.Screen name="conversation/[id]" />
      <Stack.Screen name="checkout/index" />
      <Stack.Screen name="checkout/address" />
      <Stack.Screen name="checkout/done" options={{ gestureEnabled: false }} />
      <Stack.Screen name="bundle/[sellerId]" />
    </Stack>
  );
}
