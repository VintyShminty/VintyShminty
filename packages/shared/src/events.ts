import { z } from "zod";
import { idSchema, isoDateTimeSchema, localisedNameSchema } from "./common.js";
import { FEED_HIDE_SCOPES, FEED_SURFACES } from "./enums.js";

/**
 * The actions only the phone sees. Everything else (hearts, opens, searches, messages, offers, purchases) the server
 * records itself from the request it already handles, so the app cannot fake them.
 */
export const CLIENT_EVENT_TYPES = ["impression", "listing_dwell", "category_visit"] as const;
export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

export const EVENT_BATCH_MAX = 50;
/** Time on an item that counts as interest, in milliseconds, or this many photos swiped. */
export const DWELL_MIN_MS = 10_000;
export const DWELL_MIN_PHOTOS = 3;

export const clientEventSchema = z.object({
  /** Made by the app for each action. A batch sent twice never counts twice. */
  clientEventId: z.string().uuid(),
  type: z.enum(CLIENT_EVENT_TYPES),
  /** Required for `impression` and `listing_dwell`. */
  listingId: idSchema.optional(),
  /** Required for `category_visit`. */
  categoryId: idSchema.optional(),
  surface: z.enum(FEED_SURFACES).optional(),
  /** Index of the card in the list the person saw (0 is the first card). */
  position: z.number().int().min(0).max(10_000).optional(),
  /** The `feedId` of the home page the card came from. */
  feedId: idSchema.optional(),
  /** When it happened on the phone. Ignored when it is in the future or more than a day old. */
  occurredAt: isoDateTimeSchema.optional(),
  /** For `listing_dwell`: `{ dwellMs, photosSwiped }`. */
  data: z
    .object({
      dwellMs: z.number().int().min(0).max(3_600_000).optional(),
      photosSwiped: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
});
export type ClientEvent = z.infer<typeof clientEventSchema>;

/** POST /v1/events */
export const eventBatchSchema = z.object({
  events: z.array(clientEventSchema).min(1).max(EVENT_BATCH_MAX),
});
export type EventBatch = z.infer<typeof eventBatchSchema>;
export const eventBatchResultSchema = z.object({
  /** New actions stored. A resent action is not counted. */
  recorded: z.number().int().min(0),
  /** Actions skipped: resent, unknown item, or personalisation is switched off. */
  skipped: z.number().int().min(0),
});

/** POST /v1/feed/hide. `targetId` is a listing, a seller, a brand or a category id. */
export const hideInputSchema = z.object({
  scope: z.enum(FEED_HIDE_SCOPES),
  targetId: idSchema,
});
export type HideInput = z.infer<typeof hideInputSchema>;

export const hiddenItemSchema = z.object({
  id: idSchema,
  scope: z.enum(FEED_HIDE_SCOPES),
  targetId: idSchema,
  /** The item title, the seller's username or the brand name. Null for a category or when it is gone. */
  label: z.string().nullable(),
  /** Set for a category. */
  categoryName: localisedNameSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type HiddenItem = z.infer<typeof hiddenItemSchema>;
export const hiddenListSchema = z.object({ items: z.array(hiddenItemSchema) });

/** The first sign up question: what do you shop for. */
export const ONBOARDING_PICKS = ["women", "men", "kids"] as const;
export type OnboardingPick = (typeof ONBOARDING_PICKS)[number];
/** POST /v1/me/onboarding-picks */
export const onboardingPicksSchema = z.object({
  picks: z.array(z.enum(ONBOARDING_PICKS)).max(ONBOARDING_PICKS.length),
});
export type OnboardingPicks = z.infer<typeof onboardingPicksSchema>;
