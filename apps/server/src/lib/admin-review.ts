import { listingPhotos, listings, messages, reports, reviews, users } from "@vinty/db";
import type {
  AdminReviewItem,
  AdminReviewPage,
  AdminReviewQuery,
  ReviewAction,
  ReviewTarget,
} from "@vinty/shared";
import { and, count, eq, inArray, type SQL, sql } from "drizzle-orm";
import { type Db, type Writer, writeAudit } from "./admin.js";
import { decodeCursor, encodeCursor } from "./cursor.js";
import { ApiError } from "./errors.js";
import { tsText } from "./keyset.js";
import { refreshSellerCounts } from "./listings.js";
import type { Storage } from "./storage.js";

/** Waiting for a look. A report being looked at ("reviewing") still counts as waiting. */
const OPEN_STATUSES = ["open", "reviewing"] as const;
const HANDLED_STATUSES = ["actioned", "dismissed"] as const;

/** high first, then normal, low, and the ones the AI has not sorted last. */
const urgencyRank = sql<number>`case ${reports.urgency} when 'high' then 0 when 'normal' then 1 when 'low' then 2 else 3 end`;
/** When a handled report was dealt with. Falls back to its last change for rows without a handled time. */
const handledAtOf = sql`coalesce(${reports.handledAt}, ${reports.updatedAt})`;

const TS_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Cursor = { r?: unknown; t?: unknown; id?: unknown };
function readCursor(raw: string | undefined) {
  const c = decodeCursor<Cursor>(raw);
  if (!c || typeof c.t !== "string" || typeof c.id !== "string") return null;
  if (!TS_SHAPE.test(c.t) || !UUID_SHAPE.test(c.id)) return null;
  const r = typeof c.r === "number" && Number.isInteger(c.r) && c.r >= 0 && c.r <= 3 ? c.r : null;
  return { r, t: c.t, id: c.id };
}

type Person = { id: string; username: string };

async function loadTargets(db: Db, storage: Storage, rows: { targetType: string; targetId: string }[]) {
  const idsOf = (type: string) => [
    ...new Set(rows.filter((r) => r.targetType === type).map((r) => r.targetId)),
  ];
  const targets = new Map<string, ReviewTarget>();
  const key = (type: string, id: string) => `${type}:${id}`;

  const listingIds = idsOf("listing");
  if (listingIds.length > 0) {
    const found = await db
      .select({
        id: listings.id,
        title: listings.title,
        status: listings.status,
        priceMinor: listings.priceMinor,
        currency: listings.currency,
        sellerId: listings.sellerId,
        sellerName: users.username,
        photoKey: listingPhotos.objectKey,
        cardKey: listingPhotos.cardObjectKey,
      })
      .from(listings)
      .innerJoin(users, eq(users.id, listings.sellerId))
      .leftJoin(listingPhotos, and(eq(listingPhotos.listingId, listings.id), eq(listingPhotos.position, 0)))
      .where(inArray(listings.id, listingIds));
    for (const l of found) {
      const photoKey = l.cardKey ?? l.photoKey;
      targets.set(key("listing", l.id), {
        kind: "listing",
        id: l.id,
        title: l.title,
        status: l.status,
        photoUrl: photoKey ? storage.publicUrl(photoKey) : null,
        priceMinor: l.priceMinor,
        currency: l.currency,
        seller: { id: l.sellerId, username: l.sellerName ?? "" },
      });
    }
  }

  const userIds = idsOf("user");
  if (userIds.length > 0) {
    const found = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const u of found)
      targets.set(key("user", u.id), { kind: "user", id: u.id, username: u.username ?? "" });
  }

  // Who wrote a message or a review. The text is never read here (the privacy policy does not allow reading chats).
  const messageIds = idsOf("message");
  if (messageIds.length > 0) {
    const found = await db
      .select({ id: messages.id, authorId: messages.senderId, username: users.username })
      .from(messages)
      .innerJoin(users, eq(users.id, messages.senderId))
      .where(inArray(messages.id, messageIds));
    for (const m of found) {
      targets.set(key("message", m.id), {
        kind: "message",
        id: m.id,
        author: { id: m.authorId as string, username: m.username ?? "" },
      });
    }
  }
  const reviewIds = idsOf("review");
  if (reviewIds.length > 0) {
    const found = await db
      .select({ id: reviews.id, authorId: reviews.reviewerId, username: users.username })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.reviewerId))
      .where(inArray(reviews.id, reviewIds));
    for (const r of found) {
      targets.set(key("review", r.id), {
        kind: "review",
        id: r.id,
        author: { id: r.authorId, username: r.username ?? "" },
      });
    }
  }
  return (type: string, id: string) => targets.get(key(type, id)) ?? null;
}

/** How many open reports each (type, id) pair has, so a pile up shows. */
async function openCountsFor(db: Db, rows: { targetType: string; targetId: string }[]) {
  const counts = new Map<string, number>();
  if (rows.length === 0) return counts;
  const found = await db
    .select({ type: reports.targetType, id: reports.targetId, n: count() })
    .from(reports)
    .where(
      and(
        inArray(reports.status, [...OPEN_STATUSES]),
        inArray(reports.targetId, [...new Set(rows.map((r) => r.targetId))]),
      ),
    )
    .groupBy(reports.targetType, reports.targetId);
  for (const f of found) counts.set(`${f.type}:${f.id}`, Number(f.n));
  return counts;
}

type ReportRow = typeof reports.$inferSelect;

function toItem(
  row: ReportRow,
  reporter: Person | null,
  target: ReviewTarget | null,
  otherOpenReports: number,
): AdminReviewItem {
  return {
    id: row.id,
    source: row.source,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    aiReason: row.aiReason,
    urgency: row.urgency,
    aiSummary: row.aiSummary,
    details: row.details,
    status: row.status,
    reporter,
    target,
    otherOpenReports,
    createdAt: row.createdAt.toISOString(),
    handledAt: row.handledAt ? row.handledAt.toISOString() : null,
    resolutionNote: row.resolutionNote,
  };
}

/** Fills reporter, target and the pile up count for a set of report rows, keeping their order. */
async function toItems(db: Db, storage: Storage, rows: ReportRow[]): Promise<AdminReviewItem[]> {
  if (rows.length === 0) return [];
  const reporterIds = [...new Set(rows.flatMap((r) => (r.reporterId ? [r.reporterId] : [])))];
  const reporters = new Map<string, Person>();
  if (reporterIds.length > 0) {
    const found = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, reporterIds));
    for (const u of found) reporters.set(u.id, { id: u.id, username: u.username ?? "" });
  }
  const [targetOf, openCounts] = await Promise.all([loadTargets(db, storage, rows), openCountsFor(db, rows)]);
  return rows.map((row) => {
    const total = openCounts.get(`${row.targetType}:${row.targetId}`) ?? 0;
    const selfOpen = (OPEN_STATUSES as readonly string[]).includes(row.status) ? 1 : 0;
    return toItem(
      row,
      row.reporterId ? (reporters.get(row.reporterId) ?? null) : null,
      targetOf(row.targetType, row.targetId),
      Math.max(0, total - selfOpen),
    );
  });
}

/**
 * The admin Review list (D-038). Open: most urgent first (high, normal, low, then the ones the AI has not sorted),
 * newest first within each. Handled: the most recently handled first. Keyset paging so a new report arriving between
 * pages never shifts the list.
 */
export async function listReview(
  db: Db,
  storage: Storage,
  query: AdminReviewQuery,
): Promise<AdminReviewPage> {
  const open = query.status === "open";
  const cursor = readCursor(query.cursor);
  const statuses = open ? OPEN_STATUSES : HANDLED_STATUSES;
  const timeColumn = open ? reports.createdAt : handledAtOf;
  let after: SQL | undefined;
  if (cursor) {
    const tuple = sql`(${timeColumn}, ${reports.id}) < (${cursor.t}::timestamptz, ${cursor.id}::uuid)`;
    after =
      open && cursor.r !== null
        ? sql`(${urgencyRank} > ${cursor.r} or (${urgencyRank} = ${cursor.r} and ${tuple}))`
        : tuple;
  }

  const found = await db
    .select({
      report: reports,
      rank: urgencyRank,
      cursorTs: tsText(timeColumn),
    })
    .from(reports)
    .where(and(inArray(reports.status, [...statuses]), after))
    .orderBy(
      ...(open
        ? [sql`${urgencyRank} asc`, sql`${reports.createdAt} desc`, sql`${reports.id} desc`]
        : [sql`${handledAtOf} desc`, sql`${reports.id} desc`]),
    )
    .limit(query.limit + 1);

  const page = found.slice(0, query.limit);
  const last = page.at(-1);
  const items = await toItems(
    db,
    storage,
    page.map((p) => p.report),
  );

  const [totals] = await db
    .select({
      open: count(),
      high: sql<number>`count(*) filter (where ${reports.urgency} = 'high')`,
    })
    .from(reports)
    .where(inArray(reports.status, [...OPEN_STATUSES]));

  return {
    items,
    nextCursor:
      found.length > query.limit && last
        ? encodeCursor({ ...(open ? { r: Number(last.rank) } : {}), t: last.cursorTs, id: last.report.id })
        : null,
    openCount: Number(totals?.open ?? 0),
    openHighCount: Number(totals?.high ?? 0),
  };
}

/** One item, filled the same way as in the list. */
export async function loadReviewItem(db: Db, storage: Storage, id: string): Promise<AdminReviewItem> {
  const [row] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (!row) throw ApiError.notFound("No such report");
  const [item] = await toItems(db, storage, [row]);
  return item as AdminReviewItem;
}

const ACTION_AUDIT: Record<ReviewAction, string> = {
  hide_listing: "review_hide_listing",
  remove_listing: "review_remove_listing",
  dismiss: "review_dismiss",
  handled: "review_handled",
};

/**
 * Listings an admin may hide (a hidden one stays hidden) and remove. A sold or draft listing is left alone, and so is a
 * reserved one: an order in progress needs the listing to stay reserved until it completes.
 */
const HIDEABLE = ["active", "hidden"];
const REMOVABLE = ["active", "hidden"];

/**
 * Applies an admin's decision to one Review item. Hiding or removing works only for a listing target and closes
 * every open report about it, dismiss and handled close just this one. Everything happens in one transaction together
 * with the audit row. Already handled is 409.
 */
export async function applyReviewAction(
  db: Db,
  adminId: string,
  id: string,
  action: ReviewAction,
  note: string | undefined,
): Promise<void> {
  let sellerId: string | null = null;
  await db.transaction(async (tx) => {
    const [report] = await tx.select().from(reports).where(eq(reports.id, id)).limit(1).for("update");
    if (!report) throw ApiError.notFound("No such report");
    if (!(OPEN_STATUSES as readonly string[]).includes(report.status)) {
      throw ApiError.conflict("This report has already been handled");
    }
    const listingAction = action === "hide_listing" || action === "remove_listing";
    if (listingAction && report.targetType !== "listing") {
      throw ApiError.invalid("Only a listing can be hidden or removed", { action: "not_a_listing" });
    }

    const details: Record<string, unknown> = { reportId: id, source: report.source, reason: report.reason };
    if (note) details.note = note;
    const closed = action === "dismiss" ? "dismissed" : "actioned";

    if (listingAction) {
      const [listing] = await tx
        .select({ id: listings.id, status: listings.status, sellerId: listings.sellerId })
        .from(listings)
        .where(eq(listings.id, report.targetId))
        .limit(1)
        .for("update");
      if (!listing) throw ApiError.conflict("This listing no longer exists. Use Mark handled");
      const next = action === "hide_listing" ? "hidden" : "removed";
      const allowed = action === "hide_listing" ? HIDEABLE : REMOVABLE;
      if (listing.status === "reserved") {
        throw ApiError.conflict(
          "This listing is reserved for a buyer. Wait for the order to finish, or cancel it first",
        );
      }
      if (!allowed.includes(listing.status)) {
        throw ApiError.conflict(`A ${listing.status} listing cannot be ${next}. Use Mark handled`);
      }
      sellerId = listing.sellerId;
      details.listingId = listing.id;
      details.from = listing.status;
      details.to = next;
      if (listing.status !== next) {
        await tx
          .update(listings)
          .set({
            status: next,
            statusReason: note || report.reason,
            reservedForUserId: null,
            reservedUntil: null,
          })
          .where(eq(listings.id, listing.id));
      }
      // The same decision closes every other open report about this listing.
      const others = await tx
        .update(reports)
        .set({
          status: "actioned",
          handledById: adminId,
          handledAt: sql`now()`,
          resolutionNote: note || null,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(reports.targetType, "listing"),
            eq(reports.targetId, listing.id),
            inArray(reports.status, [...OPEN_STATUSES]),
          ),
        )
        .returning({ id: reports.id });
      details.closedReports = others.length;
    } else {
      await tx
        .update(reports)
        .set({
          status: closed,
          handledById: adminId,
          handledAt: sql`now()`,
          resolutionNote: note || null,
          updatedAt: sql`now()`,
        })
        .where(eq(reports.id, id));
    }
    await writeAudit(tx as Writer, adminId, ACTION_AUDIT[action], "report", id, details);
  });
  if (sellerId) await refreshSellerCounts(db, sellerId);
}
