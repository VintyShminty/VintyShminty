import { adminActions, aiCalls, listings, profiles, reports, users } from "@vinty/db";
import type { AdminReviewItem, AdminReviewPage, CategoryNode, ReferenceData } from "@vinty/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { settleBackground } from "../lib/background.js";
import { fakeListingCheckReader, type RawListingCheck } from "../lib/listing-check.js";
import { createReportSorter, fakeReportSortReader, type RawReportSort } from "../lib/report-sort.js";
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

// Runs only when DATABASE_URL points at a migrated and seeded local database (pnpm db:reset).
describe.skipIf(!databaseUrl)("admin Review list: AI listing check, report sorting, actions", () => {
  let ctx: TestContext;
  let call: ReturnType<typeof apiCaller>;
  const createdIds: string[] = [];
  let admin: TestPerson;
  let seller: TestPerson;
  let reporter: TestPerson;
  let reference: ReferenceData;
  let sized: CategoryNode;
  let brandId: string;
  const stamp = Date.now().toString(36);
  const listingIds: string[] = [];
  const db = () => ctx.database.db;

  // What the fake models answer. A test changes these before it acts.
  let checkAnswer: RawListingCheck = { flags: [] };
  let checkBroken = false;
  let sortAnswer: RawReportSort = {
    reason: "counterfeit",
    urgency: "high",
    summary: "Looks like a fake bag.",
  };
  let sortBroken = false;
  const checkReader = fakeListingCheckReader(() => {
    if (checkBroken) throw new Error("model down");
    return checkAnswer;
  });
  const sortReader = fakeReportSortReader(() => {
    if (sortBroken) throw new Error("model down");
    return sortAnswer;
  });

  const leaves = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes.flatMap((n) => (n.isLeaf ? [n] : leaves(n.children)));
  let photoCounter = 0;
  const photo = (userId: string) => {
    photoCounter += 1;
    return { key: `listings/${userId}/rev-${stamp}-${photoCounter}.jpg`, width: 900, height: 1200 };
  };
  const listingPayload = (title: string, publish: boolean) => {
    const group = reference.sizeGroups.find((g) => sized.sizeGroupIds.includes(g.id));
    return {
      title,
      description: "A nice bag",
      categoryId: sized.id,
      brandId,
      sizeId: group?.sizes[0]?.id,
      conditionId: reference.conditions[0]?.id,
      colourIds: [reference.colours[0]?.id],
      priceMinor: 15000,
      parcelSizeId: reference.parcelSizes[0]?.id,
      photos: [photo(seller.id), photo(seller.id), photo(seller.id)],
      publish,
    };
  };
  async function createListing(title: string, publish = true) {
    const res = await call("POST", "/v1/listings", seller.token, listingPayload(title, publish));
    expect(res.statusCode, res.body).toBe(201);
    const id = (res.json() as { id: string }).id;
    listingIds.push(id);
    await settleBackground();
    return id;
  }
  const aiRows = (listingId: string) =>
    db()
      .select()
      .from(reports)
      .where(and(eq(reports.targetId, listingId), eq(reports.source, "ai_check")));

  beforeAll(async () => {
    ctx = await buildTestApp(
      {},
      {
        listingCheckReader: checkReader,
        reportSortReader: sortReader,
        storage: { ...fakeStorage, read: async () => Buffer.from("jpeg") },
      },
    );
    call = apiCaller(ctx);
    [admin, seller, reporter] = await Promise.all([
      signUpTestUser(ctx, "rvadm", createdIds),
      signUpTestUser(ctx, "rvsel", createdIds),
      signUpTestUser(ctx, "rvrep", createdIds),
    ]);
    await db().update(users).set({ role: "admin" }).where(eq(users.id, admin.id));
    reference = (await call("GET", "/v1/reference")).json() as ReferenceData;
    sized = leaves(reference.categories).find(
      (c) => c.rules.size === "required" && c.rules.brand !== "hidden" && c.sizeGroupIds.length > 0,
    ) as CategoryNode;
    brandId = (await call("GET", "/v1/brands?limit=1")).json().items[0].id;
  });

  afterAll(async () => {
    await settleBackground();
    await db()
      .delete(reports)
      .where(inArray(reports.targetId, [...listingIds, ...createdIds]));
    await db().delete(aiCalls).where(inArray(aiCalls.userId, createdIds));
    await db().delete(adminActions).where(inArray(adminActions.adminUserId, createdIds));
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  describe("the AI listing check", () => {
    let live: string;

    it("flags a listing after it goes live with one row for the admin, and the listing stays live", async () => {
      checkAnswer = {
        flags: [
          { kind: "misleading", urgency: "normal", summary: "Photos show shoes." },
          { kind: "counterfeit", urgency: "high", summary: "Says 'AAA replica' at 150 ILS." },
          { kind: "bogus", urgency: "high", summary: "dropped" },
        ],
      };
      live = await createListing(`Louis bag ${stamp}`);
      const rows = await aiRows(live);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        reporterId: null,
        reason: "counterfeit",
        aiReason: "counterfeit",
        urgency: "high",
        status: "open",
        aiSummary: "Says 'AAA replica' at 150 ILS. Photos show shoes.",
      });
      const [listing] = await db().select().from(listings).where(eq(listings.id, live));
      expect(listing?.status).toBe("active");

      // The model got the words, the category path, the brand and at most two photos.
      const input = checkReader.calls.at(-1);
      expect(input).toMatchObject({ title: `Louis bag ${stamp}`, priceMinor: 15000, userId: seller.id });
      expect(input?.category?.length).toBeGreaterThan(0);
      expect(input?.images).toHaveLength(2);
    });

    it("checks again after an edit of the words, and updates the open row instead of adding one", async () => {
      checkAnswer = {
        flags: [{ kind: "scam_off_platform", urgency: "normal", summary: "Asks for WhatsApp." }],
      };
      const before = checkReader.calls.length;
      const res = await call("PATCH", `/v1/listings/${live}`, seller.token, {
        description: "Write me on WhatsApp",
      });
      expect(res.statusCode, res.body).toBe(200);
      await settleBackground();
      expect(checkReader.calls.length).toBe(before + 1);
      const rows = await aiRows(live);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        reason: "scam_off_platform",
        urgency: "normal",
        aiSummary: "Asks for WhatsApp.",
      });
    });

    it("does not check again for a price change, and leaves the open row alone when a later check finds nothing", async () => {
      const before = checkReader.calls.length;
      expect(
        (await call("PATCH", `/v1/listings/${live}`, seller.token, { priceMinor: 9000 })).statusCode,
      ).toBe(200);
      await settleBackground();
      expect(checkReader.calls.length).toBe(before);

      checkAnswer = { flags: [] };
      expect(
        (await call("PATCH", `/v1/listings/${live}`, seller.token, { title: `Plain bag ${stamp}` }))
          .statusCode,
      ).toBe(200);
      await settleBackground();
      expect(checkReader.calls.length).toBe(before + 1);
      const rows = await aiRows(live);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.reason).toBe("scam_off_platform");
    });

    it("checks again when the first photos change, but not when a later photo does", async () => {
      checkAnswer = { flags: [] };
      const before = checkReader.calls.length;
      const [row] = await db().select().from(listings).where(eq(listings.id, live));
      expect(row).toBeTruthy();
      const detail = (await call("GET", `/v1/me/listings/${live}`, seller.token)).json() as {
        photos: { key: string; width: number; height: number }[];
      };
      const keep = detail.photos.map((p) => ({ key: p.key, width: p.width, height: p.height }));
      // Only the third photo is swapped.
      const swappedLast = [...keep.slice(0, 2), photo(seller.id)];
      expect(
        (await call("PUT", `/v1/listings/${live}/photos`, seller.token, { photos: swappedLast })).statusCode,
      ).toBe(200);
      await settleBackground();
      expect(checkReader.calls.length).toBe(before);
      // The first photo is swapped.
      const swappedFirst = [photo(seller.id), ...swappedLast.slice(1)];
      expect(
        (await call("PUT", `/v1/listings/${live}/photos`, seller.token, { photos: swappedFirst })).statusCode,
      ).toBe(200);
      await settleBackground();
      expect(checkReader.calls.length).toBe(before + 1);
    });

    it("does not check drafts, checks when a draft is published, and never fails the seller's request", async () => {
      checkAnswer = { flags: [{ kind: "prohibited_item", urgency: "high", summary: "Sells a knife." }] };
      const before = checkReader.calls.length;
      const draft = await createListing(`Draft ${stamp}`, false);
      expect(checkReader.calls.length).toBe(before);
      expect(
        (await call("PATCH", `/v1/listings/${draft}`, seller.token, { title: `Draft two ${stamp}` }))
          .statusCode,
      ).toBe(200);
      await settleBackground();
      expect(checkReader.calls.length).toBe(before);
      expect(await aiRows(draft)).toHaveLength(0);

      expect((await call("POST", `/v1/listings/${draft}/publish`, seller.token)).statusCode).toBe(200);
      await settleBackground();
      expect(checkReader.calls.length).toBe(before + 1);
      expect((await aiRows(draft))[0]).toMatchObject({ reason: "prohibited_item", urgency: "high" });

      checkBroken = true;
      const quiet = await createListing(`Quiet ${stamp}`);
      checkBroken = false;
      expect(await aiRows(quiet)).toHaveLength(0);
      const [row] = await db().select().from(listings).where(eq(listings.id, quiet));
      expect(row?.status).toBe("active");
    });

    it("is counted in the AI cost log under listing_check", async () => {
      const rows = await db()
        .select()
        .from(aiCalls)
        .where(and(eq(aiCalls.action, "listing_check"), eq(aiCalls.userId, seller.id)));
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe("report sorting", () => {
    let target: string;
    it("fills the AI fields of a member report from the listing", async () => {
      target = await createListing(`Reported bag ${stamp}`);
      await db().delete(reports).where(eq(reports.targetId, target));
      sortAnswer = { reason: "counterfeit", urgency: "high", summary: "Looks like a fake bag." };
      const res = await call("POST", "/v1/reports", reporter.token, {
        targetType: "listing",
        targetId: target,
        reason: "misleading",
        details: "Not real",
      });
      expect(res.statusCode).toBe(204);
      await settleBackground();
      const [row] = await db().select().from(reports).where(eq(reports.targetId, target));
      expect(row).toMatchObject({
        source: "member",
        reason: "misleading",
        aiReason: "counterfeit",
        urgency: "high",
        aiSummary: "Looks like a fake bag.",
      });
      const input = sortReader.calls.at(-1);
      expect(input).toMatchObject({ reason: "misleading", details: "Not real", userId: reporter.id });
      expect(input?.subject).toMatchObject({
        kind: "listing",
        title: `Reported bag ${stamp}`,
        priceMinor: 15000,
      });
    });

    it("sends a member's username and bio for a user report, and leaves the fields empty when the AI fails", async () => {
      await db().update(profiles).set({ bio: "Call me on 050" }).where(eq(profiles.userId, seller.id));
      sortBroken = true;
      expect(
        (
          await call("POST", "/v1/reports", reporter.token, {
            targetType: "user",
            targetId: seller.id,
            reason: "spam",
          })
        ).statusCode,
      ).toBe(204);
      await settleBackground();
      sortBroken = false;
      expect(sortReader.calls.at(-1)?.subject).toEqual({
        kind: "user",
        username: seller.username,
        bio: "Call me on 050",
      });
      const [row] = await db()
        .select()
        .from(reports)
        .where(and(eq(reports.targetId, seller.id), eq(reports.reporterId, reporter.id)));
      expect(row).toMatchObject({ aiReason: null, urgency: null, aiSummary: null, status: "open" });
    });

    it("sends nothing of a message, only the reason and the reporter's note", async () => {
      const [made] = await db()
        .insert(reports)
        .values({
          reporterId: reporter.id,
          targetType: "message",
          targetId: crypto.randomUUID(),
          reason: "harassment",
          details: "Insults me",
        })
        .returning({ id: reports.id });
      const sorter = createReportSorter(ctx.app, sortReader);
      await sorter({ reportId: (made as { id: string }).id, log: { info() {}, warn() {} } });
      const input = sortReader.calls.at(-1);
      expect(input?.subject).toEqual({ kind: "message" });
      expect(input?.details).toBe("Insults me");
      expect(Object.keys(input ?? {}).sort()).toEqual(["details", "reason", "signal", "subject", "userId"]);
      const [row] = await db()
        .select()
        .from(reports)
        .where(eq(reports.id, (made as { id: string }).id));
      expect(row?.urgency).toBe("high");
    });

    it("is counted in the AI cost log under report_sort", async () => {
      const rows = await db()
        .select()
        .from(aiCalls)
        .where(and(eq(aiCalls.action, "report_sort"), eq(aiCalls.userId, reporter.id)));
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe("the Review list", () => {
    let l1: string;
    let l2: string;
    const made: Record<string, string> = {};

    async function everything(status: "open" | "handled", limit = 2): Promise<AdminReviewItem[]> {
      const items: AdminReviewItem[] = [];
      let cursor: string | undefined;
      for (let i = 0; i < 200; i++) {
        const qs = `status=${status}&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
        const res = await call("GET", `/v1/admin/review?${qs}`, admin.token);
        expect(res.statusCode, res.body).toBe(200);
        const page = res.json() as AdminReviewPage;
        items.push(...page.items);
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      return items;
    }

    it("is closed to signed out people and to non admins", async () => {
      expect((await call("GET", "/v1/admin/review")).statusCode).toBe(401);
      expect((await call("GET", "/v1/admin/review", seller.token)).statusCode).toBe(403);
      const id = "11111111-1111-4111-8111-111111111111";
      expect(
        (await call("POST", `/v1/admin/review/${id}/action`, undefined, { action: "dismiss" })).statusCode,
      ).toBe(401);
      expect(
        (await call("POST", `/v1/admin/review/${id}/action`, seller.token, { action: "dismiss" })).statusCode,
      ).toBe(403);
    });

    it("lists open items most urgent first, newest first within a level, unsorted last, filled with the target", async () => {
      l1 = await createListing(`List one ${stamp}`);
      l2 = await createListing(`List two ${stamp}`);
      await db()
        .delete(reports)
        .where(inArray(reports.targetId, [l1, l2]));
      const now = Date.now();
      const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000);
      const add = async (name: string, over: Partial<typeof reports.$inferInsert>) => {
        const [row] = await db()
          .insert(reports)
          .values({ reporterId: reporter.id, targetType: "listing", targetId: l1, reason: "spam", ...over })
          .returning({ id: reports.id });
        made[name] = (row as { id: string }).id;
      };
      await add("normalOld", { urgency: "normal", createdAt: at(30) });
      await add("highOld", { urgency: "high", createdAt: at(20) });
      await add("low", { urgency: "low", createdAt: at(10) });
      await add("unsorted", { createdAt: at(1) });
      await add("highNew", {
        urgency: "high",
        createdAt: at(5),
        source: "ai_check",
        reporterId: null,
        reason: "counterfeit",
        aiReason: "counterfeit",
        aiSummary: "AI flag",
      });
      await add("other", { targetId: l2, urgency: "normal", createdAt: at(15) });

      const mine = new Set(Object.values(made));
      const ordered = (await everything("open")).filter((i) => mine.has(i.id)).map((i) => i.id);
      expect(ordered).toEqual([
        made.highNew,
        made.highOld,
        made.other,
        made.normalOld,
        made.low,
        made.unsorted,
      ] as string[]);

      const full = (await everything("open", 50)).filter((i) => mine.has(i.id));
      const byId = new Map(full.map((i) => [i.id, i]));
      const first = byId.get(made.highNew as string) as AdminReviewItem;
      expect(first).toMatchObject({
        source: "ai_check",
        reporter: null,
        aiSummary: "AI flag",
        otherOpenReports: 4,
      });
      expect(first.target).toMatchObject({
        kind: "listing",
        id: l1,
        title: `List one ${stamp}`,
        status: "active",
        priceMinor: 15000,
        currency: "ILS",
        seller: { id: seller.id, username: seller.username },
      });
      expect(first.target?.kind === "listing" && first.target.photoUrl).toMatch(
        /^http:\/\/storage\.test\/listings\//,
      );
      expect(byId.get(made.highOld as string)?.reporter).toEqual({
        id: reporter.id,
        username: reporter.username,
      });
      expect(byId.get(made.other as string)?.otherOpenReports).toBe(0);

      const page = (
        await call("GET", "/v1/admin/review?status=open&limit=1", admin.token)
      ).json() as AdminReviewPage;
      expect(page.openCount).toBeGreaterThanOrEqual(6);
      expect(page.openHighCount).toBeGreaterThanOrEqual(2);
      expect(page.items[0]?.urgency).toBe("high");
    });

    it("hides a listing, closes every open report about it, writes an audit row, and answers 409 the second time", async () => {
      const res = await call("POST", `/v1/admin/review/${made.highNew}/action`, admin.token, {
        action: "hide_listing",
        note: "Fake bag",
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toMatchObject({
        id: made.highNew,
        status: "actioned",
        resolutionNote: "Fake bag",
        otherOpenReports: 0,
      });
      const [listing] = await db().select().from(listings).where(eq(listings.id, l1));
      expect(listing).toMatchObject({ status: "hidden", statusReason: "Fake bag" });
      // The seller cannot put a listing our team hid back live, but a listing they hid themselves they can.
      const unhide = await call("PATCH", `/v1/listings/${l1}/status`, seller.token, { status: "active" });
      expect(unhide.statusCode).toBe(409);
      expect(unhide.json()).toMatchObject({ error: { code: "invalid_transition" } });
      const rows = await db().select().from(reports).where(eq(reports.targetId, l1));
      expect(rows.length).toBe(5);
      expect(rows.every((r) => r.status === "actioned" && r.handledById === admin.id && r.handledAt)).toBe(
        true,
      );
      const audit = await db()
        .select()
        .from(adminActions)
        .where(eq(adminActions.targetId, made.highNew as string))
        .orderBy(desc(adminActions.createdAt));
      expect(audit[0]).toMatchObject({
        adminUserId: admin.id,
        action: "review_hide_listing",
        targetType: "report",
      });

      expect(
        (await call("POST", `/v1/admin/review/${made.highNew}/action`, admin.token, { action: "dismiss" }))
          .statusCode,
      ).toBe(409);
      expect(
        (await call("POST", `/v1/admin/review/${made.highOld}/action`, admin.token, { action: "handled" }))
          .statusCode,
      ).toBe(409);
    });

    it("removes a listing, and refuses to hide or remove something that is not a listing", async () => {
      const removed = await call("POST", `/v1/admin/review/${made.other}/action`, admin.token, {
        action: "remove_listing",
      });
      expect(removed.statusCode, removed.body).toBe(200);
      const [listing] = await db().select().from(listings).where(eq(listings.id, l2));
      expect(listing).toMatchObject({ status: "removed", statusReason: "spam" });

      const [userReport] = await db()
        .insert(reports)
        .values({
          reporterId: reporter.id,
          targetType: "user",
          targetId: seller.id,
          reason: "harassment",
          urgency: "high",
        })
        .returning({ id: reports.id });
      const id = (userReport as { id: string }).id;
      expect(
        (await call("POST", `/v1/admin/review/${id}/action`, admin.token, { action: "hide_listing" }))
          .statusCode,
      ).toBe(400);
      expect(
        (await call("POST", `/v1/admin/review/${id}/action`, admin.token, { action: "remove_listing" }))
          .statusCode,
      ).toBe(400);
      expect((await db().select().from(reports).where(eq(reports.id, id)))[0]?.status).toBe("open");

      // A reserved listing has an order in progress, so it is left alone.
      await db().update(listings).set({ status: "reserved" }).where(eq(listings.id, l1));
      const [onReserved] = await db()
        .insert(reports)
        .values({ reporterId: reporter.id, targetType: "listing", targetId: l1, reason: "counterfeit" })
        .returning({ id: reports.id });
      const reservedId = (onReserved as { id: string }).id;
      expect(
        (await call("POST", `/v1/admin/review/${reservedId}/action`, admin.token, { action: "hide_listing" }))
          .statusCode,
      ).toBe(409);
      expect((await db().select().from(listings).where(eq(listings.id, l1)))[0]?.status).toBe("reserved");
      await db().update(reports).set({ status: "dismissed" }).where(eq(reports.id, reservedId));
      await db().update(listings).set({ status: "hidden" }).where(eq(listings.id, l1));

      const item = (
        await call("POST", `/v1/admin/review/${id}/action`, admin.token, { action: "dismiss", note: "Fine" })
      ).json() as AdminReviewItem;
      expect(item).toMatchObject({
        status: "dismissed",
        resolutionNote: "Fine",
        target: { kind: "user", username: seller.username },
      });
      made.userReport = id;
    });

    it("marks one item handled without touching the others, and lists handled items most recent first", async () => {
      const [a, b] = await Promise.all(
        [1, 2].map(async () => {
          const [row] = await db()
            .insert(reports)
            .values({
              reporterId: reporter.id,
              targetType: "user",
              targetId: admin.id,
              reason: "spam",
              urgency: "low",
            })
            .returning({ id: reports.id });
          return (row as { id: string }).id;
        }),
      );
      expect(
        (await call("POST", `/v1/admin/review/${a}/action`, admin.token, { action: "handled" })).statusCode,
      ).toBe(200);
      const rows = await db()
        .select()
        .from(reports)
        .where(inArray(reports.id, [a as string, b as string]));
      expect(rows.find((r) => r.id === a)?.status).toBe("actioned");
      expect(rows.find((r) => r.id === b)?.status).toBe("open");

      expect(
        (await call("POST", `/v1/admin/review/${b}/action`, admin.token, { action: "dismiss" })).statusCode,
      ).toBe(200);
      const handled = await everything("handled", 3);
      const ids = handled.map((i) => i.id);
      expect(ids.indexOf(b as string)).toBeLessThan(ids.indexOf(a as string));
      expect(handled.every((i) => i.status === "actioned" || i.status === "dismissed")).toBe(true);
      const open = (await everything("open", 50)).map((i) => i.id);
      expect(open).not.toContain(a);
      expect(
        (
          await call("POST", "/v1/admin/review/11111111-1111-4111-8111-111111111111/action", admin.token, {
            action: "handled",
          })
        ).statusCode,
      ).toBe(404);
    });
  });
});
