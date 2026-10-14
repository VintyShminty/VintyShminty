"use client";

import type { ReportReason, ReportTarget } from "@vinty/shared";
import { CheckCircle2, Flag } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@/components/auth/fields";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useLoginPrompt } from "@/components/login-prompt";
import { useViewer } from "@/components/site-context";
import { ApiClientError } from "@/lib/api-error";
import { describeApiError } from "@/lib/describe-api-error";
import { useReport } from "@/lib/order-flow-queries";

// Which reasons make sense for what is being reported (the same lists as the app). The server accepts any for any target.
const LISTING_REASONS: ReportReason[] = [
  "counterfeit",
  "prohibited_item",
  "misleading",
  "inappropriate",
  "spam",
  "scam_off_platform",
  "other",
];
const USER_REASONS: ReportReason[] = ["harassment", "scam_off_platform", "spam", "inappropriate", "other"];

type Props = {
  targetType: Extract<ReportTarget, "listing" | "user">;
  targetId: string;
  open: boolean;
  onClose: () => void;
};

/**
 * Report flow (the app's report sheet): pick a reason, add optional details, send. The server answers the same way
 * when the same report comes twice, so the thank you covers both. A repeat that the server calls a conflict shows
 * "already reported".
 */
function ReportDialog({ targetType, targetId, open, onClose }: Props) {
  const { t } = useTranslation();
  const report = useReport();
  const fieldId = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [outcome, setOutcome] = useState<"sent" | "already" | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const reasons = targetType === "listing" ? LISTING_REASONS : USER_REASONS;

  useEffect(() => {
    if (open) {
      setReason(null);
      setDetails("");
      setOutcome(null);
      setErrorKey(null);
      report.reset();
    }
  }, [open, report.reset]);

  const send = () => {
    if (!reason) return;
    setErrorKey(null);
    report.mutate(
      { targetType, targetId, reason, details: details.trim() || undefined },
      {
        onSuccess: () => setOutcome("sent"),
        onError: (err) => {
          if (err instanceof ApiClientError && err.status === 409) return setOutcome("already");
          if (err instanceof ApiClientError && err.status === 400) return setErrorKey("report.own");
          if (err instanceof ApiClientError && err.status === 429) return setErrorKey("report.tooMany");
          setErrorKey(describeApiError(err).key);
        },
      },
    );
  };

  if (outcome) {
    return (
      <ConfirmDialog
        open={open}
        title={outcome === "sent" ? t("report.thanks") : t("report.already")}
        body={outcome === "sent" ? t("report.thanksNote") : t("report.alreadyNote")}
        confirmLabel={t("report.done")}
        hideCancel
        onConfirm={onClose}
        onCancel={onClose}
      >
        <CheckCircle2 size={44} aria-hidden className="mt-lg text-success" />
      </ConfirmDialog>
    );
  }

  return (
    <ConfirmDialog
      open={open}
      title={t("report.title")}
      confirmLabel={t("report.submit")}
      busy={report.isPending}
      disabled={!reason}
      onConfirm={send}
      onCancel={onClose}
    >
      <fieldset className="mt-md border-0 p-0">
        <legend className="mb-sm text-body-sm font-semibold text-text-2">{t("report.question")}</legend>
        <div className="flex flex-col">
          {reasons.map((key) => (
            <label
              key={key}
              className="flex min-h-12 cursor-pointer items-center gap-md border-b border-border-subtle py-sm text-body text-text-1"
            >
              <input
                type="radio"
                name="report-reason"
                value={key}
                checked={reason === key}
                onChange={() => setReason(key)}
                className="h-5 w-5 shrink-0 accent-primary"
              />
              <span className="flex-1">{t(`report.reasons.${key}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-lg">
        <label htmlFor={fieldId} className="mb-xs block text-body-sm font-semibold text-text-2">
          {t("report.details")}
        </label>
        <textarea
          id={fieldId}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          maxLength={2000}
          dir="auto"
          placeholder={t("report.detailsHint")}
          className="block w-full resize-none rounded-control border border-border bg-background px-md py-sm text-body text-text-1 outline-none placeholder:text-text-4 focus:border-primary"
        />
      </div>
      {errorKey ? (
        <div className="mt-md">
          <Notice kind="error">{t(errorKey)}</Notice>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}

/** "Report this item" or "Report this seller": a small link at the foot of the page. Logged out it asks to log in first. */
export function ReportButton({
  label,
  targetType,
  targetId,
}: {
  label: string;
  targetType: Props["targetType"];
  targetId: string;
}) {
  const viewer = useViewer();
  const { ask } = useLoginPrompt();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => (viewer ? setOpen(true) : ask())}
        className="inline-flex items-center gap-xs rounded-control py-xs text-body-sm text-text-3 underline-offset-4 hover:text-text-1 hover:underline"
      >
        <Flag size={14} aria-hidden />
        {label}
      </button>
      {viewer ? (
        <ReportDialog
          targetType={targetType}
          targetId={targetId}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
