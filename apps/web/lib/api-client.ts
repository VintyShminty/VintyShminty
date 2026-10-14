"use client";

import type { z } from "zod";
import { ApiClientError, errorFromResponse } from "@/lib/api-error";

type Options<T> = {
  method?: string;
  body?: unknown;
  schema?: z.ZodType<T>;
  /** The page language, sent as Accept-Language. */
  lang?: string;
  /** Extra headers, for example Idempotency-Key. */
  headers?: Record<string, string>;
};

/**
 * For client components: calls the website's own `/v1/...` (the website forwards it to the server, so the login
 * cookie belongs to the website and goes along with `credentials: "include"`). Throws ApiClientError.
 */
export async function clientApi<T = void>(
  path: string,
  { method = "GET", body, schema, lang, headers: extra }: Options<T> = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...extra };
  if (lang) headers["Accept-Language"] = lang;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
    });
  } catch {
    throw new ApiClientError(0, "network", "Could not reach the server");
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await errorFromResponse(res);
  const json = (await res.json()) as unknown;
  return schema ? schema.parse(json) : (json as T);
}
