import type { ErrorCode } from "@vinty/shared";

/** An expected failure with the HTTP status and code from docs/blueprint/api.md. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
    /** For 429: seconds the app should wait, sent as the `Retry-After` header. */
    readonly retryAfterSeconds?: number,
    /** Extra values for the body of the error, such as `resetsAt` on `offer_limit_reached`. */
    readonly extra?: { resetsAt?: string },
  ) {
    super(message);
  }

  static unauthenticated() {
    return new ApiError(401, "unauthenticated", "Please log in");
  }
  static forbidden(message = "Not allowed") {
    return new ApiError(403, "forbidden", message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, "not_found", message);
  }
  static conflict(message: string, fields?: Record<string, string>) {
    return new ApiError(409, "conflict", message, fields);
  }
  static invalid(message: string, fields?: Record<string, string>) {
    return new ApiError(400, "validation_failed", message, fields);
  }
}
