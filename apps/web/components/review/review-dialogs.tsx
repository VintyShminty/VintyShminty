"use client";

import { REVIEW_COMMENT_MAX, type ReviewItem } from "@vinty/shared";
import { Star } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ApiClientError } from "@/lib/api-error";
import { describeApiError } from "@/lib/describe-api-error";
import { useLeaveReview, useReplyToReview } from "@/lib/order-flow-queries";
import { cn } from "@/lib/utils";

const textarea =
  "block w-full resize-none rounded-control border border-border bg-background px-md py-sm text-body text-text-1 outline-none placeholder:text-text-4 focus:border-primary";

/** Five big stars to pick. The chosen number and every star before it are filled. */
function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useTranslation();
  return (
    <fieldset className="flex justify-center gap-sm border-0 p-0">
      <legend className="sr-only">{t("review.title")}</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label
          key={n}
          className="cursor-pointer rounded-control p-xs hover:bg-surface has-[:focus-visible]:bg-surface"
        >
          <input
            type="radio"
            name="review-rating"
            value={n}
            checked={n === value}
            onChange={() => onChange(n)}
            aria-label={t("review.stars", { count: n })}
            className="sr-only"
          />
          <Star
            size={36}
            strokeWidth={1.5}
            aria-hidden
            className={cn(n <= value ? "fill-current text-primary" : "text-text-4")}
          />
        </label>
      ))}
    </fieldset>
  );
}

/** Leave feedback after an order is complete: stars and an optional comment (up to 400 characters). */
export function ReviewDialog({
  open,
  orderId,
  otherName,
  onClose,
}: {
  open: boolean;
  orderId: string;
  otherName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const leave = useLeaveReview(orderId);
  const fieldId = useId();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRating(0);
      setComment("");
      setErrorKey(null);
      leave.reset();
    }
  }, [open, leave.reset]);

  const send = () => {
    setErrorKey(null);
    leave.mutate(
      { rating, comment: comment.trim() || undefined },
      {
        onSuccess: onClose,
        onError: (err) =>
          setErrorKey(
            err instanceof ApiClientError && err.status === 409
              ? "review.already"
              : describeApiError(err).key,
          ),
      },
    );
  };

  return (
    <ConfirmDialog
      open={open}
      title={t("review.title")}
      body={t("review.intro", { name: otherName })}
      confirmLabel={t("review.send")}
      busy={leave.isPending}
      disabled={rating === 0}
      onConfirm={send}
      onCancel={onClose}
    >
      <div className="mt-lg flex flex-col gap-md">
        <StarInput value={rating} onChange={setRating} />
        {rating > 0 ? (
          <p className="text-center text-body-sm font-semibold text-text-2">{t(`review.rating.${rating}`)}</p>
        ) : null}
        <div>
          <label htmlFor={fieldId} className="mb-xs block text-body-sm font-semibold text-text-2">
            {t("review.comment")}
          </label>
          <textarea
            id={fieldId}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={REVIEW_COMMENT_MAX}
            dir="auto"
            placeholder={t("review.commentHint")}
            className={textarea}
          />
        </div>
        {errorKey ? <Notice kind="error">{t(errorKey)}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

/** Answer a review you received. A second reply replaces the first. Open while `review` is set. */
export function ReplyDialog({ review, onClose }: { review: ReviewItem | null; onClose: () => void }) {
  const { t } = useTranslation();
  const reply = useReplyToReview();
  const fieldId = useId();
  const [text, setText] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const id = review?.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: start again only when another review is opened
  useEffect(() => {
    setText(review?.replyBody ?? "");
    setErrorKey(null);
    reply.reset();
  }, [id, reply.reset]);

  const send = () => {
    if (!review) return;
    setErrorKey(null);
    reply.mutate(
      { reviewId: review.id, body: text.trim() },
      { onSuccess: onClose, onError: (err) => setErrorKey(describeApiError(err).key) },
    );
  };

  return (
    <ConfirmDialog
      open={review !== null}
      title={t("review.replyTitle")}
      body={
        review
          ? t("review.replyIntro", { name: review.reviewer.username ?? t("profile.closedAccount") })
          : undefined
      }
      confirmLabel={t("review.replySend")}
      busy={reply.isPending}
      disabled={text.trim() === ""}
      onConfirm={send}
      onCancel={onClose}
    >
      <div className="mt-lg flex flex-col gap-md">
        <div>
          <label htmlFor={fieldId} className="mb-xs block text-body-sm font-semibold text-text-2">
            {t("review.replyLabel")}
          </label>
          <textarea
            id={fieldId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={REVIEW_COMMENT_MAX}
            dir="auto"
            placeholder={t("review.replyHint")}
            className={textarea}
          />
        </div>
        {errorKey ? <Notice kind="error">{t(errorKey)}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}
