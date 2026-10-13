import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, databaseUrl, type TestContext } from "../test-helpers.js";

const SECRET = "test-cron-secret-0123456789";
const URLS = [
  "/v1/jobs/orders",
  "/v1/jobs/feed-popularity",
  "/v1/jobs/feed-cleanup",
  "/v1/jobs/buzz-end",
  "/v1/jobs/all",
];

// Runs only when DATABASE_URL points at a migrated local database.
describe.skipIf(!databaseUrl)("scheduler endpoints", () => {
  let ctx: TestContext;
  let off: TestContext;
  beforeAll(async () => {
    ctx = await buildTestApp({ CRON_SECRET: SECRET });
    off = await buildTestApp();
  });
  afterAll(async () => {
    await ctx.close();
    await off.close();
  });

  it.each(URLS)("%s refuses a missing or wrong secret", async (url) => {
    expect((await ctx.app.inject({ method: "GET", url })).statusCode).toBe(401);
    const wrong = await ctx.app.inject({ method: "GET", url, headers: { authorization: "Bearer nope" } });
    expect(wrong.statusCode).toBe(401);
    const sameLength = await ctx.app.inject({
      method: "GET",
      url,
      headers: { authorization: `Bearer ${"x".repeat(SECRET.length)}` },
    });
    expect(sameLength.statusCode).toBe(401);
  });

  it.each(URLS)("%s answers 404 when no CRON_SECRET is set", async (url) => {
    const res = await off.app.inject({ method: "GET", url, headers: { authorization: `Bearer ${SECRET}` } });
    expect(res.statusCode).toBe(404);
  });

  it.each(URLS)("%s runs the job the way Vercel Cron calls it (GET with the bearer header)", async (url) => {
    const res = await ctx.app.inject({ method: "GET", url, headers: { authorization: `Bearer ${SECRET}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("the order endpoint reports every step", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/jobs/orders",
      headers: { authorization: `Bearer ${SECRET}` },
    });
    expect(Object.keys(res.json())).toEqual(
      expect.arrayContaining([
        "offersExpired",
        "acceptedOffersExpired",
        "unpaidCancelled",
        "reservationsReleased",
        "unshippedCancelled",
        "pretendDelivered",
        "autoCompleted",
        "reviewReminders",
        "awayEnded",
      ]),
    );
  });
});
