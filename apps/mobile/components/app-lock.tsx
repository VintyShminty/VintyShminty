import { Lock, ScanFace } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { type BiometricKind, promptBiometric } from "@/lib/biometrics";
import { useLockStore } from "@/lib/lock-store";

/**
 * Covers the whole app until Face ID succeeds. It asks by itself when it appears and when the app comes
 * back from the background. "Log in with password" is the way out if Face ID does not work: it signs out,
 * and logging in again is the password check.
 */
function AppLock({ kind, onUsePassword }: { kind: BiometricKind; onUsePassword: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const unlock = useLockStore((s) => s.unlock);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);
  const method = t(`biometric.${kind}`);

  const attempt = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const result = await promptBiometric(t("lock.prompt", { method }), t("common.cancel"));
    busyRef.current = false;
    setBusy(false);
    if (result.success) unlock();
    else setFailed(true);
  }, [t, method, unlock]);

  useEffect(() => {
    void attempt();
    // The system sheet itself makes the app "inactive", so only a real trip to the background asks again.
    let wasBackground = false;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") wasBackground = true;
      if (state === "active" && wasBackground) {
        wasBackground = false;
        void attempt();
      }
    });
    return () => sub.remove();
  }, [attempt]);

  return (
    <View
      className="absolute inset-0 z-50 items-center bg-background px-lg"
      style={{ paddingTop: insets.top + 96, paddingBottom: insets.bottom + 24 }}
      accessibilityViewIsModal
    >
      <Text weight={800} className="text-primary" style={{ fontSize: 28, letterSpacing: -1 }}>
        Vinty
      </Text>
      <View className="mt-2xl h-20 w-20 items-center justify-center rounded-full bg-accent-tint">
        <Icon as={Lock} size={32} className="text-primary" />
      </View>
      <Text variant="heading" className="mt-xl text-center">
        {t("lock.title")}
      </Text>
      <Text variant="subtitle" className="mt-sm text-center">
        {failed ? t("lock.failed", { method }) : t("lock.subtitle", { method })}
      </Text>
      <View className="mt-auto w-full gap-md">
        <Button size="lg" onPress={() => void attempt()} loading={busy}>
          {!busy ? <Icon as={ScanFace} size={20} className="text-primary-foreground" /> : null}
          <Text>{t("lock.unlock", { method })}</Text>
        </Button>
        <Button size="lg" variant="ghost" onPress={onUsePassword}>
          <Text>{t("lock.usePassword")}</Text>
        </Button>
      </View>
    </View>
  );
}

export { AppLock };
