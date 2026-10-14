import { ApiClientError } from "@/lib/api-error";

/** Turns a failed call to our own /v1 routes into a translation key (and the per field problems, if any). Same as the app. */
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
