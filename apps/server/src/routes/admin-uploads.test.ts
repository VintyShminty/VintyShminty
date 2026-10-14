import {
  accounts,
  adminActions,
  adminUploads,
  aiCalls,
  killSwitches,
  listings,
  orderItems,
  orders,
  profiles,
  standInSellers,
  userSettings,
  users,
} from "@vinty/db";
import { type CategoryNode, ERROR_CODES, type ReferenceData } from "@vinty/shared";
import { eq, inArray } from "drizzle-orm";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { notifyUser } from "../lib/notify.js";
import { fakePhotoReader } from "../lib/photo-reader.js";
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

const stamp = Date.now().toString(36);
const OWNER = `Zelda Quxbert ${stamp}`;
const OTHER_OWNER = `Mordecai Pfeffer ${stamp}`;

describe.skipIf(!databaseUrl)("admin listing upload", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  let admin: TestPerson;
  let regular: TestPerson;
  let buyer: TestPerson;
  let standIn: { id: string; username: string };
  let reference: ReferenceData;
  const db = () => ctx.database.db;
  const reader = fakePhotoReader({
    categories: [{ code: "C1", confidence: 0.9 }],
    brandText: null,
    colours: ["K1"],
  });

  beforeAll(async () => {
    ctx = await buildTestApp(
      {},
      {
        photoReader: reader,
        // A storage that has a file at every key, so the photo helper has something to read.
        storage: { ...fakeStorage, read: async () => Buffer.from("not really a photo") },
      },
    );
    call = apiCaller(ctx);
    [admin, regular, buyer] = await Promise.all([
      signUpTestUser(ctx, "upl", createdIds),
      signUpTestUser(ctx, "uplreg", createdIds),
      signUpTestUser(ctx, "uplbuy", createdIds),
    ]);
    await db().update(users).set({ role: "admin" }).where(eq(users.id, admin.id));
    await db().delete(killSwitches).where(eq(killSwitches.name, "ai"));
    reference = (await call("GET", "/v1/reference")).json();
  });
  afterAll(async () => {
    await db().delete(aiCalls).where(eq(aiCalls.userId, admin.id));
    await db().delete(killSwitches).where(eq(killSwitches.name, "ai"));
    await db().delete(adminActions).where(inArray(adminActions.adminUserId, createdIds));
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  const leaves = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes.flatMap((n) => (n.isLeaf ? [n] : leaves(n.children)));

  /** A complete item for the category that needs the most (size, brand, condition, colour all asked for). */
  const completeItem = (title: string, n: number, extra: Record<string, unknown> = {}) => {
    const category = leaves(reference.categories).find(
      (c) => c.rules.size === "required" && c.rules.brand !== "hidden" && c.sizeGroupIds.length > 0,
    ) as CategoryNode;
    const group = reference.sizeGroups.find((g) => category.sizeGroupIds.includes(g.id));
    return {
      clientId: `row-${n}`,
      title,
      description: "Worn twice",
      categoryId: category.id,
      brandName: "Some Little Label",
      sizeId: group?.sizes[0]?.id,
      conditionId: reference.conditions[0]?.id,
      colourIds: [reference.colours[0]?.id],
      priceMinor: 12000,
      photos: [{ key: `listings/${standIn.id}/up-${stamp}-${n}.jpg`, width: 900, height: 1200 }],
      ...extra,
    };
  };

  const adminRoutes: [method: "GET" | "POST", url: string, body?: object][] = [
    ["GET", "/v1/admin/stand-ins"],
    ["POST", "/v1/admin/stand-ins", { username: "someone_new" }],
    [
      "POST",
      "/v1/admin/stand-ins/11111111-1111-4111-8111-111111111111/uploads",
      { contentType: "image/jpeg", byteSize: 100 },
    ],
    [
      "POST",
      "/v1/admin/stand-ins/11111111-1111-4111-8111-111111111111/suggest",
      { photoKeys: ["a"], language: "en" },
    ],
    [
      "POST",
      "/v1/admin/stand-ins/11111111-1111-4111-8111-111111111111/listings",
      {
        ownerFullName: "Some Owner",
        items: [
          {
            title: "A shirt",
            categoryId: "11111111-1111-4111-8111-111111111111",
            priceMinor: 1000,
            photos: [{ key: "listings/x/a.jpg", width: 10, height: 10 }],
          },
        ],
      },
    ],
    ["GET", "/v1/admin/uploads"],
    ["GET", "/v1/admin/uploads/export.xlsx"],
  ];

  it.each(adminRoutes)(
    "%s %s is closed to signed out people (401) and to non admins (403)",
    async (m, url, body) => {
      expect((await call(m, url, undefined, body)).statusCode).toBe(401);
      expect((await call(m, url, regular.token, body)).statusCode).toBe(403);
    },
  );

  describe("stand-in usernames", () => {
    it("makes a real public seller that nobody can sign in as", async () => {
      const username = `vt.closet.${stamp}`;
      const res = await call("POST", "/v1/admin/stand-ins", admin.token, {
        username,
        displayName: "Vintage Closet",
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toMatchObject({ username, displayName: "Vintage Closet", ownerNames: [] });
      standIn = { id: body.id, username };
      createdIds.push(body.id);

      const [user] = await db().select().from(users).where(eq(users.id, standIn.id));
      expect(user?.email.endsWith("@stand-in.invalid")).toBe(true);
      expect(user?.username).toBe(username.toLowerCase());
      // A profile and settings like any member, with email and push off. No password or other sign in method.
      expect(await db().select().from(profiles).where(eq(profiles.userId, standIn.id))).toHaveLength(1);
      const [settings] = await db().select().from(userSettings).where(eq(userSettings.userId, standIn.id));
      expect(settings).toMatchObject({ emailEnabled: false, pushEnabled: false });
      expect(await db().select().from(accounts).where(eq(accounts.userId, standIn.id))).toHaveLength(0);
      expect(
        await db().select().from(standInSellers).where(eq(standInSellers.userId, standIn.id)),
      ).toHaveLength(1);

      // Its public profile works.
      const profile = await call("GET", `/v1/users/${standIn.id}`);
      expect(profile.statusCode).toBe(200);
      expect(profile.json().username).toBe(username);
    });

    it("cannot be signed into, by password or by a session made for it", async () => {
      const [user] = await db().select().from(users).where(eq(users.id, standIn.id));
      const login = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email: user?.email, password: "correct-horse-battery" },
      });
      expect(login.statusCode).toBeGreaterThanOrEqual(400);
      expect(login.statusCode).toBeLessThan(500);
      const loginByName = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/sign-in/username",
        payload: { username: standIn.username, password: "correct-horse-battery" },
      });
      expect(loginByName.statusCode).toBeGreaterThanOrEqual(400);

      // Even a session made directly is refused by the rule in lib/auth.ts.
      const context = await ctx.app.auth.$context;
      const session = await context.internalAdapter.createSession(standIn.id).catch(() => null);
      expect(session).toBeFalsy();
      // A normal person still gets one.
      expect(await context.internalAdapter.createSession(regular.id)).toBeTruthy();
    });

    it("refuses taken, reserved and badly written usernames, with field keys", async () => {
      const taken = await call("POST", "/v1/admin/stand-ins", admin.token, {
        username: standIn.username.toUpperCase(),
      });
      expect(taken.statusCode).toBe(400);
      expect(taken.json().error.fields.username).toBe("validation.username.taken");
      const takenByMember = await call("POST", "/v1/admin/stand-ins", admin.token, {
        username: regular.username,
      });
      expect(takenByMember.json().error.fields.username).toBe("validation.username.taken");
      for (const reserved of ["admin", "Vinty", "v.inty"]) {
        const res = await call("POST", "/v1/admin/stand-ins", admin.token, { username: reserved });
        expect(res.statusCode).toBe(400);
        expect(res.json().error.fields.username).toBe("validation.username.reserved");
      }
      for (const bad of ["a b c", "ab", "x".repeat(30)]) {
        expect((await call("POST", "/v1/admin/stand-ins", admin.token, { username: bad })).statusCode).toBe(
          400,
        );
      }
    });

    it("lists stand-ins and writes an audit row", async () => {
      const list = (await call("GET", "/v1/admin/stand-ins", admin.token)).json();
      expect(list.items.find((s: { id: string }) => s.id === standIn.id)).toMatchObject({
        username: standIn.username,
        listingCounts: { active: 0, reserved: 0, sold: 0, hidden: 0 },
      });
      const audit = (
        await db().select().from(adminActions).where(eq(adminActions.adminUserId, admin.id))
      ).find((a) => a.action === "stand_in_created" && a.targetId === standIn.id);
      expect(audit).toBeDefined();
    });

    it("lets a sale notification reach it without sending anything or failing", async () => {
      const result = await notifyUser(ctx.app, {
        userId: standIn.id,
        type: "listing_favourited",
        push: () => ({ title: "Hello", body: "Someone liked it" }),
      });
      expect(result.pushed).toBe(false);
      expect(ctx.pusher.sent ?? []).toHaveLength(0);
      expect(ctx.mailer.outbox.filter((m) => m.to.endsWith("@stand-in.invalid"))).toHaveLength(0);
    });
  });

  describe("photos and the AI pre-fill", () => {
    it("signs an upload into the stand-in's own listing folder", async () => {
      const res = await call("POST", `/v1/admin/stand-ins/${standIn.id}/uploads`, admin.token, {
        contentType: "image/jpeg",
        byteSize: 500_000,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().key.startsWith(`listings/${standIn.id}/`)).toBe(true);
      expect(
        (
          await call("POST", `/v1/admin/stand-ins/${standIn.id}/uploads`, admin.token, {
            contentType: "image/jpeg",
            byteSize: 20_000_000,
          })
        ).statusCode,
      ).toBe(400);
    });

    it("is a 404 for anyone who is not a stand-in", async () => {
      const res = await call("POST", `/v1/admin/stand-ins/${regular.id}/uploads`, admin.token, {
        contentType: "image/jpeg",
        byteSize: 500,
      });
      expect(res.statusCode).toBe(404);
    });

    it("suggests from the photos and counts the call as its own action", async () => {
      const key = `listings/${standIn.id}/suggest-${stamp}.jpg`;
      const res = await call("POST", `/v1/admin/stand-ins/${standIn.id}/suggest`, admin.token, {
        photoKeys: [key],
        language: "en",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().categories).toHaveLength(1);
      expect(res.json().colourIds).toHaveLength(1);
      const rows = await db().select().from(aiCalls).where(eq(aiCalls.userId, admin.id));
      expect(rows.map((r) => r.action)).toContain("admin_upload_photo_check");
      expect(rows.map((r) => r.action)).not.toContain("photo_check");
    });

    it("refuses photos from another folder", async () => {
      const res = await call("POST", `/v1/admin/stand-ins/${standIn.id}/suggest`, admin.token, {
        photoKeys: [`listings/${regular.id}/x.jpg`],
        language: "en",
      });
      expect(res.statusCode).toBe(400);
    });

    it("answers with an empty suggestion, not an error, when the AI switch is off", async () => {
      await call("PUT", "/v1/admin/switches/ai", admin.token, { enabled: false });
      const before = reader.calls.length;
      const res = await call("POST", `/v1/admin/stand-ins/${standIn.id}/suggest`, admin.token, {
        photoKeys: [`listings/${standIn.id}/off-${stamp}.jpg`],
        language: "en",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ categories: [], brand: null, colourIds: [] });
      expect(reader.calls.length).toBe(before);
      await call("PUT", "/v1/admin/switches/ai", admin.token, { enabled: true });
    });
  });

  describe("batch publish, list and export", () => {
    let listingIds: string[] = [];
    let batchId = "";

    it("creates active listings for the stand-in and reports every item", async () => {
      const items = [
        completeItem(`Silk shirt ${stamp}`, 1),
        completeItem(`Wool coat ${stamp}`, 2, { ownerFullName: OTHER_OWNER }),
        // Not valid: no price floor reached, and no size.
        completeItem(`Broken ${stamp}`, 3, { priceMinor: 1, sizeId: null }),
      ];
      const res = await call("POST", `/v1/admin/stand-ins/${standIn.id}/listings`, admin.token, {
        ownerFullName: OWNER,
        items,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      batchId = body.batchId;
      expect(body).toMatchObject({ username: standIn.username, createdCount: 2, failedCount: 1 });
      expect(body.results.map((r: { ok: boolean }) => r.ok)).toEqual([true, true, false]);
      expect(body.results.map((r: { clientId: string }) => r.clientId)).toEqual(["row-1", "row-2", "row-3"]);
      expect(body.results[2].fields).toMatchObject({
        priceMinor: "validation.listing.price.tooLow",
        sizeId: "validation.listing.size.required",
      });
      listingIds = body.results
        .filter((r: { ok: boolean }) => r.ok)
        .map((r: { listingId: string }) => r.listingId);

      const rows = await db().select().from(listings).where(inArray(listings.id, listingIds));
      expect(rows.every((r) => r.sellerId === standIn.id && r.status === "active" && r.publishedAt)).toBe(
        true,
      );
      const uploads = await db()
        .select()
        .from(adminUploads)
        .where(inArray(adminUploads.listingId, listingIds));
      expect(uploads.map((u) => u.ownerFullName).sort()).toEqual([OTHER_OWNER, OWNER].sort());
      expect(uploads.every((u) => u.batchId === batchId && u.uploadedBy === admin.id)).toBe(true);
      const [profile] = await db().select().from(profiles).where(eq(profiles.userId, standIn.id));
      expect(profile?.activeListingCount).toBe(2);

      const audits = (
        await db().select().from(adminActions).where(eq(adminActions.adminUserId, admin.id))
      ).filter((a) => a.action === "uploads_published");
      expect(audits).toHaveLength(1);
      expect(audits[0]?.details).toMatchObject({ username: standIn.username, batchId, count: 2, failed: 1 });
    });

    it("refuses an empty batch, a batch over 50 and a missing owner name", async () => {
      const url = `/v1/admin/stand-ins/${standIn.id}/listings`;
      expect((await call("POST", url, admin.token, { ownerFullName: OWNER, items: [] })).statusCode).toBe(
        400,
      );
      const many = Array.from({ length: 51 }, (_, i) => completeItem("Too many", 100 + i));
      expect((await call("POST", url, admin.token, { ownerFullName: OWNER, items: many })).statusCode).toBe(
        400,
      );
      expect(
        (await call("POST", url, admin.token, { items: [completeItem("No owner", 9)] })).statusCode,
      ).toBe(400);
      expect(ERROR_CODES).toContain("validation_failed");
    });

    it("refuses photos from another folder for one item without stopping the rest", async () => {
      const res = await call("POST", `/v1/admin/stand-ins/${standIn.id}/listings`, admin.token, {
        ownerFullName: OWNER,
        items: [
          completeItem(`Stolen photo ${stamp}`, 20, {
            photos: [{ key: `listings/${regular.id}/other.jpg`, width: 900, height: 1200 }],
          }),
          completeItem(`Fine ${stamp}`, 21),
        ],
      });
      expect(res.json().results.map((r: { ok: boolean }) => r.ok)).toEqual([false, true]);
      listingIds.push(res.json().results[1].listingId);
    });

    it("lists uploaded items with filters and a cursor, owner names included", async () => {
      const all = (await call("GET", `/v1/admin/uploads?standInId=${standIn.id}`, admin.token)).json();
      expect(all.items).toHaveLength(3);
      expect(all.items[0]).toMatchObject({
        username: standIn.username,
        status: "active",
        soldAt: null,
        saleTotalMinor: null,
        priceMinor: 12000,
      });
      expect(all.items.map((i: { ownerFullName: string }) => i.ownerFullName)).toContain(OTHER_OWNER);
      expect(all.items[0].categoryPath.en).toContain(">");

      const owner = (
        await call("GET", `/v1/admin/uploads?owner=${encodeURIComponent("mordecai")}`, admin.token)
      ).json();
      expect(owner.items.every((i: { ownerFullName: string }) => i.ownerFullName === OTHER_OWNER)).toBe(true);
      expect(owner.items.length).toBeGreaterThanOrEqual(1);

      const sold = (
        await call("GET", `/v1/admin/uploads?standInId=${standIn.id}&status=sold`, admin.token)
      ).json();
      expect(sold.items).toHaveLength(0);

      const page1 = (
        await call("GET", `/v1/admin/uploads?standInId=${standIn.id}&limit=2`, admin.token)
      ).json();
      expect(page1.items).toHaveLength(2);
      const page2 = (
        await call(
          "GET",
          `/v1/admin/uploads?standInId=${standIn.id}&limit=2&cursor=${page1.nextCursor}`,
          admin.token,
        )
      ).json();
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0].listingId).not.toBe(page1.items[0].listingId);
    });

    it("never puts the owner name in a public answer", async () => {
      const id = listingIds[0] as string;
      const answers = [
        await call("GET", `/v1/listings/${id}`),
        await call("GET", `/v1/listings/${id}`, buyer.token),
        await call("GET", `/v1/listings/${id}`, admin.token),
        await call("GET", `/v1/listings/${id}/similar`),
        await call("GET", `/v1/users/${standIn.id}`),
        await call("GET", `/v1/users/${standIn.id}/listings`),
        await call("GET", `/v1/users/${standIn.id}/listings?status=sold`),
        await call("GET", `/v1/listings?q=${encodeURIComponent(`Silk shirt ${stamp}`)}`),
        await call("GET", `/v1/listings?sellerId=${standIn.id}`),
        await call("GET", `/v1/users?q=${encodeURIComponent(standIn.username.slice(0, 8))}`),
        await call("GET", "/v1/feed"),
      ];
      for (const answer of answers) {
        expect(answer.statusCode).toBeLessThan(500);
        const text = answer.body.toLowerCase();
        expect(text).not.toContain("quxbert");
        expect(text).not.toContain("pfeffer");
        expect(text).not.toContain("ownerfullname");
        expect(text).not.toContain("owner_full_name");
      }
      // The item itself is really public and shows the username.
      const detail = (await call("GET", `/v1/listings/${id}`)).json();
      expect(detail.seller.username).toBe(standIn.username);
    });

    it("exports a real Excel file with the filters and writes an audit row", async () => {
      // Make one item sold with an order, so the sold columns are filled.
      const soldId = listingIds[0] as string;
      const soldAt = new Date();
      await db().update(listings).set({ status: "sold", soldAt }).where(eq(listings.id, soldId));
      const [order] = await db()
        .insert(orders)
        .values({
          buyerId: buyer.id,
          sellerId: standIn.id,
          status: "completed",
          itemsSubtotalMinor: 12000,
          totalMinor: 13250,
          sellerEarningsMinor: 12000,
        })
        .returning({ id: orders.id });
      await db()
        .insert(orderItems)
        .values({
          orderId: (order as { id: string }).id,
          listingId: soldId,
          priceMinor: 12000,
          titleSnapshot: "Silk shirt",
        });

      const res = await ctx.app.inject({
        method: "GET",
        url: `/v1/admin/uploads/export.xlsx?standInId=${standIn.id}`,
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      expect(res.headers["content-disposition"]).toMatch(
        /^attachment; filename="vinty-uploads-\d{4}-\d{2}-\d{2}\.xlsx"$/,
      );

      const book = new ExcelJS.Workbook();
      await book.xlsx.load(res.rawPayload as unknown as ArrayBuffer);
      const sheet = book.worksheets[0] as ExcelJS.Worksheet;
      const header = (sheet.getRow(1).values as unknown[]).slice(1);
      expect(header).toEqual([
        "Uploaded on",
        "Batch",
        "Owner full name",
        "Shown as (username)",
        "Item",
        "Category",
        "Brand",
        "Size",
        "Condition",
        "Price (₪)",
        "Status",
        "Sold on",
        "Sale total (₪)",
        "Link",
      ]);
      expect(sheet.getRow(1).font?.bold).toBe(true);
      expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
      expect(sheet.rowCount).toBe(4);
      const rows = Array.from({ length: 3 }, (_, i) => sheet.getRow(i + 2));
      const soldRow = rows.find((r) => r.getCell(11).value === "sold") as ExcelJS.Row;
      expect(soldRow.getCell(3).value).toMatch(/Zelda Quxbert|Mordecai Pfeffer/);
      expect(soldRow.getCell(4).value).toBe(standIn.username);
      expect(soldRow.getCell(10).value).toBe(120);
      expect(soldRow.getCell(13).value).toBe(132.5);
      expect(soldRow.getCell(12).value).toBeInstanceOf(Date);
      const link = soldRow.getCell(14).value as { hyperlink: string };
      expect(link.hyperlink).toContain(`/en/item/${soldId}`);

      // Filters apply to the file too.
      const onlyOther = await ctx.app.inject({
        method: "GET",
        url: `/v1/admin/uploads/export.xlsx?owner=mordecai`,
        headers: { authorization: `Bearer ${admin.token}` },
      });
      const book2 = new ExcelJS.Workbook();
      await book2.xlsx.load(onlyOther.rawPayload as unknown as ArrayBuffer);
      expect(book2.worksheets[0]?.rowCount).toBe(2);

      const audit = (
        await db().select().from(adminActions).where(eq(adminActions.adminUserId, admin.id))
      ).find((a) => a.action === "uploads_exported");
      expect(audit).toBeDefined();

      // The sold item shows in the list with the date and the order total.
      const listed = (
        await call("GET", `/v1/admin/uploads?standInId=${standIn.id}&status=sold`, admin.token)
      ).json();
      expect(listed.items).toHaveLength(1);
      expect(listed.items[0]).toMatchObject({ status: "sold", saleTotalMinor: 13250 });
      expect(listed.items[0].soldAt).toEqual(expect.any(String));
    });
  });
});
