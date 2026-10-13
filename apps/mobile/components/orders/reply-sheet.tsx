import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { ReviewItem } from "@vinty/shared";
import { type Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { NoteSheet } from "@/components/orders/note-sheet";
import { describeApiError } from "@/lib/auth-errors";
import { useReplyToReview } from "@/lib/orders-queries";

/** Answer a review you received. A second reply replaces the first. Shown by the screen that holds the review. */
export function ReplySheet({ ref, review }: { ref: Ref<BottomSheetModal>; review: ReviewItem | null }) {
  const { t } = useTranslation();
  const reply = useReplyToReview();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  return (
    <NoteSheet
      key={review?.id ?? "none"}
      ref={ref}
      title={t("review.replyTitle")}
      intro={
        review
          ? t("review.replyIntro", { name: review.reviewer.username ?? t("profile.deletedMember") })
          : undefined
      }
      label={t("review.replyLabel")}
      placeholder={t("review.replyHint")}
      required
      maxLength={400}
      initialText={review?.replyBody ?? ""}
      confirmLabel={t("review.replySend")}
      loading={reply.isPending}
      error={errorKey ? t(errorKey) : null}
      snapPoints={["70%"]}
      onReset={() => {
        setErrorKey(null);
        reply.reset();
      }}
      onSubmit={(body) => {
        if (!review) return;
        setErrorKey(null);
        reply.mutate(
          { reviewId: review.id, body },
          {
            onSuccess: () => {
              if (ref && typeof ref === "object") ref.current?.dismiss();
            },
            onError: (err) => setErrorKey(describeApiError(err).key),
          },
        );
      }}
    />
  );
}
