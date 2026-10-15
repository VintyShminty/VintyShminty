import { randomUUID } from "node:crypto";
import {
  adminUploads,
  listings,
  orderItems,
  orders,
  profiles,
  standInSellers,
  userSettings,
  users,
} from "@vinty/db";
import {
  type AdminListingItem,
  type AdminPublishResult,
  type AdminUploadRow,
  type AdminUploadsFilter,
  type AdminUploadsPage,
  type CreateStandInInput,
  categoryTrail,
  isReservedUsername,
  type ReferenceData,
  STAND_IN_EMAIL_DOMAIN,
  type StandIn,
} from "@vinty/shared";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import { type Db, isUniqueViolation, likePattern, writeAudit } from "./admin.js";
import { ApiError } from "./errors.js";
import { keysetCursor, olderThan, tsText } from "./keyset.js";
import type { createListingWriter } from "./listing-write.js";
import { refreshSellerCounts } from "./listings.js";

const iso = (value: Date | string) => new Date(value).toISOString();

// ---------------------------------------------------------------------------------------------------------------------
// Stand-in usernames

/** The stand-in with this id, or a 404. */
export async function findStandIn(db: Db, id: string): Promise<{ id: string; username: string }> {
  const [row] = await db
    .select({ id: users.id, username: users.username })
    .from(standInSellers)
    .innerJoin(users, eq(users.id, standInSellers.userId))
    .where(eq(standInSellers.userId, id))
    .limit(1);
  if (!row) throw ApiError.notFound("No such username");
  return { id: row.id, username: row.username ?? "" };
}

const STATUS_COUNTED = ["active", "reserved", "sold", "hidden"] as const;

/** Every stand-in username with its listing counts by status and the owner names on its items. Admins only. */
export async function listStandIns(db: Db): Promise<StandIn[]> {
  const people = await db
    .select({ user: users })
    .from(standInSellers)
    .innerJoin(users, eq(users.id, standInSellers.userId))
    .orderBy(desc(users.createdAt), desc(users.id));
  if (people.length === 0) return [];
  const ids = people.map((p) => p.user.id);
  const [counts, owners] = await Promise.all([
    db
      .select({ sellerId: listings.sellerId, status: listings.status, n: sql<number>`count(*)::int` })
      .from(listings)
      .where(inArray(listings.sellerId, ids))
      .groupBy(listings.sellerId, listings.status),
    db
      .selectDistinct({ sellerId: listings.sellerId, owner: adminUploads.ownerFullName })
      .from(adminUploads)
      .innerJoin(listings, eq(listings.id, adminUploads.listingId))
      .where(inArray(listings.sellerId, ids)),
  ]);
  return people.map(({ user }) => {
    const listingCounts = { active: 0, reserved: 0, sold: 0, hidden: 0 };
    for (const c of counts) {
      if (c.sellerId === user.id && (STATUS_COUNTED as readonly string[]).includes(c.status)) {
        listingCounts[c.status as (typeof STATUS_COUNTED)[number]] = c.n;
      }
    }
    return {
      id: user.id,
      username: user.displayUsername ?? user.username ?? "",
      displayName: user.name,
      createdAt: user.createdAt.toISOString(),
      listingCounts,
      ownerNames: owners
        .filter((o) => o.sellerId === user.id)
        .map((o) => o.owner)
        .sort((a, b) => a.localeCompare(b)),
    };
  });
}

/**
 * Makes a public seller for the team to upload clothes under. It is a real user with a profile and settings, so its
 * profile page and listing cards work like anyone's. It can never be signed into: no password row, no sign in method
 * (so Google and Apple cannot link to it either), an address ending in `@stand-in.invalid` that cannot receive mail,
 * email and push switched off, and lib/auth.ts refuses to create a session for anyone in `stand_in_sellers`.
 */
export async function createStandIn(db: Db, adminId: string, input: CreateStandInInput): Promise<StandIn> {
  const typed = input.username.trim();
  const lower = typed.toLowerCase();
  if (isReservedUsername(typed)) {
    throw ApiError.invalid("That username is reserved", { username: "validation.username.reserved" });
  }
  const taken = ApiError.invalid("That username is already taken", { username: "validation.username.taken" });
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = ${lower}`)
    .limit(1);
  if (existing) throw taken;

  const name = input.displayName?.trim() || typed;
  try {
    const user = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({
          name,
          email: `stand-in-${randomUUID()}@${STAND_IN_EMAIL_DOMAIN}`,
          emailVerified: false,
          username: lower,
          displayUsername: typed,
        })
        .returning();
      if (!row) throw new Error("The stand-in was not saved");
      await tx.insert(profiles).values({ userId: row.id });
      await tx
        .insert(userSettings)
        .values({ userId: row.id, language: "en", pushEnabled: false, emailEnabled: false });
      await tx.insert(standInSellers).values({ userId: row.id, createdBy: adminId });
      await writeAudit(tx, adminId, "stand_in_created", "user", row.id, { username: typed });
      return row;
    });
    return {
      id: user.id,
      username: typed,
      displayName: user.name,
      createdAt: user.createdAt.toISOString(),
      listingCounts: { active: 0, reserved: 0, sold: 0, hidden: 0 },
      ownerNames: [],
    };
  } catch (err) {
    // Two people creating the same name at once: the database's unique rule decides.
    if (isUniqueViolation(err)) throw taken;
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Batch publish

type ListingWriter = ReturnType<typeof createListingWriter>;

/** A small pool: runs `work` for every item, at most `limit` at once, results in the order of the items. */
async function inPool<T, R>(items: T[], limit: number, work: (item: T, index: number) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index] as T, index);
      }
    }),
  );
  return results;
}

/**
 * Creates every item as an ACTIVE listing owned by the stand-in, through the same checks and writes a seller's own
 * listing goes through (lib/listing-write.ts), plus an `admin_uploads` row with the private owner name. One bad item
 * never stops the others. One audit row for the whole batch.
 */
export async function publishBatch(input: {
  db: Db;
  writer: ListingWriter;
  reference: ReferenceData;
  adminId: string;
  standIn: { id: string; username: string };
  ownerFullName: string;
  items: AdminListingItem[];
  log: { warn: (o: object, m: string) => void };
  /** Called once for each listing that went live, after the batch is saved. */
  onPublished?: (listingId: string) => void;
}): Promise<AdminPublishResult> {
  const { db, writer, reference, adminId, standIn, ownerFullName, items, log, onPublished } = input;
  const batchId = randomUUID();
  const [profile] = await db
    .select({ city: profiles.city, countryCode: profiles.countryCode })
    .from(profiles)
    .where(eq(profiles.userId, standIn.id))
    .limit(1);

  const results = await inPool(
    items,
    3,
    async (item, index): Promise<AdminPublishResult["results"][number]> => {
      const base = { index, clientId: item.clientId ?? null };
      try {
        const category = findLeaf(reference, item.categoryId);
        const { merged, brandName, photos, photoSizes, photoVariants } = await writer.prepare(
          standIn.id,
          reference,
          {
            title: item.title,
            description: item.description ?? "",
            categoryId: item.categoryId,
            brandId: item.brandId ?? null,
            brandName: item.brandName ?? null,
            sizeId: item.sizeId ?? null,
            conditionId: item.conditionId ?? null,
            materialId: item.materialId ?? null,
            patternId: item.patternId ?? null,
            colourIds: item.colourIds ?? [],
            parcelSizeId:
              item.parcelSizeId ?? category?.defaultParcelSizeId ?? reference.parcelSizes[0]?.id ?? null,
            priceMinor: item.priceMinor,
            currency: item.currency ?? "ILS",
            usedAiPhotos: item.usedAiPhotos ?? false,
            photos: item.photos,
          },
          null,
          true,
        );
        const now = new Date();
        const listingId = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(listings)
            .values({
              sellerId: standIn.id,
              ...writer.columnsOf(merged, brandName),
              status: "active",
              publishedAt: now,
              bumpedAt: now,
              city: profile?.city ?? null,
              countryCode: profile?.countryCode ?? "IL",
            })
            .returning({ id: listings.id });
          const id = (row as { id: string }).id;
          await writer.writeColours(tx, id, merged.colourIds);
          if (photos) await writer.writePhotos(tx, id, photos, photoSizes, photoVariants);
          await tx.insert(adminUploads).values({
            listingId: id,
            ownerFullName: item.ownerFullName?.trim() || ownerFullName,
            uploadedBy: adminId,
            batchId,
          });
          return id;
        });
        return { ...base, ok: true, listingId, error: null, fields: null };
      } catch (err) {
        if (err instanceof ApiError) {
          return { ...base, ok: false, listingId: null, error: err.message, fields: err.fields ?? null };
        }
        log.warn({ err }, "an uploaded item could not be saved");
        return { ...base, ok: false, listingId: null, error: "Could not save this item", fields: null };
      }
    },
  );

  const createdCount = results.filter((r) => r.ok).length;
  if (createdCount > 0) await refreshSellerCounts(db, standIn.id);
  await writeAudit(db, adminId, "uploads_published", "stand_in", standIn.id, {
    username: standIn.username,
    batchId,
    count: createdCount,
    failed: results.length - createdCount,
  });
  for (const r of results) if (r.ok && r.listingId) onPublished?.(r.listingId);
  return {
    batchId,
    username: standIn.username,
    createdCount,
    failedCount: results.length - createdCount,
    results,
  };
}

function findLeaf(reference: ReferenceData, id: string) {
  const node = categoryTrail(reference.categories, id).at(-1);
  return node?.isLeaf ? node : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// The uploaded items list and the Excel export

/** The most rows one Excel file holds. */
export const EXPORT_MAX_ROWS = 10_000;

/** The order that paid for the item: the newest one that was not cancelled or refunded. Its total is what the buyer paid. */
const saleTotal = sql<number | null>`(
  select ${orders.totalMinor}
  from ${orders}
  inner join ${orderItems} on ${orderItems.orderId} = ${orders.id}
  where ${orderItems.listingId} = ${listings.id} and ${orders.status} not in ('cancelled', 'refunded')
  order by ${orders.createdAt} desc
  limit 1
)`;

function uploadsWhere(filter: AdminUploadsFilter) {
  return [
    filter.standInId ? eq(listings.sellerId, filter.standInId) : undefined,
    filter.owner ? ilike(adminUploads.ownerFullName, likePattern(filter.owner)) : undefined,
    filter.status !== "all" ? eq(listings.status, filter.status) : undefined,
  ];
}

const uploadColumns = () => ({
  upload: adminUploads,
  listing: listings,
  username: users.username,
  displayUsername: users.displayUsername,
  saleTotal,
  cursorTs: tsText(adminUploads.createdAt),
});

function toRow(
  r: {
    upload: typeof adminUploads.$inferSelect;
    listing: typeof listings.$inferSelect;
    username: string | null;
    displayUsername: string | null;
    saleTotal: number | null;
  },
  reference: ReferenceData,
): AdminUploadRow {
  const { upload, listing } = r;
  const trail = listing.categoryId ? categoryTrail(reference.categories, listing.categoryId) : [];
  let size: string | null = null;
  if (listing.sizeId) {
    for (const group of reference.sizeGroups) {
      const found = group.sizes.find((s) => s.id === listing.sizeId);
      if (found) size = found.label;
    }
  }
  const condition = reference.conditions.find((c) => c.id === listing.conditionId);
  return {
    listingId: listing.id,
    uploadedAt: iso(upload.createdAt),
    batchId: upload.batchId,
    ownerFullName: upload.ownerFullName,
    standInId: listing.sellerId,
    username: r.displayUsername ?? r.username,
    title: listing.title,
    categoryPath:
      trail.length > 0
        ? { en: trail.map((n) => n.name.en).join(" > "), he: trail.map((n) => n.name.he).join(" > ") }
        : null,
    brand: listing.brandName,
    size,
    condition: condition?.name ?? null,
    priceMinor: listing.priceMinor,
    currency: listing.currency,
    status: listing.status,
    soldAt: listing.soldAt ? iso(listing.soldAt) : null,
    saleTotalMinor: r.saleTotal === null || r.saleTotal === undefined ? null : Number(r.saleTotal),
  };
}

/** Uploaded items, newest first, with the filters of the page. Owner names are in these rows, so admins only. */
export async function listUploads(
  db: Db,
  reference: ReferenceData,
  filter: AdminUploadsFilter & { cursor?: string | undefined; limit: number },
): Promise<AdminUploadsPage> {
  const rows = await db
    .select(uploadColumns())
    .from(adminUploads)
    .innerJoin(listings, eq(listings.id, adminUploads.listingId))
    .innerJoin(users, eq(users.id, listings.sellerId))
    .where(
      and(...uploadsWhere(filter), olderThan(filter.cursor, adminUploads.createdAt, adminUploads.listingId)),
    )
    .orderBy(desc(adminUploads.createdAt), desc(adminUploads.listingId))
    .limit(filter.limit + 1);
  const page = rows.slice(0, filter.limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => toRow(r, reference)),
    nextCursor:
      rows.length > filter.limit && last ? keysetCursor(last.cursorTs, last.upload.listingId) : null,
  };
}

/** Every uploaded item that matches the filters (up to EXPORT_MAX_ROWS), newest first. */
export async function allUploads(
  db: Db,
  reference: ReferenceData,
  filter: AdminUploadsFilter,
): Promise<AdminUploadRow[]> {
  const rows = await db
    .select(uploadColumns())
    .from(adminUploads)
    .innerJoin(listings, eq(listings.id, adminUploads.listingId))
    .innerJoin(users, eq(users.id, listings.sellerId))
    .where(and(...uploadsWhere(filter)))
    .orderBy(desc(adminUploads.createdAt), desc(adminUploads.listingId))
    .limit(EXPORT_MAX_ROWS);
  return rows.map((r) => toRow(r, reference));
}

export const EXPORT_COLUMNS = [
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
] as const;

/** `yadii-uploads-YYYY-MM-DD.xlsx`, the date in UTC. */
export const exportFileName = (now = new Date()) => `yadii-uploads-${now.toISOString().slice(0, 10)}.xlsx`;

/** Shekels from agorot. Other currencies are written as a plain number too, the column says shekels for ILS items. */
const major = (minor: number | null) => (minor === null ? null : Math.round(minor) / 100);

/** A real .xlsx: a bold frozen header row, sensible widths, dates as dates, prices as numbers, a clickable link. */
export async function buildUploadsWorkbook(rows: AdminUploadRow[], siteBase: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Yadii admin";
  const sheet = workbook.addWorksheet("Uploaded items", { views: [{ state: "frozen", ySplit: 1 }] });
  const widths = [18, 38, 26, 22, 36, 38, 18, 12, 18, 12, 12, 18, 14, 52];
  sheet.columns = EXPORT_COLUMNS.map((header, i) => ({ header, width: widths[i] ?? 16 }));
  const head = sheet.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: "middle" };
  head.height = 22;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXPORT_COLUMNS.length } };

  for (const row of rows) {
    const link = siteBase ? `${siteBase}/en/item/${row.listingId}` : `/en/item/${row.listingId}`;
    const added = sheet.addRow([
      new Date(row.uploadedAt),
      row.batchId ?? "",
      row.ownerFullName,
      row.username ?? "",
      row.title,
      row.categoryPath?.en ?? "",
      row.brand ?? "",
      row.size ?? "",
      row.condition?.en ?? "",
      major(row.priceMinor),
      row.status,
      row.soldAt ? new Date(row.soldAt) : null,
      major(row.saleTotalMinor),
      { text: link, hyperlink: link },
    ]);
    added.getCell(14).font = { underline: true };
  }
  sheet.getColumn(1).numFmt = "yyyy-mm-dd hh:mm";
  sheet.getColumn(12).numFmt = "yyyy-mm-dd hh:mm";
  sheet.getColumn(10).numFmt = "#,##0.00";
  sheet.getColumn(13).numFmt = "#,##0.00";
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
