import { ApiClientError } from "@/lib/api";

export { describeAuthError } from "@vinty/shared";

/** Same idea for errors from our own /v1 routes. */
export function describeApiError(error: unknown): { key: string; fields?: Record<string, string> } {
  if (error instanceof ApiClientError) {
    if (error.code === "network") return { key: "errors.network" };
    if (error.status === 429) return { key: "errors.tooManyRequests" };
    if (error.code === "validation_failed" || error.code === "conflict") {
      return { key: "errors.checkFields", fields: error.fields };
    }
    if (error.code === "forbidden") return { key: "errors.wrongPassword" };
    if (error.code === "unauthenticated") return { key: "errors.sessionExpired" };
  }
  return { key: "errors.general" };
}
