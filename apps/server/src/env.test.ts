import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("applies defaults", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://x" });
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
  });

  it("trims pasted sign in keys and treats blank ones as missing", () => {
    const env = parseEnv({
      DATABASE_URL: "postgres://x",
      GOOGLE_CLIENT_ID: "abc.apps.googleusercontent.com\n",
      GOOGLE_CLIENT_SECRET: "  secret ",
      APPLE_APP_BUNDLE_IDENTIFIER: " \n",
    });
    expect(env.GOOGLE_CLIENT_ID).toBe("abc.apps.googleusercontent.com");
    expect(env.GOOGLE_CLIENT_SECRET).toBe("secret");
    expect(env.APPLE_APP_BUNDLE_IDENTIFIER).toBeUndefined();
  });

  it("fails fast when DATABASE_URL is missing", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("fails fast on a bad port", () => {
    expect(() => parseEnv({ DATABASE_URL: "postgres://x", PORT: "banana" })).toThrow(/PORT/);
  });
});

describe("parseEnv in production", () => {
  const good = {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/vinty?sslmode=require",
    BETTER_AUTH_SECRET: "a-real-secret-that-is-longer-than-32-characters",
    BETTER_AUTH_URL: "https://vinty-api.vercel.app",
    CRON_SECRET: "a-cron-secret-of-16plus",
    MAIL_TRANSPORT: "resend",
    RESEND_API_KEY: "re_test_key",
    S3_ENDPOINT: "https://abc123.r2.cloudflarestorage.com",
    S3_REGION: "auto",
    S3_BUCKET: "vinty",
    S3_ACCESS_KEY_ID: "r2-key",
    S3_SECRET_ACCESS_KEY: "r2-secret",
    S3_PUBLIC_URL: "https://pub-abc.r2.dev",
  };

  it("accepts a complete setup and fills the online defaults", () => {
    const env = parseEnv(good);
    expect(env.MAIL_FROM).toBe("Vinty <onboarding@resend.dev>");
    expect(env.DATABASE_PREPARED_STATEMENTS).toBe(false);
    expect(env.IN_PROCESS_JOBS).toBe(true);
  });

  it("switches the in-process timers off on Vercel", () => {
    const env = parseEnv({ ...good, VERCEL: "1", REDIS_URL: "rediss://default:x@host:6379" });
    expect(env.IN_PROCESS_JOBS).toBe(false);
    expect(
      parseEnv({ ...good, VERCEL: "1", REDIS_URL: "rediss://h", IN_PROCESS_JOBS: "true" }).IN_PROCESS_JOBS,
    ).toBe(true);
  });

  it("keeps prepared statements for a direct database address", () => {
    const env = parseEnv({ ...good, DATABASE_URL: "postgres://u:p@db.example.com/vinty" });
    expect(env.DATABASE_PREPARED_STATEMENTS).toBe(true);
  });

  it.each([
    ["BETTER_AUTH_SECRET", { BETTER_AUTH_SECRET: undefined }],
    ["DATABASE_URL", { DATABASE_URL: "postgres://vinty:vinty@localhost:5432/vintyshminty" }],
    ["BETTER_AUTH_URL", { BETTER_AUTH_URL: "http://localhost:3000" }],
    ["BETTER_AUTH_URL", { BETTER_AUTH_URL: "http://vinty-api.vercel.app" }],
    ["CRON_SECRET", { CRON_SECRET: undefined }],
    ["RESEND_API_KEY", { RESEND_API_KEY: undefined }],
    ["MAIL_TRANSPORT", { MAIL_TRANSPORT: "memory" }],
    ["SMTP_HOST", { MAIL_TRANSPORT: "smtp" }],
    ["S3_ENDPOINT", { S3_ENDPOINT: "http://localhost:9000" }],
    ["S3_PUBLIC_URL", { S3_PUBLIC_URL: "http://localhost:9000/vinty-dev" }],
    ["S3_ACCESS_KEY_ID", { S3_ACCESS_KEY_ID: "minioadmin" }],
    ["REDIS_URL", { VERCEL: "1" }],
  ])("refuses to start without a real %s", (name, change) => {
    expect(() => parseEnv({ ...good, ...change } as Record<string, string>)).toThrow(new RegExp(name));
  });

  it("accepts the log mail transport for a private online test, without a Resend key", () => {
    expect(
      parseEnv({ ...good, MAIL_TRANSPORT: "log", RESEND_API_KEY: undefined } as unknown as Record<
        string,
        string
      >).MAIL_TRANSPORT,
    ).toBe("log");
  });

  it("does not ask for any of that on a laptop", () => {
    expect(() => parseEnv({ DATABASE_URL: "postgres://vinty:vinty@localhost:5432/x" })).not.toThrow();
  });
});
