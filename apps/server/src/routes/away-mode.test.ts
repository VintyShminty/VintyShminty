import { profiles } from "@vinty/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runOrderJobs } from "../lib/order-jobs.js";
import {
  apiCaller,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  publishTestListing,
  signUpTestUser,
  type TestContext,
  type TestPerson,
} from "../test-helpers.js";

const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

// Runs only when DATABASE_URL points at a migrated and seeded local database (pnpm db:reset).
describe.skipIf(!databaseUrl)("away mode", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  let seller: TestPerson;
  let buyer: TestPerson;
  let listingId: string;
  const word = `awayword${Date.now().toString(36)}`;

  const awayState = async (token: string) => (await call("GET", "/v1/me/away-mode", token)).json();
  const searchIds = async () =>
    ((await call("GET", `/v1/listings?q=${word}`)).json().items as { id: string }[]).map((i) => i.id);

  beforeAll(async () => {
    ctx = await buildTestApp();
    call = apiCaller(ctx);
    seller = await signUpTestUser(ctx, "awayseller", createdIds);
    buyer = await signUpTestUser(ctx, "awaybuyer", createdIds);
    listingId = await publishTestListing(ctx, seller, `${word} coat`);
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("needs a signed in person", async () => {
    expect((await call("PUT", "/v1/me/away-mode", undefined, { enabled: false })).statusCode).toBe(401);
    expect((await call("GET", "/v1/me/away-mode")).statusCode).toBe(401);
  });

  it("starts off", async () => {
    expect(await awayState(seller.token)).toEqual({ enabled: false, startedAt: null, endsAt: null });
    expect(await searchIds()).toContain(listingId);
  });

  it("rejects a date in the past and a date more than 90 days away", async () => {
    const past = await call("PUT", "/v1/me/away-mode", seller.token, { enabled: true, endsAt: inDays(-1) });
    expect(past.statusCode).toBe(400);
    expect(past.json().error.fields.endsAt).toBe("validation.away.past");
    const far = await call("PUT", "/v1/me/away-mode", seller.token, { enabled: true, endsAt: inDays(91) });
    expect(far.statusCode).toBe(400);
    expect(far.json().error.fields.endsAt).toBe("validation.away.tooFar");
    expect((await awayState(seller.token)).enabled).toBe(false);
  });

  it("switches on with a return date, hides the items and blocks buying, but chat stays open", async () => {
    const endsAt = inDays(10);
    const res = await call("PUT", "/v1/me/away-mode", seller.token, { enabled: true, endsAt });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ enabled: true, endsAt });
    expect(res.json().startedAt).not.toBeNull();

    const me = (await call("GET", "/v1/me", seller.token)).json();
    expect(me.profile.holidayMode).toBe(true);
    expect(await searchIds()).not.toContain(listingId);

    const detail = (await call("GET", `/v1/listings/${listingId}`, buyer.token)).json();
    expect(detail.sellerOnHoliday).toBe(true);
    expect(detail.sellerAwayUntil).toBe(endsAt);
    expect(detail.viewer.canBuy).toBe(false);
    expect(detail.viewer.canOffer).toBe(false);

    const quote = await call("POST", "/v1/checkout/quote", buyer.token, { listingId });
    expect(quote.statusCode).toBe(409);

    const chat = await call("POST", "/v1/conversations", buyer.token, { listingId, body: "Hi, is it nice?" });
    expect([200, 201]).toContain(chat.statusCode);
  });

  it("keeps the first start when only the date changes, and accepts no date", async () => {
    const first = await awayState(seller.token);
    const again = await call("PUT", "/v1/me/away-mode", seller.token, { enabled: true });
    expect(again.json()).toMatchObject({ enabled: true, endsAt: null, startedAt: first.startedAt });
  });

  it("treats a past return date as back even before the daily job has run", async () => {
    await ctx.database.db
      .update(profiles)
      .set({ holidayEndsAt: new Date(Date.now() - 1000) })
      .where(eq(profiles.userId, seller.id));
    expect(await searchIds()).toContain(listingId);
    expect((await call("GET", "/v1/me", seller.token)).json().profile.holidayMode).toBe(false);
    expect((await call("GET", `/v1/listings/${listingId}`, buyer.token)).json().sellerOnHoliday).toBe(false);
    expect((await awayState(seller.token)).enabled).toBe(false);
  });

  it("the daily job switches the flag off for good", async () => {
    const result = await runOrderJobs(ctx.app);
    expect(result.awayEnded).toBeGreaterThanOrEqual(1);
    const [row] = await ctx.database.db.select().from(profiles).where(eq(profiles.userId, seller.id));
    expect(row).toMatchObject({ holidayModeEnabled: false, holidayStartedAt: null, holidayEndsAt: null });
    expect((await runOrderJobs(ctx.app)).awayEnded).toBe(0);
  });

  it("does not end someone with no date or a future date", async () => {
    await call("PUT", "/v1/me/away-mode", seller.token, { enabled: true });
    await call("PUT", "/v1/me/away-mode", buyer.token, { enabled: true, endsAt: inDays(5) });
    await runOrderJobs(ctx.app);
    expect((await awayState(seller.token)).enabled).toBe(true);
    expect((await awayState(buyer.token)).enabled).toBe(true);
  });

  it("switches off by hand", async () => {
    const res = await call("PUT", "/v1/me/away-mode", seller.token, { enabled: false, endsAt: inDays(3) });
    expect(res.json()).toEqual({ enabled: false, startedAt: null, endsAt: null });
    expect(await searchIds()).toContain(listingId);
  });
});
