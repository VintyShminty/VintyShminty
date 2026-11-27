import { describe, expect, it } from "vitest";
import { isLogInPath, logInAlertText, signInMethod, signUpAlertText, telegramAlert } from "./telegram.js";

const env = { TELEGRAM_BOT_TOKEN: "123:secret-token", TELEGRAM_CHAT_ID: "42" };

function recordingLog() {
  const lines: { obj: object; msg: string }[] = [];
  return { lines, warn: (obj: object, msg: string) => lines.push({ obj, msg }) };
}

describe("telegramAlert", () => {
  it("is off unless both the token and the chat ID are set", () => {
    const log = recordingLog();
    expect(
      telegramAlert({ TELEGRAM_BOT_TOKEN: undefined, TELEGRAM_CHAT_ID: undefined }, log),
    ).toBeUndefined();
    expect(telegramAlert({ TELEGRAM_BOT_TOKEN: "123:x", TELEGRAM_CHAT_ID: undefined }, log)).toBeUndefined();
    expect(telegramAlert({ TELEGRAM_BOT_TOKEN: undefined, TELEGRAM_CHAT_ID: "42" }, log)).toBeUndefined();
  });

  it("posts plain text to the chat", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await telegramAlert(env, recordingLog(), fake)?.("🔑 Log in: noa_levi (Google)");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.telegram.org/bot123:secret-token/sendMessage");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      chat_id: "42",
      text: "🔑 Log in: noa_levi (Google)",
      disable_web_page_preview: true,
    });
  });

  it("never throws and never logs the token when Telegram fails", async () => {
    const log = recordingLog();
    const refused = (async () =>
      new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }), {
        status: 400,
      })) as unknown as typeof fetch;
    const broken = (async () => {
      throw new TypeError("fetch failed for https://api.telegram.org/bot123:secret-token/sendMessage");
    }) as unknown as typeof fetch;
    await expect(telegramAlert(env, log, refused)?.("hi")).resolves.toBeUndefined();
    await expect(telegramAlert(env, log, broken)?.("hi")).resolves.toBeUndefined();
    expect(log.lines).toHaveLength(2);
    expect(log.lines[0]?.obj).toEqual({ status: 400, reason: "Bad Request: chat not found" });
    expect(JSON.stringify(log.lines)).not.toContain("secret-token");
  });
});

describe("alert wording", () => {
  it("counts only real log in addresses", () => {
    expect(isLogInPath("/sign-in/email")).toBe(true);
    expect(isLogInPath("/sign-in/social")).toBe(true);
    expect(isLogInPath("/callback/google")).toBe(true);
    expect(isLogInPath("/oauth-proxy-callback")).toBe(true);
    expect(isLogInPath("/change-password")).toBe(false);
    expect(isLogInPath("/admin/impersonate-user")).toBe(false);
    expect(isLogInPath(undefined)).toBe(false);
  });

  it("names the sign in method", () => {
    expect(signInMethod("/sign-in/email", "google")).toBe("email and password");
    expect(signInMethod("/sign-in/username", undefined)).toBe("email and password");
    expect(signInMethod("/sign-in/email-otp", undefined)).toBe("email code");
    expect(signInMethod("/oauth-proxy-callback", "google")).toBe("Google");
    expect(signInMethod("/sign-in/social", "apple")).toBe("Apple");
    expect(signInMethod(undefined, undefined)).toBe("email and password");
  });

  it("writes the two messages", () => {
    expect(signUpAlertText("noa_levi", "Google")).toBe("🆕 New sign up: noa_levi (Google)");
    expect(logInAlertText("oliver.smith", "email and password")).toBe(
      "🔑 Log in: oliver.smith (email and password)",
    );
  });
});
