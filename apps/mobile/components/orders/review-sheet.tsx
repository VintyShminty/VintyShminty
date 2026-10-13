import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { type Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { NoteSheet } from "@/components/orders/note-sheet";
import { StarInput } from "@/components/orders/star-input";
import { Text } from "@/components/ui/text";
import { ApiClientError } from "@/lib/api";
import { describeApiError } from "@/lib/auth-errors";
import { useLeaveReview } from "@/lib/orders-queries";

/** Leave feedback after an order is complete: stars and an optional comment (up to 400 characters). */
export function ReviewSheet({
  ref,
  orderId,
  otherName,
  onDone,
}: {
  ref: Ref<BottomSheetModal>;
  orderId: string;
  otherName: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const leave = useLeaveReview(orderId);
  const [rating, setRating] = useState(0);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  return (
    <NoteSheet
      ref={ref}
      title={t("review.title")}
      intro={t("review.intro", { name: otherName })}
      above={
        <>
          <StarInput value={rating} onChange={setRating} />
          {rating > 0 ? (
            <Text variant="bodySmall" weight={600} className="text-center text-text-2">
              {t(`review.rating.${rating}`)}
            </Text>
          ) : null}
        </>
      }
      label={t("review.comment")}
      placeholder={t("review.commentHint")}
      maxLength={400}
      confirmLabel={t("review.send")}
      ready={rating > 0}
      loading={leave.isPending}
      error={errorKey ? t(errorKey) : null}
      snapPoints={["85%"]}
      onReset={() => {
        setRating(0);
        setErrorKey(null);
        leave.reset();
      }}
      onSubmit={(comment) => {
        setErrorKey(null);
        leave.mutate(
          { rating, comment: comment || undefined },
          {
            onSuccess: () => {
              if (ref && typeof ref === "object") ref.current?.dismiss();
              onDone();
            },
            onError: (err) =>
              setErrorKey(
                err instanceof ApiClientError && err.status === 409
                  ? "review.already"
                  : describeApiError(err).key,
              ),
          },
        );
      }}
    />
  );
}
