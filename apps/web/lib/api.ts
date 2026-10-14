import { type AuthProviders, authProvidersSchema, type Me, meSchema } from "@vinty/shared";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { z } from "zod";
import { ApiClientError, errorFromResponse } from "@/lib/api-error";
import type { Lang } from "@/lib/i18n";

export { ApiClientError };

const API_URL = (process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");

type Options<T> = {
  /** The page language, sent as Accept-Language so names come back in it. */
  lang: Lang;
  schema?: z.ZodType<T>;
  /** Public data that is the same for everyone: no login cookie and no visitor address, so Next can cache it. */
  anonymous?: boolean;
  /** Seconds Next may reuse the answer. Without it every call asks the server again. */
  revalidate?: number;
};

/**
 * For server components and server code only: GET a path on our server (for example `/v1/feed?mood=for_you`).
 * It sends the page language, the visitor's login cookie (so personal data and "isFavourited" are right) and the
 * visitor's address as X-Forwarded-For (so the server counts per visitor, not all as the website's host).
 * The answer is checked with the zod schema from @vinty/shared. Throws ApiClientError.
 */
export async function serverApi<T>(
  path: string,
  { lang, schema, anonymous = false, revalidate }: Options<T>,
): Promise<T> {
  const request: Record<string, string> = { Accept: "application/json", "Accept-Language": lang };
  if (!anonymous) {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    const cookie = cookieStore.toString();
    if (cookie) request.Cookie = cookie;
    const ip = headerStore.get("x-forwarded-for");
    if (ip) request["X-Forwarded-For"] = ip;
  }

  let res: Response;
  try {
    res = await fetch(
      `${API_URL}${path}`,
      revalidate === undefined
        ? { headers: request, cache: "no-store" }
        : { headers: request, next: { revalidate } },
    );
  } catch {
    throw new ApiClientError(0, "network", "Could not reach the server");
  }
  if (!res.ok) throw await errorFromResponse(res);
  const json = (await res.json()) as unknown;
  return schema ? schema.parse(json) : (json as T);
}

/** The logged in person (GET /v1/me), or null when the visitor is logged out or the server is unreachable.
 * Remembered for the length of one page request, so the layout and the page can both ask without two calls. */
export const getViewer = cache(async (lang: Lang): Promise<Me | null> => {
  try {
    return await serverApi("/v1/me", { lang, schema: meSchema });
  } catch {
    return null;
  }
});

/** Which "Continue with ..." buttons the website may show (GET /v1/auth/providers), or null when the server is unreachable. */
export async function getAuthProviders(lang: Lang): Promise<AuthProviders | null> {
  try {
    return await serverApi("/v1/auth/providers", {
      lang,
      schema: authProvidersSchema,
      anonymous: true,
      revalidate: 60,
    });
  } catch {
    return null;
  }
}
