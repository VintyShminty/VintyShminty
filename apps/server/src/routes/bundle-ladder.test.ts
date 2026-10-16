import { DEFAULT_BUNDLE_LADDER } from "@vinty/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

// Runs only when DATABASE_URL points at a migrated local database.
describe.skipIf(!databaseUrl)("bundle ladder", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  let seller: TestPerson;
  let buyer: TestPerson;

  beforeAll(async () => {
    ctx = await buildTestApp();
    call = apiCaller(ctx);
    [seller, buyer] = (await Promise.all(
      ["lseller", "lbuyer"].map((n) => signUpTestUser(ctx, n, createdIds)),
    )) as TestPerson[];
  });

  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("gives a seller with no saved steps the default ladder, switched on", async () => {
    const res = await call("GET", `/v1/users/${seller.id}/bundle-ladder`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ on: true, tiers: DEFAULT_BUNDLE_LADDER });
    expect((await call("GET", `/v1/users/${crypto.randomUUID()}/bundle-ladder`)).statusCode).toBe(404);
  });

  it("needs a session for the own ladder", async () => {
    expect((await call("GET", "/v1/me/bundle-ladder")).statusCode).toBe(401);
    expect(
      (
        await call("PUT", "/v1/me/bundle-ladder", undefined, {
          on: true,
          tiers: [{ minItems: 2, percentOff: 5 }],
        })
      ).statusCode,
    ).toBe(401);
  });

  it("refuses steps that do not grow or are out of range", async () => {
    const put = (tiers: { minItems: number; percentOff: number }[]) =>
      call("PUT", "/v1/me/bundle-ladder", seller.token, { on: true, tiers });
    expect((await put([])).statusCode).toBe(400);
    expect((await put([{ minItems: 1, percentOff: 5 }])).statusCode).toBe(400);
    expect((await put([{ minItems: 2, percentOff: 51 }])).statusCode).toBe(400);
    expect((await put([{ minItems: 21, percentOff: 5 }])).statusCode).toBe(400);
    expect(
      (
        await put([
          { minItems: 2, percentOff: 10 },
          { minItems: 3, percentOff: 10 },
        ])
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await put([
          { minItems: 3, percentOff: 5 },
          { minItems: 3, percentOff: 10 },
        ])
      ).statusCode,
    ).toBe(400);
    const six = [2, 3, 4, 5, 6, 7].map((n) => ({ minItems: n, percentOff: n }));
    expect((await put(six)).statusCode).toBe(400);
  });

  it("saves new steps, shows the savings on the bundle and carries them to checkout", async () => {
    const saved = await call("PUT", "/v1/me/bundle-ladder", seller.token, {
      on: true,
      tiers: [
        { minItems: 2, percentOff: 20 },
        { minItems: 4, percentOff: 30 },
      ],
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().tiers).toEqual([
      { minItems: 2, percentOff: 20 },
      { minItems: 4, percentOff: 30 },
    ]);
    expect((await call("GET", "/v1/me/bundle-ladder", seller.token)).json()).toEqual(saved.json());
    expect((await call("GET", `/v1/users/${seller.id}/bundle-ladder`)).json()).toEqual(saved.json());

    const a = await publishQuietListing(ctx, seller, "Ladder a");
    const b = await publishQuietListing(ctx, seller, "Ladder b");
    const bundle = (await call("POST", "/v1/bundles", buyer.token, { sellerId: seller.id })).json();
    await call("PUT", `/v1/bundles/${bundle.id}/items/${a}`, buyer.token);
    const two = (await call("PUT", `/v1/bundles/${bundle.id}/items/${b}`, buyer.token)).json();
    expect(two).toMatchObject({ itemCount: 2, discountPercent: 20 });
    expect(two.tiers).toHaveLength(2);
    expect(two.postageSeparateMinor).toBeGreaterThanOrEqual(two.postageTogetherMinor);
    expect(two.postageTogetherMinor).toBeGreaterThan(0);

    const quote = (await call("POST", "/v1/checkout/quote", buyer.token, { bundleId: bundle.id })).json();
    expect(quote.bundleDiscountPercent).toBe(20);
    expect(quote.postageSavedMinor).toBe(two.postageSeparateMinor - two.postageTogetherMinor);
  });

  it("gives no discount anywhere once the seller switches bundles off", async () => {
    const off = await call("PUT", "/v1/me/bundle-ladder", seller.token, {
      on: false,
      tiers: [{ minItems: 2, percentOff: 20 }],
    });
    expect(off.json()).toEqual({ on: false, tiers: [] });
    expect((await call("GET", `/v1/users/${seller.id}/bundle-ladder`)).json()).toEqual({
      on: false,
      tiers: [],
    });

    const bundle = (await call("POST", "/v1/bundles", buyer.token, { sellerId: seller.id })).json();
    expect(bundle).toMatchObject({
      itemCount: 2,
      discountPercent: 0,
      discountMinor: 0,
      tiers: [],
      nextTier: null,
    });
    const quote = (await call("POST", "/v1/checkout/quote", buyer.token, { bundleId: bundle.id })).json();
    expect(quote).toMatchObject({ bundleDiscountPercent: 0, bundleDiscountMinor: 0 });

    // Switching back on brings the saved steps back.
    const on = await call("PUT", "/v1/me/bundle-ladder", seller.token, {
      on: true,
      tiers: [{ minItems: 2, percentOff: 20 }],
    });
    expect(on.json()).toEqual({ on: true, tiers: [{ minItems: 2, percentOff: 20 }] });
  });
});
