import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { type CaptchaChecker, createCaptchaChecker } from "../lib/captcha.js";
import captchaPlugin from "./captcha.js";
import errorsPlugin from "./errors.js";

const silent = Fastify().log;

/** A fake Cloudflare that says yes only to the answer "good", and remembers what it was sent. */
function fakeCloudflare() {
  const sent: { secret: string; response: string; remoteip: string }[] = [];
  const impl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    sent.push(body);
    return new Response(JSON.stringify({ success: body.response === "good" }), { status: 200 });
  }) as typeof fetch;
  return { sent, impl };
}

describe("createCaptchaChecker", () => {
  it("is off without a secret", async () => {
    const checker = createCaptchaChecker({ TURNSTILE_SECRET_KEY: undefined, CAPTCHA_REQUIRED: true });
    expect(checker.enabled).toBe(false);
    expect(await checker.check(undefined, "1.2.3.4", silent)).toBe("pass");
  });

  it("asks Cloudflare and follows its answer", async () => {
    const cloudflare = fakeCloudflare();
    const checker = createCaptchaChecker(
      { TURNSTILE_SECRET_KEY: "secret", CAPTCHA_REQUIRED: false },
      cloudflare.impl,
    );
    expect(await checker.check("good", "1.2.3.4", silent)).toBe("pass");
    expect(await checker.check("bad", "1.2.3.4", silent)).toBe("refuse");
    expect(cloudflare.sent[0]).toEqual({ secret: "secret", response: "good", remoteip: "1.2.3.4" });
  });

  it("lets a call without an answer through only while the check is not required", async () => {
    const cloudflare = fakeCloudflare();
    const soft = createCaptchaChecker(
      { TURNSTILE_SECRET_KEY: "s", CAPTCHA_REQUIRED: false },
      cloudflare.impl,
    );
    const strict = createCaptchaChecker(
      { TURNSTILE_SECRET_KEY: "s", CAPTCHA_REQUIRED: true },
      cloudflare.impl,
    );
    expect(await soft.check(undefined, "1.2.3.4", silent)).toBe("pass");
    expect(await strict.check(undefined, "1.2.3.4", silent)).toBe("refuse");
    expect(cloudflare.sent).toHaveLength(0);
  });

  it("lets the call through when Cloudflare cannot be reached", async () => {
    const down = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const checker = createCaptchaChecker({ TURNSTILE_SECRET_KEY: "s", CAPTCHA_REQUIRED: true }, down);
    expect(await checker.check("anything", "1.2.3.4", silent)).toBe("pass");
  });
});

describe("captcha plugin", () => {
  let app: ReturnType<typeof Fastify> | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function build(checker: CaptchaChecker) {
    app = Fastify();
    await app.register(errorsPlugin);
    await app.register(captchaPlugin, { checker });
    app.post("/api/auth/sign-up/email", async () => ({ ok: true }));
    app.post("/api/auth/sign-out", async () => ({ ok: true }));
    app.post("/v1/help/ask", async () => ({ ok: true }));
    return app;
  }

  const strict = createCaptchaChecker(
    { TURNSTILE_SECRET_KEY: "s", CAPTCHA_REQUIRED: true },
    fakeCloudflare().impl,
  );

  it("refuses sign up without a good answer, in the shape the forms understand", async () => {
    const server = await build(strict);
    const res = await server.inject({ method: "POST", url: "/api/auth/sign-up/email", payload: {} });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: "CAPTCHA_FAILED" });

    const wrong = await server.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { "x-captcha-response": "bad" },
      payload: {},
    });
    expect(wrong.statusCode).toBe(403);
  });

  it("lets sign up in with a good answer", async () => {
    const server = await build(strict);
    const res = await server.inject({
      method: "POST",
      url: "/api/auth/sign-up/email?x=1",
      headers: { "x-captcha-response": "good" },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
  });

  it("checks Help questions and leaves other calls alone", async () => {
    const server = await build(strict);
    const help = await server.inject({ method: "POST", url: "/v1/help/ask", payload: {} });
    expect(help.statusCode).toBe(403);
    expect(help.json().error.code).toBe("forbidden");
    const signOut = await server.inject({ method: "POST", url: "/api/auth/sign-out", payload: {} });
    expect(signOut.statusCode).toBe(200);
  });
});
