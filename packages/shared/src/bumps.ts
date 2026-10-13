import { z } from "zod";
import {
  idSchema,
  isoDateTimeSchema,
  localisedNameSchema,
  pageSchema,
  paginationQuerySchema,
  photoSchema,
} from "./common.js";
import { LISTING_STATUSES } from "./enums.js";
import { currencyCodeSchema } from "./money.js";

/** One way to give an item buzz: a name and how long it lasts. Free in version 1 (priceMinor is 0). */
export const bumpPlanSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: localisedNameSchema,
  durationHours: z.number().int().positive(),
  priceMinor: z.number().int().nonnegative(),
  currency: currencyCodeSchema,
});
export type BumpPlan = z.infer<typeof bumpPlanSchema>;

export const bumpPlansSchema = z.object({ items: z.array(bumpPlanSchema) });
export type BumpPlans = z.infer<typeof bumpPlansSchema>;

export const createBumpInputSchema = z.object({ planId: idSchema });
export type CreateBumpInput = z.infer<typeof createBumpInputSchema>;

/** One buzz. `payment` says how it was paid, always "free" in version 1. */
export const bumpSchema = z.object({
  id: idSchema,
  listingId: idSchema,
  planId: idSchema,
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  pricePaidMinor: z.number().int().nonnegative(),
  currency: currencyCodeSchema,
  payment: z.enum(["free"]),
});
export type Bump = z.infer<typeof bumpSchema>;

/** A buzz in the "Your buzzes" list, with the item it was for. */
export const myBumpSchema = bumpSchema.extend({
  isActive: z.boolean(),
  plan: z.object({ slug: z.string(), name: localisedNameSchema, durationHours: z.number().int().positive() }),
  listing: z.object({
    id: idSchema,
    title: z.string(),
    status: z.enum(LISTING_STATUSES),
    cover: photoSchema.nullable(),
  }),
});
export type MyBump = z.infer<typeof myBumpSchema>;

export const myBumpsQuerySchema = paginationQuerySchema;
export const myBumpsPageSchema = pageSchema(myBumpSchema);
export type MyBumpsPage = z.infer<typeof myBumpsPageSchema>;
