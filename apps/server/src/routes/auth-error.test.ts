import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { parseEnv } from "../env.js";
import { authErrorUrl, createAuth } from "../lib/auth.js";
import { KNOWN_AUTH_ERROR_CODES } from "../lib/auth-error-page.js";
import { memoryMailer } from "../lib/mail.js";

const env = parseEnv({
  NODE_ENV: "test",
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  BETTER_AUTH_URL: "https://api.example.test",
});

let app: Awaited<ReturnType<typeof buildApp>> | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function get(url: string) {
  app = await buildApp({ env, database: { ping: async () => {}, close: async () => {} } });
  return app.inject({ method: "GET", url });
}

describe("GET /v1/auth/error", () => {
  it("shows the linking message in English and Hebrew", async () => {
    const res = await get("/v1/auth/error?error=account_not_linked");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("This email already has a Vinty account");
    expect(res.body).toContain("confirm your email with the code");
    expect(res.body).toContain('dir="rtl"');
    expect(res.body).toContain("לכתובת האימייל הזו כבר יש חשבון Vinty");
  });

  it("shows a fixed message for every known code", async () => {
    const seen = new Set<string>();
    for (const code of KNOWN_AUTH_ERROR_CODES) {
      const res = await get(`/v1/auth/error?error=${code}`);
      expect(res.statusCode).toBe(200);
      const title = /<h1>(.*?)<\/h1>/.exec(res.body)?.[1] ?? "";
      expect(title).not.toBe("Something went wrong");
      seen.add(title);
      await app?.close();
    }
    expect(seen.size).toBe(KNOWN_AUTH_ERROR_CODES.length);
  });

  it("shows the generic message for unknown or missing codes", async () => {
    for (const url of ["/v1/auth/error?error=whatever", "/v1/auth/error", "/v1/auth/error?error=__proto__"]) {
      const res = await get(url);
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("Something went wrong");
      await app?.close();
    }
  });

  it("never reflects the query", async () => {
    const res = await get(
      "/v1/auth/error?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E&error_description=%3Cimg%20src%3Dx%20onerror%3Dalert(2)%3E",
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain("<script");
    expect(res.body).not.toContain("alert");
    expect(res.body).not.toContain("onerror");
    expect(res.body).toContain("Something went wrong");
  });

  it("links back to the app and sets tight headers", async () => {
    const res = await get("/v1/auth/error?error=account_not_linked");
    expect(res.body).toContain('href="vinty://"');
    expect(res.headers["cache-control"]).toBe("no-store");
    const csp = String(res.headers["content-security-policy"]);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toMatch(/style-src 'sha256-[A-Za-z0-9+/=]+'/);
    expect(csp).not.toContain("unsafe-inline");
    expect(res.body).not.toContain("<script");
  });
});

describe("Better Auth error address", () => {
  it("points a refused login at our page", () => {
    expect(authErrorUrl(env)).toBe("https://api.example.test/v1/auth/error");
    const auth = createAuth({ env, db: {} as never, mailer: memoryMailer() });
    expect(auth.options.onAPIError?.errorURL).toBe("https://api.example.test/v1/auth/error");
  });
});
