"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { type ReviewItem, type ReviewsPage, reviewsPageSchema } from "@vinty/shared";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/empty-state";
import { StarRating } from "@/components/star-rating";
import { clientApi } from "@/lib/api-client";
import { formatDate } from "@/lib/time";

function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-pressed text-body-sm font-bold text-primary"
    >
      {url ? (
        // biome-ignore lint/performance/noImgElement: a small avatar, no image optimisation on purpose
        <img src={url} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function ReviewRow({ review }: { review: ReviewItem }) {
  const { t, i18n } = useTranslation();
  const name = review.reviewer.username ?? t("profile.closedAccount");
  return (
    <li className="flex flex-col gap-sm border-b border-border-subtle py-lg">
      <div className="flex items-center gap-md">
        <Avatar url={review.reviewer.avatarUrl} name={name} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-semibold text-text-1">{name}</p>
          <div className="flex items-center gap-sm">
            <StarRating
              rating={review.rating}
              label={t("web.seller.rating", { rating: review.rating })}
              size={12}
            />
            <span className="text-card-meta text-text-3">{formatDate(review.createdAt, i18n.language)}</span>
          </div>
        </div>
      </div>
      {review.comment ? (
        <p className="whitespace-pre-line text-body-sm text-text-1">{review.comment}</p>
      ) : null}
      <p className="truncate text-card-meta text-text-3">
        {review.itemTitle
          ? t(review.reviewerRole === "buyer" ? "profile.reviewAsBuyerFor" : "profile.reviewAsSellerFor", {
              title: review.itemTitle,
            })
          : t(review.reviewerRole === "buyer" ? "profile.reviewAsBuyer" : "profile.reviewAsSeller")}
      </p>
      {review.replyBody ? (
        <div className="rounded-control bg-surface p-md">
          <p className="mb-xs text-card-meta font-semibold text-text-1">{t("profile.reply")}</p>
          <p className="whitespace-pre-line text-body-sm text-text-1">{review.replyBody}</p>
        </div>
      ) : null}
    </li>
  );
}

/**
 * The Reviews tab (D-019, row 13): one list of written reviews, with the average on top and the automatic "smooth
 * sales" line. The first page comes from the server, "Show more reviews" loads the next one.
 */
export function ReviewsList({ userId, firstPage }: { userId: string; firstPage: ReviewsPage | null }) {
  const { t } = useTranslation();
  const query = useInfiniteQuery({
    queryKey: ["reviews", userId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }): Promise<ReviewsPage> =>
      clientApi(
        `/v1/users/${userId}/reviews?source=member&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        { schema: reviewsPageSchema },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: firstPage ? { pages: [firstPage], pageParams: [undefined] } : undefined,
  });

  if (query.isPending)
    return <p className="py-xl text-center text-body-sm text-text-3">{t("web.feed.loading")}</p>;
  if (query.isError && !query.data) {
    return (
      <div className="flex flex-col items-center gap-md py-2xl text-center">
        <p className="text-heading text-text-1">{t("errors.general")}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="inline-flex h-10 items-center rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint"
        >
          {t("common.tryAgain")}
        </button>
      </div>
    );
  }

  const pages = query.data?.pages ?? [];
  const summary = pages[0]?.summary;
  const items = pages.flatMap((p) => p.items);
  return (
    <div className="max-w-[720px]">
      {summary ? (
        <div className="flex flex-col gap-md py-lg">
          {summary.member.count > 0 ? (
            <div className="flex items-center gap-md">
              <span className="text-title font-bold text-text-1">
                {summary.member.average === null ? "-" : summary.member.average.toFixed(1)}
              </span>
              <div className="flex flex-col gap-xs">
                <StarRating
                  rating={summary.member.average}
                  label={t("web.seller.rating", { rating: summary.member.average?.toFixed(1) ?? 0 })}
                  size={18}
                />
                <span className="text-card-meta text-text-3">
                  {t("profile.reviewCount", { count: summary.member.count })}
                </span>
              </div>
            </div>
          ) : null}
          {summary.automatic.count > 0 ? (
            <p className="inline-flex items-center gap-sm self-start rounded-control bg-success-tint px-md py-sm text-body-sm font-semibold text-success">
              <Check size={16} aria-hidden />
              {t("profile.smoothSales", { count: summary.automatic.count })}
            </p>
          ) : null}
        </div>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title={t("profile.noReviews")} />
      ) : (
        <ul>
          {items.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </ul>
      )}
      {query.hasNextPage ? (
        <div className="flex justify-center py-lg">
          <button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="inline-flex h-10 items-center rounded-control border border-primary px-lg text-body-sm font-semibold text-primary hover:bg-accent-tint disabled:opacity-40"
          >
            {query.isFetchingNextPage ? t("web.feed.loadingMore") : t("web.seller.moreReviews")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
