import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Alert, Platform } from "react-native";
import i18n from "@/i18n";
import { api } from "@/lib/api";
import { readPref, writePref } from "@/lib/secure-prefs";

// Push plumbing (Milestone 4). Real delivery needs Apple credentials that do not exist yet. Everything here is quiet
// on failure: a simulator has no push token, and not having one must never show an error or crash.

const TOKEN_KEY = "vinty.push.token";
const askedKey = (userId: string) => `vinty.push.asked.${userId}`;

// A push that arrives while the app is open shows as a banner, unless that chat is the one on screen
// (the server already holds those back, this is the second guard).
let openThread: string | null = null;
export function setOpenThread(id: string | null) {
  openThread = id;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { conversationId?: string } | undefined;
    const hidden = Boolean(data?.conversationId) && data?.conversationId === openThread;
    return {
      shouldShowBanner: !hidden,
      shouldShowList: !hidden,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});

/** Gets this phone's Expo push token and gives it to the server. Returns false when it could not (no error shown). */
async function registerToken(): Promise<boolean> {
  // A simulator never gets a token, and asking prints a developer warning that covers the bottom of the screen.
  if (!Device.isDevice) return false;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api("/v1/me/push-tokens", {
      method: "POST",
      body: {
        token,
        platform: Platform.OS === "android" ? "android" : "ios",
        locale: i18n.language === "he" ? "he" : "en",
      },
    });
    writePref(TOKEN_KEY, token);
    return true;
  } catch (err) {
    // No token on a simulator, or no network: try again next launch.
    if (__DEV__) console.log("Push token not registered:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** On every start of the app: if the person already allowed notifications, keep the server's token fresh. */
export async function refreshPushToken(): Promise<void> {
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    if (granted) await registerToken();
  } catch {
    // Nothing to do.
  }
}

/** Sign out: tell the server to forget this phone, so the previous person's messages stop arriving here. */
export async function forgetPushToken(): Promise<void> {
  const token = readPref(TOKEN_KEY);
  if (!token) return;
  try {
    await api(`/v1/me/push-tokens/${encodeURIComponent(token)}`, { method: "DELETE" });
  } catch {
    // Offline or already gone: the server also drops tokens that Apple says are dead.
  }
  writePref(TOKEN_KEY, null);
}

/**
 * Asks for notifications once, right after the person sent their first message (a moment when "tell me when they
 * reply" makes sense). A plain explanation first, then the system question. Saying no is remembered.
 */
export async function askForPushAfterFirstMessage(userId: string): Promise<void> {
  try {
    if (readPref(askedKey(userId))) return;
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      writePref(askedKey(userId), "1");
      await registerToken();
      return;
    }
    if (!current.canAskAgain) return;
    writePref(askedKey(userId), "1");
    Alert.alert(i18n.t("push.askTitle"), i18n.t("push.askBody"), [
      { text: i18n.t("push.notNow"), style: "cancel" },
      {
        text: i18n.t("push.allow"),
        onPress: () => {
          void (async () => {
            try {
              const result = await Notifications.requestPermissionsAsync();
              if (result.granted) await registerToken();
            } catch {
              // Nothing to do.
            }
          })();
        },
      },
    ]);
  } catch {
    // Push is a nice to have. Never disturb sending a message.
  }
}
