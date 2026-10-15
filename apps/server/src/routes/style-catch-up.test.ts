import { adminUploads, aiCalls, killSwitches, listings, reports } from "@vinty/db";
import type { CategoryNode, ReferenceData } from "@vinty/shared";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { settleBackground } from "../lib/background.js";
import { createListingChecker, fakeListingCheckReader, tagUntaggedListings } from "../lib/listing-check.js";
import {
  apiCaller,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  fakeStorage,
  signUpTestUser,
  type TestContext,
  type TestPerson,
} from "../test-helpers.js";

const SECRET = "test-cron-secret-0123456789";
const stamp = Date.now().toString(36);
const log = { info: () => undefined, warn: () => undefined };

// Runs only when DATABASE_URL points at a migrated local database. The listings it makes are dated 1970 so they come
// first in "oldest first", whatever else is in the database.
describe.skipIf(!databaseUrl)("the nightly style catch-up (D-042)", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  let seller: TestPerson;
  let reference: ReferenceData;
  const createdIds: string[] = [];
  const listingIds: string[] = [];
  const db = () => ctx.database.db;
  // The creation check answers nothing useful, so the listings can be reset to "never tagged" afterwards.
  const checkReader = fakeListingCheckReader({
    flags: [{ kind: "counterfeit", urgency: "high", summary: "Says AAA replica." }],
    styles: ["y2k", "bogus", "streetwear"],
  });

  const leaves = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes.flatMap((n) => (n.isLeaf ? [n] : leaves(n.children)));
  let n = 0;
  async function createListing(title: string) {
    const sized = leaves(reference.categories).find(
      (c) => c.rules.size === "required" && c.rules.brand !== "hidden" && c.sizeGroupIds.length > 0,
    ) as CategoryNode;
    const group = reference.sizeGroups.find((g) => sized.sizeGroupIds.includes(g.id));
    n += 1;
    const res = await call("POST", "/v1/listings", seller.token, {
      title,
      description: "Nice",
      categoryId: sized.id,
      brandName: "Some Little Label",
      sizeId: group?.sizes[0]?.id,
      conditionId: reference.conditions[0]?.id,
      colourIds: [reference.colours[0]?.id],
      priceMinor: 12000,
      parcelSizeId: reference.parcelSizes[0]?.id,
      photos: [{ key: `listings/${seller.id}/cu-${stamp}-${n}.jpg`, width: 900, height: 1200 }],
      publish: true,
    });
    expect(res.statusCode, res.body).toBe(201);
    const id = (res.json() as { id: string }).id;
    listingIds.push(id);
    await settleBackground();
    return id;
  }
  /** Back to "never tagged", dated 1970 so the catch-up meets it first. */
  const reset = (ids: string[], day: number) =>
    db()
      .update(listings)
      .set({ styles: [], stylesTaggedAt: null, createdAt: new Date(Date.UTC(1970, 0, day)) })
      .where(inArray(listings.id, ids));
  const row = async (id: string) =>
    (await db().select().from(listings).where(eq(listings.id, id)))[0] as typeof listings.$inferSelect;

  beforeAll(async () => {
    ctx = await buildTestApp(
      { CRON_SECRET: SECRET },
      {
        listingCheckReader: checkReader,
        storage: { ...fakeStorage, read: async () => Buffer.from("jpeg") },
      },
    );
    call = apiCaller(ctx);
    seller = await signUpTestUser(ctx, "cuseller", createdIds);
    reference = (await call("GET", "/v1/reference")).json() as ReferenceData;
    await db().delete(killSwitches).where(eq(killSwitches.name, "ai"));
  });
  afterAll(async () => {
    await settleBackground();
    await db().delete(killSwitches).where(eq(killSwitches.name, "ai"));
    await db().delete(reports).where(inArray(reports.targetId, listingIds));
    await db().delete(aiCalls).where(inArray(aiCalls.userId, createdIds));
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("tags only untagged live listings, oldest first, and respects the limit", async () => {
    const [a, b, c, draft, sold] = [
      await createListing(`Catch A ${stamp}`),
      await createListing(`Catch B ${stamp}`),
      await createListing(`Catch C ${stamp}`),
      await createListing(`Catch draft ${stamp}`),
      await createListing(`Catch sold ${stamp}`),
    ] as [string, string, string, string, string];
    await db().update(listings).set({ status: "draft" }).where(eq(listings.id, draft));
    await db().update(listings).set({ status: "sold" }).where(eq(listings.id, sold));
    // A is the oldest, then B, then C. The draft and the sold one are older still but not live.
    await reset([draft, sold], 1);
    await reset([a], 2);
    await reset([b], 3);
    await reset([c], 4);
    // Make C already tagged, so only A and B are waiting.
    await db()
      .update(listings)
      .set({ stylesTaggedAt: new Date(), styles: ["goth"] })
      .where(eq(listings.id, c));

    const checker = createListingChecker(ctx.app, checkReader);
    const before = checkReader.calls.length;
    const result = await tagUntaggedListings(ctx.app, checker, log, 1);
    expect(result).toEqual({ tagged: 1, failed: 0, stoppedEarly: false });
    expect(checkReader.calls.length).toBe(before + 1);
    expect((await row(a)).styles).toEqual(["y2k", "streetwear"]);
    expect((await row(b)).stylesTaggedAt).toBeNull();

    // A member's listing keeps its flag; the second run tags B and leaves the others alone.
    expect(await tagUntaggedListings(ctx.app, checker, log, 1)).toMatchObject({ tagged: 1 });
    expect((await row(b)).styles).toEqual(["y2k", "streetwear"]);
    expect((await row(c)).styles).toEqual(["goth"]);
    expect((await row(draft)).stylesTaggedAt).toBeNull();
    expect((await row(sold)).stylesTaggedAt).toBeNull();
    expect((await db().select().from(reports).where(eq(reports.targetId, a))).length).toBeGreaterThan(0);
  });

  it("only tags admin uploaded listings, without flags", async () => {
    const id = await createListing(`Catch admin ${stamp}`);
    await db().delete(reports).where(eq(reports.targetId, id));
    await db()
      .insert(adminUploads)
      .values({ listingId: id, ownerFullName: `Owner ${stamp}`, uploadedBy: seller.id });
    await reset([id], 5);
    const checker = createListingChecker(ctx.app, checkReader);
    await tagUntaggedListings(ctx.app, checker, log, 1);
    expect((await row(id)).styles).toEqual(["y2k", "streetwear"]);
    expect(await db().select().from(reports).where(eq(reports.targetId, id))).toHaveLength(0);
    await db().delete(adminUploads).where(eq(adminUploads.listingId, id));
  });

  it("stops without tagging anything when the AI switch is off", async () => {
    const id = await createListing(`Catch off ${stamp}`);
    await reset([id], 6);
    await db().insert(killSwitches).values({ name: "ai", enabled: false, reason: "Paused" });
    // A fresh server copy: each copy remembers the switch for 30 seconds, and the shared one saw it on.
    const fresh = await buildTestApp(
      { CRON_SECRET: SECRET },
      { listingCheckReader: checkReader, storage: { ...fakeStorage, read: async () => Buffer.from("jpeg") } },
    );
    // The app's own checker is behind the meter, so this goes through the job route.
    const res = await fresh.app.inject({
      method: "GET",
      url: "/v1/jobs/all",
      headers: { authorization: `Bearer ${SECRET}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().styles).toMatchObject({ tagged: 0, stoppedEarly: true });
    expect((await row(id)).stylesTaggedAt).toBeNull();
    await fresh.close();
    await db().delete(killSwitches).where(eq(killSwitches.name, "ai"));
  });
});
