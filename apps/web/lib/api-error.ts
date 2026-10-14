import type { ErrorResponse } from "@vinty/shared";

/** A failed call to our server, in the shared error shape (docs/blueprint/api.md). Same idea as the app's ApiClientError. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorResponse["error"]["code"] | "network",
    message: string,
    readonly fields?: Record<string, string>,
    /** Seconds to wait before trying again, from the `Retry-After` header of a 429. */
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

/** Turns a failed response into an ApiClientError. Used by both the server and browser fetchers. */
export async function errorFromResponse(res: Response): Promise<ApiClientError> {
  const json = (await res.json().catch(() => null)) as ErrorResponse | null;
  const error = json?.error;
  return new ApiClientError(
    res.status,
    error?.code ?? "internal_error",
    error?.message ?? res.statusText,
    error?.fields,
    Number(res.headers.get("Retry-After")) || undefined,
  );
}
