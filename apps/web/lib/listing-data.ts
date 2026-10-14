import {
  listingCardSchema,
  listingDetailSchema,
  pageSchema,
  publicProfileSchema,
  reviewsPageSchema,
} from "@vinty/shared";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ApiClientError, serverApi } from "@/lib/api";
import type { Lang } from "@/lib/i18n";

const cardsPage = pageSchema(listingCardSchema);

/**
 * One listing, asked for once per page request. The server counts a view every time GET /v1/listings/:id is called,
 * and both `generateMetadata` and the page need the listing, so they share this one call (React `cache`).
 * A missing or malformed id ends in Next's not found page. Any other failure is thrown for the caller to show.
 */
export const getListing = cache(async (lang: Lang, id: string) => {
  try {
    return await serverApi(`/v1/listings/${encodeURIComponent(id)}`, { lang, schema: listingDetailSchema });
  } catch (error) {
    if (error instanceof ApiClientError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
});

/** A member's public profile, asked for once per page request. */
export const getProfile = cache(async (lang: Lang, id: string) => {
  try {
    return await serverApi(`/v1/users/${encodeURIComponent(id)}`, { lang, schema: publicProfileSchema });
  } catch (error) {
    if (error instanceof ApiClientError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
});

/** A member's first reviews (member written ones, plus the counts for the smooth sales line). */
export const getReviewsFirstPage = cache((lang: Lang, id: string) =>
  serverApi(`/v1/users/${encodeURIComponent(id)}/reviews?source=member&limit=20`, {
    lang,
    schema: reviewsPageSchema,
  }).catch(() => null),
);

/** Up to `limit` items from a seller, newest first. Empty when the call fails. */
export const getSellerItems = cache(async (lang: Lang, id: string, limit: number) => {
  const page = await serverApi(`/v1/users/${encodeURIComponent(id)}/listings?limit=${limit}`, {
    lang,
    schema: cardsPage,
  }).catch(() => null);
  return page?.items ?? [];
});

/** Items like this one. Empty when the call fails. */
export const getSimilar = cache(async (lang: Lang, id: string) => {
  const page = await serverApi(`/v1/listings/${encodeURIComponent(id)}/similar?limit=20`, {
    lang,
    schema: cardsPage,
  }).catch(() => null);
  return page?.items ?? [];
});
