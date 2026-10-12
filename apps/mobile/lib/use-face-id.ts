import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { type BiometricKind, promptBiometric, useBiometricSupport } from "@/lib/biometrics";
import { isFaceIdEnabled, useLockStore } from "@/lib/lock-store";

/** Reading and changing the Face ID switch for one person on this phone. */
export function useFaceId(userId: string | undefined) {
  const { t } = useTranslation();
  const support = useBiometricSupport();
  const version = useLockStore((s) => s.version);
  const setFaceIdEnabled = useLockStore((s) => s.setFaceIdEnabled);
  const enabled = userId ? isFaceIdEnabled(userId) : false;
  void version;

  /** The name to show: Face ID, Touch ID or "biometrics" on phones with something else. */
  const kind: BiometricKind = support?.kind ?? "generic";

  const enable = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    // Prove it works before turning it on, so nobody is locked out by a switch that cannot be answered.
    const result = await promptBiometric(
      t("lock.confirmEnable", { method: t(`biometric.${kind}`) }),
      t("common.cancel"),
    );
    if (result.success) setFaceIdEnabled(userId, true);
    else if (__DEV__) console.warn("Face ID could not be turned on:", result.error);
    return result.success;
  }, [userId, kind, t, setFaceIdEnabled]);

  const disable = useCallback(() => {
    if (userId) setFaceIdEnabled(userId, false);
  }, [userId, setFaceIdEnabled]);

  return {
    available: support?.available ?? false,
    loading: support === null,
    kind,
    enabled,
    enable,
    disable,
  };
}
