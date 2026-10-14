"use client";

import { emailOTPClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

function make() {
  return createAuthClient({
    // The website's own address, so the login cookie belongs to the website (the server is reached through the forward).
    baseURL: window.location.origin,
    basePath: "/api/auth",
    plugins: [emailOTPClient(), usernameClient()],
    fetchOptions: {
      // Every call says which language the page is in, so code emails come in it.
      customFetchImpl: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("Accept-Language", document.documentElement.lang || "en");
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
