import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common.js";
import { REFERRAL_STATUSES, VOUCHER_STATUSES } from "./enums.js";
import { userSummarySchema } from "./users.js";

/**
 * Invite friends (Milestone 9). New codes are 8 letters and digits without look-alikes (no 0, O, 1, I, L).
 * Any 4 to 20 letters and digits are accepted when a code is entered (the sample data has shorter ones).
 * People type it in any case, with spaces or dashes, so the input is cleaned before the length check.
 */
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Upper case, no spaces or dashes. */
export const normaliseInviteCode = (raw: string) => raw.replace(/[\s-]/g, "").toUpperCase();

/** POST /v1/referrals/redeem */
export const redeemReferralInputSchema = z.object({
  code: z
    .string()
    .max(40)
    .transform(normaliseInviteCode)
    .pipe(z.string().regex(/^[A-Z0-9]{4,20}$/, "That code does not look right")),
});
export type RedeemReferralInput = z.input<typeof redeemReferralInputSchema>;

export const referralItemSchema = z.object({
  id: idSchema,
  /** Null when the friend closed their account. */
  friend: userSummarySchema.nullable(),
  /** pending: joined, no completed order yet. rewarded: both vouchers issued. */
  status: z.enum(REFERRAL_STATUSES),
  joinedAt: isoDateTimeSchema,
  rewardedAt: isoDateTimeSchema.nullable(),
});
export type ReferralItem = z.infer<typeof referralItemSchema>;

export const voucherSchema = z.object({
  id: idSchema,
  source: z.string(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  /** The items total must reach this for the voucher to apply (applied at checkout in version 2). */
  minOrderMinor: z.number().int().min(0),
  /** An active voucher whose date has passed is shown as expired. */
  status: z.enum(VOUCHER_STATUSES),
  expiresAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type Voucher = z.infer<typeof voucherSchema>;

/** GET /v1/me/referral */
export const referralSummarySchema = z.object({
  inviteCode: z.string(),
  link: z.string().url(),
  /** What each side gets, from the platform settings. */
  rewardMinor: z.number().int(),
  minOrderMinor: z.number().int(),
  currency: z.string().length(3),
  /** Who invited you, when you used a code. */
  invitedBy: userSummarySchema.nullable(),
  /** True while you could still enter a friend's code. */
  canRedeem: z.boolean(),
  referrals: z.array(referralItemSchema),
  vouchers: z.array(voucherSchema),
});
export type ReferralSummary = z.infer<typeof referralSummarySchema>;

/** GET /v1/me/vouchers */
export const vouchersSchema = z.array(voucherSchema);
