"use client";

import { CAPTCHA_HEADER, needsCaptcha } from "@vinty/shared";
import { emailOTPClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { getCaptchaToken } from "@/lib/captcha";

function make() {
  return createAuthClient({
    // The website's own address, so the login cookie belongs to the website (the server is reached through the forward).
    baseURL: window.location.origin,
    basePath: "/api/auth",
    plugins: [emailOTPClient(), usernameClient()],
    fetchOptions: {
      // Every call says which language the page is in, so code emails come in it. Sign up, log in and code requests
      // also carry the bot check answer (lib/captcha.ts).
      customFetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("Accept-Language", document.documentElement.lang || "en");
        const url = input instanceof Request ? input.url : String(input);
        if ((init?.method ?? "GET").toUpperCase() === "POST" && needsCaptcha(url)) {
          const token = await getCaptchaToken();
          if (token) headers.set(CAPTCHA_HEADER, token);
        }
        return fetch(input, { ...init, headers });
      },
    },
  });
}

let client: ReturnType<typeof make> | undefined;

/** The one Better Auth client of the website. Browser only: call it inside an event handler or an effect. */
export function getAuthClient() {
  client ??= make();
  return client;
}
