import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { parseEnv } from "../env.js";

const env = parseEnv({ NODE_ENV: "test", DATABASE_URL: "postgres://test:test@localhost:5432/test" });

async function build(ping: () => Promise<void>) {
  return buildApp({ env, database: { ping, close: async () => {} } });
}

let app: Awaited<ReturnType<typeof build>> | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /health", () => {
  it("returns ok", async () => {
    app = await build(async () => {});
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe("GET /health/db", () => {
  it("reports the database as up", async () => {
    app = await build(async () => {});
    const res = await app.inject({ method: "GET", url: "/health/db" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, database: "up" });
  });

  it("returns 503 when the database is unreachable", async () => {
    app = await build(async () => {
      throw new Error("connection refused");
    });
    const res = await app.inject({ method: "GET", url: "/health/db" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ ok: false, database: "down" });
  });
});
