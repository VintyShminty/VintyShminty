import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";
import { authRequestBase } from "./lib/web-origin.js";

const base = { NODE_ENV: "production", DATABASE_URL: "postgres://test:test@localhost:5432/test" };
const env = {
  BETTER_AUTH_URL: "https://server.example",
  WEB_ORIGINS: "https://web.example, https://other.example/",
  NODE_ENV: "production" as const,
};

describe("authRequestBase", () => {
  it("uses the website's address when the header names a trusted one", () => {
    expect(authRequestBase(env, "https://web.example")).toBe("https://web.example");
    expect(authRequestBase(env, "https://other.example/")).toBe("https://other.example");
  });

  it("ignores an address that is not in WEB_ORIGINS", () => {
    expect(authRequestBase(env, "https://evil.example")).toBe("https://server.example");
    expect(authRequestBase(env, "https://web.example.evil.example")).toBe("https://server.example");
    expect(authRequestBase(env, "http://localhost:3001")).toBe("https://server.example");
  });

  it("uses the server's own address when there is no header", () => {
    expect(authRequestBase(env, undefined)).toBe("https://server.example");
    expect(authRequestBase(env, "")).toBe("https://server.example");
  });

  it("trusts the local website address in development only", () => {
    const dev = { ...env, NODE_ENV: "development" as const };
    expect(authRequestBase(dev, "http://localhost:3001")).toBe("http://localhost:3001");
    expect(parseEnv({ ...base, NODE_ENV: "development" }).WEB_ORIGINS).toBe("");
  });
});
