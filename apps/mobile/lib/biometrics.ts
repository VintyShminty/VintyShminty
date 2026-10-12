import Constants, { ExecutionEnvironment } from "expo-constants";
import * as LocalAuthentication from "expo-local-authentication";
import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import i18n from "@/i18n";

export type BiometricKind = "faceId" | "touchId" | "generic";

export type BiometricSupport = { available: boolean; kind: BiometricKind };

/** Does this phone have Face ID or Touch ID set up? Resolves once, the answer rarely changes. */
export async function checkBiometricSupport(): Promise<BiometricSupport> {
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const kind: BiometricKind = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
      ? "faceId"
      : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ? "touchId"
        : "generic";
    return { available: hasHardware && enrolled, kind };
  } catch {
    return { available: false, kind: "generic" };
  }
}

export function useBiometricSupport(): BiometricSupport | null {
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  useEffect(() => {
    let alive = true;
    void checkBiometricSupport().then((s) => alive && setSupport(s));
    return () => {
      alive = false;
    };
  }, []);
  return support;
}

export type BiometricResult = { success: boolean; error?: string };

/**
 * Expo Go on iOS cannot show the real Face ID sheet (Apple needs a usage description in the app itself, and Expo Go
 * has none). In development inside Expo Go we ask with a plain dialog instead, so the whole flow can still be tried.
 * A development build or the App Store build uses the real thing.
 */
const isExpoGoOnIos =
  __DEV__ && Platform.OS === "ios" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function simulatedPrompt(promptMessage: string): Promise<BiometricResult> {
  return new Promise((resolve) => {
    Alert.alert(promptMessage, i18n.t("dev.fakeBiometricBody"), [
      {
        text: i18n.t("dev.fakeBiometricFail"),
        style: "cancel",
        onPress: () => resolve({ success: false, error: "simulated" }),
      },
      { text: i18n.t("dev.fakeBiometricPass"), onPress: () => resolve({ success: true }) },
    ]);
  });
}

/** Shows the system Face ID sheet. The password fallback is our own button, so the system one is turned off. */
export async function promptBiometric(promptMessage: string, cancelLabel: string): Promise<BiometricResult> {
  if (isExpoGoOnIos) return simulatedPrompt(promptMessage);
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      fallbackLabel: "",
      disableDeviceFallback: true,
    });
    return result.success ? { success: true } : { success: false, error: result.error };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
