import { bumps, listings, notifications } from "@vinty/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { endFinishedBuzzes } from "../lib/bumps.js";
import {
  apiCaller,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  publishQuietListing,
  signUpTestUser,
  type TestContext,
  type TestPerson,
} from "../test-helpers.js";

describe.skipIf(!databaseUrl)("buzz", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  let seller: TestPerson;
  let other: TestPerson;
  let planId: string;
  let longPlanId: string;

  beforeAll(async () => {
    ctx = await buildTestApp();
    call = apiCaller(ctx);
    seller = await signUpTestUser(ctx, "buzzer", createdIds);
    other = await signUpTestUser(ctx, "buzzother", createdIds);
    const plans = (await call("GET", "/v1/bump-plans", seller.token)).json().items;
    planId = plans[0].id;
    longPlanId = plans[1].id;
  });
  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  const row = async (id: string) =>
    (await ctx.database.db.select().from(listings).where(eq(listings.id, id)).limit(1))[0];

  it("lists the free plans, shortest first, and needs a session", async () => {
    expect((await call("GET", "/v1/bump-plans")).statusCode).toBe(401);
    const res = await call("GET", "/v1/bump-plans", seller.token);
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]).toMatchObject({ priceMinor: 0, durationHours: 72, name: { en: "Buzz for 3 days" } });
    expect(items[0].durationHours).toBeLessThan(items[1].durationHours);
  });

  it("gives an active item buzz, once at a time, owner only", async () => {
    const id = await publishQuietListing(ctx, seller, "Buzz me");
    expect((await call("POST", `/v1/listings/${id}/bump`, undefined, { planId })).statusCode).toBe(401);
    expect((await call("POST", `/v1/listings/${id}/bump`, other.token, { planId })).statusCode).toBe(404);
    const bad = await call("POST", `/v1/listings/${id}/bump`, seller.token, {
      planId: "11111111-1111-4111-8111-111111111111",
    });
    expect(bad.statusCode).toBe(400);

    const before = Date.now();
    const res = await call("POST", `/v1/listings/${id}/bump`, seller.token, { planId });
    expect(res.statusCode).toBe(201);
    const bump = res.json();
    expect(bump).toMatchObject({ listingId: id, planId, payment: "free", pricePaidMinor: 0 });
    const hours = (Date.parse(bump.endsAt) - Date.parse(bump.startsAt)) / 3_600_000;
    expect(hours).toBe(72);
    const saved = await row(id);
    expect(saved?.bumpedUntil?.toISOString()).toBe(bump.endsAt);
    expect(saved?.bumpedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);

    const again = await call("POST", `/v1/listings/${id}/bump`, seller.token, { planId: longPlanId });
    expect(again.statusCode).toBe(409);

    // The own view shows when it ends, the public card says Buzzing, a buyer does not get the end time.
    const own = (await call("GET", `/v1/me/listings/${id}`, seller.token)).json();
    expect(own.isBumped).toBe(true);
    expect(own.bumpedUntil).toBe(bump.endsAt);
    const seen = (await call("GET", `/v1/listings/${id}`, other.token)).json();
    expect(seen.isBumped).toBe(true);
    expect(seen.bumpedUntil).toBeUndefined();
  });

  it("refuses items that are not for sale", async () => {
    const id = await publishQuietListing(ctx, seller, "Hidden one");
    await call("PATCH", `/v1/listings/${id}/status`, seller.token, { status: "hidden" });
    expect((await call("POST", `/v1/listings/${id}/bump`, seller.token, { planId })).statusCode).toBe(409);
  });

  it("lists my buzzes newest first with the item, in pages", async () => {
    const a = await publishQuietListing(ctx, seller, "Second buzz");
    await call("POST", `/v1/listings/${a}/bump`, seller.token, { planId: longPlanId });
    expect((await call("GET", "/v1/me/bumps")).statusCode).toBe(401);
    const page = (await call("GET", "/v1/me/bumps?limit=1", seller.token)).json();
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      isActive: true,
      payment: "free",
      listing: { id: a, title: "Second buzz", status: "active" },
      plan: { durationHours: 168 },
    });
    expect(page.nextCursor).toBeTruthy();
    const next = (await call("GET", `/v1/me/bumps?limit=5&cursor=${page.nextCursor}`, seller.token)).json();
    expect(next.items.length).toBeGreaterThanOrEqual(1);
    expect(next.items.every((b: { listing: { id: string } }) => b.listing.id !== a)).toBe(true);
    expect((await call("GET", "/v1/me/bumps", other.token)).json().items).toEqual([]);
  });

  it("ends finished buzzes once, tells the seller, and lets the item be buzzed again", async () => {
    const id = await publishQuietListing(ctx, seller, "Ends soon");
    await call("POST", `/v1/listings/${id}/bump`, seller.token, { planId });
    const past = new Date(Date.now() - 60_000);
    await ctx.database.db.update(listings).set({ bumpedUntil: past }).where(eq(listings.id, id));
    // Past its end the item no longer counts as buzzing, even before the job runs.
    const own = (await call("GET", `/v1/me/listings/${id}`, seller.token)).json();
    expect(own.isBumped).toBe(false);
    expect(own.bumpedUntil).toBeNull();

    const result = await endFinishedBuzzes(ctx.app);
    expect(result.buzzesEnded).toBeGreaterThanOrEqual(1);
    expect((await row(id))?.bumpedUntil).toBeNull();
    const sent = await ctx.database.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, seller.id), eq(notifications.type, "bump_ended")));
    expect(sent.filter((n) => n.listingId === id)).toHaveLength(1);

    await endFinishedBuzzes(ctx.app);
    const afterTwice = await ctx.database.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, seller.id), eq(notifications.type, "bump_ended")));
    expect(afterTwice.filter((n) => n.listingId === id)).toHaveLength(1);

    expect((await call("POST", `/v1/listings/${id}/bump`, seller.token, { planId })).statusCode).toBe(201);
    const history = await ctx.database.db.select().from(bumps).where(eq(bumps.listingId, id));
    expect(history).toHaveLength(2);
  });
});
