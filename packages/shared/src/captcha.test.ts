import { describe, expect, it } from "vitest";
import { needsCaptcha } from "./captcha.js";

describe("needsCaptcha", () => {
  it("covers sign up, log in, code requests and Help questions", () => {
    expect(needsCaptcha("/api/auth/sign-up/email")).toBe(true);
    expect(needsCaptcha("https://yadii.app/api/auth/sign-in/email?x=1")).toBe(true);
    expect(needsCaptcha("http://localhost:3000/api/auth/email-otp/request-password-reset")).toBe(true);
    expect(needsCaptcha("/api/auth/email-otp/send-verification-otp")).toBe(true);
    expect(needsCaptcha("/v1/help/ask")).toBe(true);
  });

  it("leaves everything else alone", () => {
    expect(needsCaptcha("/api/auth/sign-out")).toBe(false);
    expect(needsCaptcha("/api/auth/get-session")).toBe(false);
    expect(needsCaptcha("/api/auth/email-otp/verify-email")).toBe(false);
    expect(needsCaptcha("/v1/help/ask/extra")).toBe(false);
    expect(needsCaptcha("/v1/listings")).toBe(false);
  });
});
