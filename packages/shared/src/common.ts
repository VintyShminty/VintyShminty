import { z } from "zod";
import { LOCALES } from "./enums.js";

export const idSchema = z.string().uuid();
export const localeSchema = z.enum(LOCALES);
export const isoDateTimeSchema = z.string().datetime({ offset: true });

/** Cursor pagination. The cursor is opaque text. Clients pass back `nextCursor` as `cursor`. */
export const paginationQuerySchema = z.object({
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    /** Null when there is no more. */
    nextCursor: z.string().nullable(),
  });

export const ERROR_CODES = [
  "validation_failed",
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "blocked",
  "listing_unavailable",
  "invalid_transition",
  "offer_limit_reached",
  "internal_error",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    /** Field level problems for validation_failed. */
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/** Photo as sent to the app. `url` is built from the storage base URL and the key. */
export const photoSchema = z.object({
  key: z.string(),
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  placeholder: z.string().nullable(),
});
export type Photo = z.infer<typeof photoSchema>;

/** Names for reference data in both languages. The app picks one by the user's language. */
export const localisedNameSchema = z.object({ en: z.string(), he: z.string() });
export type LocalisedName = z.infer<typeof localisedNameSchema>;
