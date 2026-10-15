import { describe, expect, it } from "vitest";
import { logMailer, resendMailer } from "./mail.js";

const message = { to: "me@example.com", subject: "Your code", text: "123456", html: "<p>123456</p>" };
const env = { RESEND_API_KEY: "re_secret", MAIL_FROM: "Yadii <onboarding@resend.dev>" };

describe("resendMailer", () => {
  it("posts the email to Resend with the key as a bearer token", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "abc" }), { status: 200 });
    }) as unknown as typeof fetch;
    await resendMailer(env, fake).send(message);
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe("https://api.resend.com/emails");
    expect((call?.init.headers as Record<string, string> | undefined)?.Authorization).toBe(
      "Bearer re_secret",
    );
    expect(JSON.parse(String(call?.init.body))).toEqual({
      from: "Yadii <onboarding@resend.dev>",
      to: ["me@example.com"],
      subject: "Your code",
      text: "123456",
      html: "<p>123456</p>",
    });
  });

  it("throws with Resend's reason when it refuses, never with the key", async () => {
    const fake = (async () =>
      new Response(JSON.stringify({ name: "validation_error", message: "You can only send to yourself" }), {
        status: 403,
      })) as unknown as typeof fetch;
    const error = await resendMailer(env, fake)
      .send(message)
      .catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("403");
    expect((error as Error).message).toContain("only send to yourself");
    expect((error as Error).message).not.toContain("re_secret");
  });

  it("needs a key", () => {
    expect(() => resendMailer({ RESEND_API_KEY: undefined, MAIL_FROM: "x" })).toThrow(/RESEND_API_KEY/);
  });
});

describe("logMailer", () => {
  it("writes the email to the log instead of sending it", async () => {
    const lines: string[] = [];
    await logMailer((line) => lines.push(line)).send(message);
    const entry = JSON.parse(lines[0] as string);
    expect(entry.mail).toEqual({ to: message.to, subject: message.subject, text: message.text });
  });
});
