import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { parseEnv } from "./env.js";
import { appleOptions, socialProvidersOn } from "./lib/social.js";
import { usernameSource } from "./lib/username.js";
import { buildTestApp, databaseUrl, type TestContext } from "./test-helpers.js";

const base = { NODE_ENV: "test", DATABASE_URL: "postgres://test:test@localhost:5432/test" };

describe("which providers are on", () => {
  it("is off with no settings", () => {
    expect(socialProvidersOn(parseEnv(base))).toEqual({ apple: false, google: false });
  });

  it("turns Apple on with the bundle id alone, and Google only with the pair", () => {
    const env = parseEnv({ ...base, APPLE_APP_BUNDLE_IDENTIFIER: "com.secondhand.marketplace" });
    expect(socialProvidersOn(env)).toEqual({ apple: true, google: false });
    const both = parseEnv({ ...base, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" });
    expect(socialProvidersOn(both)).toEqual({ apple: false, google: true });
  });

  it("refuses half filled settings", () => {
    expect(() => parseEnv({ ...base, GOOGLE_CLIENT_ID: "id" })).toThrow(/GOOGLE_CLIENT_SECRET/);
    expect(() => parseEnv({ ...base, APPLE_TEAM_ID: "T" })).toThrow(/APPLE_KEY_ID/);
    expect(() => parseEnv({ ...base, APPLE_CLIENT_ID: "x" })).toThrow(/APPLE_APP_BUNDLE_IDENTIFIER/);
  });
});

describe("Apple options", () => {
  it("accepts the bundle id as audience and makes no secret without a key", async () => {
    const env = parseEnv({ ...base, APPLE_APP_BUNDLE_IDENTIFIER: "com.secondhand.marketplace" });
    const options = await appleOptions(env);
    expect(options.audience).toEqual(["com.secondhand.marketplace"]);
    expect(options.appBundleIdentifier).toBe("com.secondhand.marketplace");
    expect(options.clientSecret).toBe("");
  });

  it("makes Apple's secret from the key, also when line breaks are written as \\n", async () => {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    const pem = await exportPKCS8(privateKey);
    const env = parseEnv({
      ...base,
      APPLE_APP_BUNDLE_IDENTIFIER: "com.secondhand.marketplace",
      APPLE_CLIENT_ID: "com.secondhand.marketplace.web",
      APPLE_TEAM_ID: "DTT66N8N3D",
      APPLE_KEY_ID: "ABC123DEFG",
      APPLE_PRIVATE_KEY: pem.trim().replace(/\n/g, "\\n"),
    });
    const options = await appleOptions(env);
    expect(options.audience).toEqual(["com.secondhand.marketplace", "com.secondhand.marketplace.web"]);
    const claims = decodeJwt(options.clientSecret);
    expect(claims.iss).toBe("DTT66N8N3D");
    expect(claims.sub).toBe("com.secondhand.marketplace.web");
    expect(claims.aud).toBe("https://appleid.apple.com");
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBeLessThan(15_777_000);
    expect(decodeProtectedHeader(options.clientSecret)).toMatchObject({ alg: "ES256", kid: "ABC123DEFG" });
  });
});

describe("usernames for Apple's hidden emails", () => {
  it("uses the email normally and the first name for a relay address", () => {
    expect(usernameSource("noa.levi@gmail.com", "Noa Levi")).toBe("noa.levi@gmail.com");
    expect(usernameSource("x7k2@privaterelay.appleid.com", "Noa Levi")).toBe("Noa@relay");
    expect(usernameSource("x7k2@privaterelay.appleid.com", "")).toBe("@relay");
  });
});

describe("GET /v1/auth/providers", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("reports what is switched on, with no database and no login", async () => {
    app = await buildApp({
      env: parseEnv({ ...base, APPLE_APP_BUNDLE_IDENTIFIER: "com.secondhand.marketplace" }),
      database: { ping: async () => {}, close: async () => {} },
    });
    const res = await app.inject({ method: "GET", url: "/v1/auth/providers" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ apple: true, google: false });
  });
});

describe.skipIf(!databaseUrl)("social sign in routes (needs DATABASE_URL)", () => {
  let ctx: TestContext | undefined;
  afterEach(async () => {
    await ctx?.close();
    ctx = undefined;
  });
  const signIn = (provider: string) =>
    ctx?.app.inject({
      method: "POST",
      url: "/api/auth/sign-in/social",
      payload: { provider, idToken: { token: "not-a-real-token" } },
    });

  it("does not know the providers while they are off", async () => {
    ctx = await buildTestApp();
    expect((await signIn("apple"))?.statusCode).toBe(404);
    expect((await signIn("google"))?.statusCode).toBe(404);
  });

  it("knows Apple and rejects a token that is not Apple's, without crashing", async () => {
    ctx = await buildTestApp({ APPLE_APP_BUNDLE_IDENTIFIER: "com.secondhand.marketplace" });
    const res = await signIn("apple");
    expect(res?.statusCode).toBe(401);
    expect((await signIn("google"))?.statusCode).toBe(404);
  });
});
