import type { ErrorResponse } from "@vinty/shared";
import type { z } from "zod";
import i18n from "@/i18n";
import { authClient } from "@/lib/auth-client";
import { API_URL } from "@/lib/config";

/** A failed call to our server, in the shared error shape (docs/blueprint/api.md). */
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

type Options<T> = {
  method?: string;
  body?: unknown;
  schema?: z.ZodType<T>;
  /** Extra request headers, for example Idempotency-Key. */
  headers?: Record<string, string>;
};

/** Calls /v1 on the server with the saved session. Throws ApiClientError. */
export async function api<T = void>(
  path: string,
  { method = "GET", body, schema, headers: extra }: Options<T> = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Language": i18n.language,
    ...extra,
  };
  const cookie = await authClient.getCookie();
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "omit",
    });
  } catch {
    throw new ApiClientError(0, "network", "Could not reach the server");
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const error = (json as ErrorResponse | null)?.error;
    throw new ApiClientError(
      res.status,
      error?.code ?? "internal_error",
      error?.message ?? res.statusText,
      error?.fields,
      Number(res.headers.get("Retry-After")) || undefined,
    );
  }
  return schema ? schema.parse(json) : (json as T);
}
