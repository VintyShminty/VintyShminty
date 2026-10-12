import { z } from "zod";
import { BIO_MAX, CITY_MAX, NAME_MAX, usernameSchema } from "./auth.js";
import {
  idSchema,
  isoDateTimeSchema,
  localeSchema,
  localisedNameSchema,
  pageSchema,
  photoSchema,
} from "./common.js";
import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from "./enums.js";

export { usernameSchema };

/** Summary used on cards, rows and chat headers. */
export const userSummarySchema = z.object({
  id: idSchema,
  username: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  /** Average of member reviews, 0 to 5, null when none yet. */
  ratingAverage: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0),
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export const publicProfileSchema = userSummarySchema.extend({
  /** Display name, shown under the username. */
  name: z.string(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().length(2),
  lastSeenAt: isoDateTimeSchema.nullable(),
  followerCount: z.number().int(),
  followingCount: z.number().int(),
  activeListingCount: z.number().int(),
  soldCount: z.number().int(),
  memberReview: z.object({ count: z.number().int(), average: z.number().nullable() }),
  automaticReview: z.object({ count: z.number().int(), average: z.number().nullable() }),
  emailVerified: z.boolean(),
  googleVerified: z.boolean(),
  badges: z.array(z.object({ slug: z.string(), icon: z.string(), name: localisedNameSchema })),
  holidayMode: z.boolean(),
  /** Relation to the viewer. Absent when not signed in. */
  viewer: z.object({ isFollowing: z.boolean(), isBlocked: z.boolean() }).optional(),
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;

/** GET /v1/me */
export const meSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  emailVerified: z.boolean(),
  username: z.string().nullable(),
  name: z.string(),
  locale: localeSchema,
  profile: publicProfileSchema,
  /** True until the person has picked a username. The app then shows the onboarding step. */
  needsOnboarding: z.boolean(),
});
export type Me = z.infer<typeof meSchema>;

/** PATCH /v1/me/profile */
export const updateProfileInputSchema = z
  .object({
    username: usernameSchema,
    /** Display name. */
    name: z.string().trim().min(1, "validation.name.required").max(NAME_MAX, "validation.name.tooLong"),
    bio: z.string().trim().max(BIO_MAX, "validation.bio.tooLong").nullable(),
    city: z.string().trim().max(CITY_MAX, "validation.city.tooLong").nullable(),
    countryCode: z.string().length(2),
    /** Key returned by POST /v1/uploads with purpose avatar. Null removes the photo. */
    avatarKey: z.string().max(300).nullable(),
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const userSettingsSchema = z.object({
  language: localeSchema,
  currency: z.string().length(3),
  pushEnabled: z.boolean(),
  pushDailyLimit: z.number().int().min(1).max(100).nullable(),
  emailEnabled: z.boolean(),
  personaliseFeed: z.boolean(),
  showLastSeen: z.boolean(),
  shipFromHome: z.boolean(),
  shipFromDropoff: z.boolean(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;
export const updateUserSettingsInputSchema = userSettingsSchema.partial();

export const notificationPreferenceSchema = z.object({
  type: z.enum(NOTIFICATION_TYPES),
  channel: z.enum(NOTIFICATION_CHANNELS),
  enabled: z.boolean(),
});
export const updateNotificationPreferencesInputSchema = z.object({
  preferences: z.array(notificationPreferenceSchema).min(1).max(100),
});

export const addressInputSchema = z.object({
  label: z.string().max(40).nullable().optional(),
  fullName: z.string().min(1).max(100),
  line1: z.string().min(1).max(150),
  line2: z.string().max(150).nullable().optional(),
  city: z.string().min(1).max(80),
  postcode: z.string().min(1).max(20),
  countryCode: z.string().length(2).default("IL"),
  phone: z.string().max(30).nullable().optional(),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressInputSchema>;
export const addressSchema = addressInputSchema.extend({ id: idSchema });

export const followListSchema = pageSchema(userSummarySchema);

export const uploadRequestSchema = z.object({
  /** What the file is for. Decides the folder, size limit and who may read it. */
  purpose: z.enum(["listing_photo", "avatar", "message_photo"]),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
  byteSize: z.number().int().min(1).max(15_000_000),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
/** Presigned PUT URL for the S3 compatible bucket. The app uploads straight to storage. */
export const uploadResponseSchema = z.object({
  key: z.string(),
  uploadUrl: z.string().url(),
  headers: z.record(z.string(), z.string()),
  expiresAt: isoDateTimeSchema,
  publicUrl: z.string().url(),
});
export type UploadResponse = z.infer<typeof uploadResponseSchema>;

export const pushTokenInputSchema = z.object({
  token: z.string().min(10).max(500),
  platform: z.enum(["ios", "android"]),
  deviceId: z.string().max(200).optional(),
  locale: localeSchema.optional(),
});

export const photoRefSchema = photoSchema;
