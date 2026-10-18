import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform } from "react-native";
import { type BiometricKind, useBiometricSupport } from "@/lib/biometrics";
import { forgetLogin, saveLogin, useSavedLogin } from "@/lib/saved-login";

/** Reading and changing "Log in with Face ID" for the person logged in on this phone. */
export function useFaceId(user: { id: string; email: string } | undefined) {
  const { t } = useTranslation();
  const support = useBiometricSupport();
  const saved = useSavedLogin();
  const enabled = Boolean(user) && saved?.userId === user?.id;

  /** The name to show: Face ID, Touch ID or "biometrics" on phones with something else. */
  const kind: BiometricKind = support?.kind ?? "generic";
  const method = t(`biometric.${kind}`);

  /** Save this password behind Face ID. Proves Face ID works first, so nobody saves one they cannot open. */
  const save = useCallback(
    (password: string) =>
      user
        ? saveLogin(
            { email: user.email, password, userId: user.id },
            t("lock.confirmEnable", { method }),
            t("common.cancel"),
          )
        : Promise.resolve(false),
    [user, method, t],
  );

  /**
   * Turning it on from Settings. The password is not on the phone, so we ask for it (an iOS text prompt). If it is
   * mistyped, the first Face ID login fails, forgets it and shows the password form. Null means they cancelled.
   */
  const enable = useCallback(
    () =>
      new Promise<boolean | null>((resolve) => {
        Alert.prompt(
          t("faceId.passwordTitle"),
          t("faceId.passwordBody", { method }),
          [
            { text: t("common.cancel"), style: "cancel", onPress: () => resolve(null) },
            {
              text: t("faceId.turnOn", { method }),
              onPress: (password?: string) => {
                if (!password) return resolve(null);
                void save(password).then(resolve);
              },
            },
          ],
          "secure-text",
        );
      }),
    [method, save, t],
  );

  return {
    available: support?.available ?? false,
    loading: support === null,
    /** Turning it on from Settings needs the iOS password prompt. Android only gets the offer after a login. */
    canEnableHere: Platform.OS === "ios",
    kind,
    enabled,
    enable,
    save,
    disable: forgetLogin,
  };
}
