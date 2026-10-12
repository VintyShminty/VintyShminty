import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/app-store";
import { authClient } from "@/lib/auth-client";
import { useBiometricSupport } from "@/lib/biometrics";
import { isFaceIdEnabled, wasFaceIdOffered } from "@/lib/lock-store";
import { meQuery } from "@/lib/queries";
import { readPref, writePref } from "@/lib/secure-prefs";
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
    if (offered.current || !userId || !me || !support?.available) return;
    if (isFaceIdEnabled(userId) || wasFaceIdOffered(userId)) return;
    offered.current = true;
    router.push("/face-id-offer");
  }, [userId, me, support, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="face-id-offer" options={{ presentation: "modal" }} />
    </Stack>
  );
}
