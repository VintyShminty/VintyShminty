"use client";

import { useTranslation } from "react-i18next";
import { TextButton } from "@/components/auth/fields";

/** "Send a new code in 24s", which becomes "Send a new code" when the wait is over (like the app). */
export function ResendCode({ left, onResend }: { left: number; onResend: () => void }) {
  const { t } = useTranslation();
  return (
    <TextButton onClick={onResend} disabled={left > 0}>
      {left > 0 ? t("forgot.resendIn", { seconds: left }) : t("forgot.resend")}
    </TextButton>
  );
}
