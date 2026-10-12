import { z } from "zod";
import { idSchema, isoDateTimeSchema, pageSchema } from "./common.js";
import { userSummarySchema } from "./users.js";

export const REVIEW_SOURCES = ["all", "member", "automatic"] as const;
export const reviewsQuerySchema = z.object({
  source: z.enum(REVIEW_SOURCES).default("all"),
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const reviewScoreSchema = z.object({ count: z.number().int(), average: z.number().nullable() });

export const reviewItemSchema = z.object({
  id: idSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  isAutomatic: z.boolean(),
  createdAt: isoDateTimeSchema,
  /** Null when the reviewer closed their account. */
  reviewer: userSummarySchema,
  /** Title of the item that was bought, from the order snapshot. */
  itemTitle: z.string().nullable(),
  replyBody: z.string().nullable(),
  repliedAt: isoDateTimeSchema.nullable(),
});
export type ReviewItem = z.infer<typeof reviewItemSchema>;

/** GET /v1/users/:id/reviews */
export const reviewsPageSchema = pageSchema(reviewItemSchema).extend({
  summary: z.object({
    member: reviewScoreSchema,
    automatic: reviewScoreSchema,
    /** Average over both kinds, 0 to 5. Null when there are no reviews. */
    overall: z.number().nullable(),
    total: z.number().int(),
  }),
});
export type ReviewsPage = z.infer<typeof reviewsPageSchema>;
