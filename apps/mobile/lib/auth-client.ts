import { expoClient } from "@better-auth/expo/client";
import { CAPTCHA_HEADER, needsCaptcha } from "@vinty/shared";
import { emailOTPClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import i18n from "@/i18n";
import { getCaptchaToken } from "@/lib/captcha";
import { API_URL } from "@/lib/config";
import { runBeforeSignOut } from "@/lib/sign-out-hooks";

/** "Vinty/1.0 (iPhone 17 Pro; iOS 26.0)". The Security screen shows the part in brackets as the device name. */
const userAgent = `Vinty/${Constants.expoConfig?.version ?? "1.0"} (${Device.modelName ?? "Phone"}; ${Device.osName ?? "OS"} ${Device.osVersion ?? ""})`;

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({ scheme: "vinty", storagePrefix: "vinty", storage: SecureStore }),
    usernameClient(),
    emailOTPClient(),
  ],
  fetchOptions: {
    // Every request says which language the app is in (for emails) and which phone it is.
    customFetchImpl: async (input, init) => {
      // While the session still works: forget this phone for push and close the live connection.
      if (String(input).includes("/sign-out")) await runBeforeSignOut();
      const headers = new Headers(init?.headers);
      headers.set("Accept-Language", i18n.language);
      headers.set("User-Agent", userAgent);
      // Sign up, log in and code requests also carry the bot check answer (lib/captcha.ts).
      if ((init?.method ?? "GET").toUpperCase() === "POST" && needsCaptcha(String(input))) {
        const token = await getCaptchaToken();
        if (token) headers.set(CAPTCHA_HEADER, token);
      }
      return fetch(input, { ...init, headers });
    },
  },
});

export type AuthClient = typeof authClient;
