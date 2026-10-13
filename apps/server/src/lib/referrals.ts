import { randomInt } from "node:crypto";
import { type Database, orders, profiles, referrals, users, vouchers } from "@vinty/db";
import {
  DEFAULT_CURRENCY,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  type ReferralItem,
  type ReferralSummary,
  type Voucher,
} from "@vinty/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { loadSellerSummaries } from "./discovery.js";
import { ApiError } from "./errors.js";
import { notifyEvent } from "./event-notify.js";
import { isUniqueViolation } from "./offers.js";
import { DAY_MS, loadOrderSettings, type OrderSettings } from "./settings.js";

type Db = NonNullable<Database["db"]>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type App = Pick<FastifyInstance, "db" | "storage">;

/** Only a person who joined in the last 7 days and has not completed a purchase yet can use a friend's code. */
export const REDEEM_WINDOW_DAYS = 7;
/** A voucher stays usable for this long after it is issued. */
export const VOUCHER_VALID_DAYS = 90;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/** The person's own code. Made the first time it is needed, so people who joined before this feature get one too. */
export async function ensureInviteCode(db: Db, userId: string): Promise<string> {
  await db.insert(profiles).values({ userId }).onConflictDoNothing();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const [row] = await db
      .select({ code: profiles.inviteCode })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    if (row?.code) return row.code;
    try {
      await db
        .update(profiles)
        .set({ inviteCode: generateInviteCode() })
        .where(and(eq(profiles.userId, userId), isNull(profiles.inviteCode)));
    } catch (err) {
      // Someone else holds that code. Try another one.
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error("Could not make an invite code");
}

export const inviteLink = (baseUrl: string, code: string) => `${baseUrl.replace(/\/+$/, "")}/invite/${code}`;

type VoucherRow = typeof vouchers.$inferSelect;
export function presentVoucher(row: VoucherRow, now = new Date()): Voucher {
  const expired = row.status === "active" && row.expiresAt !== null && row.expiresAt <= now;
  return {
    id: row.id,
    source: row.source,
    amountMinor: row.amountMinor,
    currency: row.currency,
    minOrderMinor: row.minOrderMinor,
    status: expired ? "expired" : row.status,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function loadVouchers(db: Db, userId: string): Promise<Voucher[]> {
  const rows = await db
    .select()
    .from(vouchers)
    .where(eq(vouchers.userId, userId))
    .orderBy(desc(vouchers.createdAt))
    .limit(100);
  return rows.map((r) => presentVoucher(r));
}

/** Everything the Invite friends screen needs in one call. */
export async function loadReferralSummary(
  app: App,
  userId: string,
  baseUrl: string,
): Promise<ReferralSummary> {
  const { db } = app;
  const code = await ensureInviteCode(db, userId);
  const settings = await loadOrderSettings(db);
  const [mine, inviteeRow, voucherList, completed, [account]] = await Promise.all([
    db
      .select()
      .from(referrals)
      .where(eq(referrals.inviterId, userId))
      .orderBy(desc(referrals.createdAt))
      .limit(100),
    db.select().from(referrals).where(eq(referrals.inviteeId, userId)).limit(1),
    loadVouchers(db, userId),
    hasCompletedPurchase(db, userId),
    db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1),
  ]);
  const invitee = inviteeRow[0];
  const people = await loadSellerSummaries(app, [
    ...mine.map((r) => r.inviteeId),
    ...(invitee ? [invitee.inviterId] : []),
  ]);
  const referralItems: ReferralItem[] = mine.map((r) => ({
    id: r.id,
    friend: people.get(r.inviteeId) ?? null,
    status: r.status,
    joinedAt: r.createdAt.toISOString(),
    rewardedAt: r.rewardedAt?.toISOString() ?? null,
  }));
  const fresh =
    account !== undefined && Date.now() - account.createdAt.getTime() <= REDEEM_WINDOW_DAYS * DAY_MS;
  return {
    inviteCode: code,
    link: inviteLink(baseUrl, code),
    rewardMinor: settings.referralRewardMinor,
    minOrderMinor: settings.referralMinOrderMinor,
    currency: DEFAULT_CURRENCY,
    invitedBy: invitee ? (people.get(invitee.inviterId) ?? null) : null,
    canRedeem: !invitee && fresh && !completed,
    referrals: referralItems,
    vouchers: voucherList,
  };
}

async function hasCompletedPurchase(db: Db | Tx, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.buyerId, userId), eq(orders.status, "completed")))
    .limit(1);
  return Boolean(row);
}

/**
 * Uses a friend's code for the signed in person. Rules, in this order:
 * the code must exist, it cannot be your own, you cannot already have been invited, and the account must be new
 * (made in the last REDEEM_WINDOW_DAYS days, no completed purchase yet).
 */
export async function redeemReferral(db: Db, userId: string, code: string): Promise<void> {
  const [owner] = await db
    .select({ userId: profiles.userId, deletedAt: profiles.deletedAt })
    .from(profiles)
    .where(eq(profiles.inviteCode, code))
    .limit(1);
  if (!owner || owner.deletedAt) throw ApiError.notFound("We could not find that code");
  if (owner.userId === userId) throw ApiError.invalid("That is your own code", { code: "own_code" });

  const [already] = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(eq(referrals.inviteeId, userId))
    .limit(1);
  if (already) throw ApiError.conflict("You already used a friend's code");

  const [account] = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!account) throw ApiError.notFound();
  const tooOld = Date.now() - account.createdAt.getTime() > REDEEM_WINDOW_DAYS * DAY_MS;
  if (tooOld || (await hasCompletedPurchase(db, userId))) {
    throw ApiError.forbidden("Friend codes only work for new accounts");
  }

  try {
    await db.insert(referrals).values({ inviterId: owner.userId, inviteeId: userId });
  } catch (err) {
    if (isUniqueViolation(err)) throw ApiError.conflict("You already used a friend's code");
    throw err;
  }
}

type CompletedOrder = {
  id: string;
  buyerId: string;
  currency: string;
  itemsSubtotalMinor: number;
  bundleDiscountMinor: number;
};

/**
 * Called inside the transaction that completes an order. When the buyer was invited, the invite is still waiting
 * and this order reaches the minimum, both people get a voucher and the invite is marked rewarded. Returns what
 * to tell the two people once the transaction is saved, or null when nothing was rewarded.
 */
export async function rewardReferralOnCompletion(
  tx: Tx,
  order: CompletedOrder,
  settings: OrderSettings,
  now: Date,
): Promise<{ inviterId: string; inviteeId: string } | null> {
  const total = order.itemsSubtotalMinor - order.bundleDiscountMinor;
  if (total < settings.referralMinOrderMinor || settings.referralRewardMinor <= 0) return null;

  // The status check inside the update makes this safe if two orders complete at the same moment.
  const [claimed] = await tx
    .update(referrals)
    .set({ status: "rewarded", qualifiedAt: now, rewardedAt: now })
    .where(and(eq(referrals.inviteeId, order.buyerId), eq(referrals.status, "pending")))
    .returning({ inviterId: referrals.inviterId, inviteeId: referrals.inviteeId });
  if (!claimed) return null;

  await tx.insert(vouchers).values(
    [claimed.inviterId, claimed.inviteeId].map((userId) => ({
      userId,
      source: "referral",
      amountMinor: settings.referralRewardMinor,
      currency: order.currency,
      minOrderMinor: settings.referralMinOrderMinor,
      expiresAt: new Date(now.getTime() + VOUCHER_VALID_DAYS * DAY_MS),
    })),
  );
  return claimed;
}

/** Tells both people about their voucher. Runs after the transaction is saved. */
export async function notifyReferralRewarded(
  app: FastifyInstance,
  reward: { inviterId: string; inviteeId: string },
  amountMinor: number,
  currency: string,
) {
  for (const [userId, otherId, role] of [
    [reward.inviterId, reward.inviteeId, "inviter"],
    [reward.inviteeId, reward.inviterId, "invitee"],
  ] as const) {
    await notifyEvent(app, {
      userId,
      type: "referral_rewarded",
      actorId: otherId,
      data: { amountMinor, currency, role },
    });
  }
}
