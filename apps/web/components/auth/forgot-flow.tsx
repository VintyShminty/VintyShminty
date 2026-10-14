"use client";

import {
  describeAuthError,
  forgotPasswordInputSchema,
  OTP_LENGTH,
  resetPasswordInputSchema,
} from "@vinty/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ResendCode } from "@/components/auth/code-resend";
import { AuthShell, Field, Notice, SubmitButton, TextButton, useCountdown } from "@/components/auth/fields";
import { getAuthClient } from "@/lib/auth-client";
import { fieldErrors } from "@/lib/form";

const RESEND_SECONDS = 30;

/** Forgot password: the email, then the 6 digit code with a new password, then back to Log in. */
export function ForgotFlow({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string | null>(null);
  return (
    <AuthShell
      title={email ? t("forgot.titleCode") : t("forgot.title")}
      subtitle={email ? t("forgot.subtitleCode") : t("forgot.subtitle")}
    >
      {email ? (
        <ResetStep lang={lang} email={email} onChangeEmail={() => setEmail(null)} />
      ) : (
        <RequestStep onSent={setEmail} />
      )}
    </AuthShell>
  );
}

function RequestStep({ onSent }: { onSent: (email: string) => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBanner(null);
    const found = fieldErrors(forgotPasswordInputSchema, { email });
    setError(found.email ?? null);
    if (found.email) return;
    setBusy(true);
    const { error: failure } = await getAuthClient().emailOtp.requestPasswordReset({ email });
    if (failure) {
      setBanner(t(describeAuthError(failure).key));
      setBusy(false);
      return;
    }
    onSent(email);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-lg">
      {banner ? <Notice kind="error">{banner}</Notice> : null}
      <Field
        label={t("fields.email")}
        type="email"
        name="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        value={email}
        onChange={setEmail}
        error={error ? t(error) : undefined}
      />
      <SubmitButton busy={busy}>{t("forgot.sendCode")}</SubmitButton>
    </form>
  );
}

function ResetStep({
  lang,
  email,
  onChangeEmail,
}: {
  lang: string;
  email: string;
  onChangeEmail: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { left, restart } = useCountdown(RESEND_SECONDS);

  async function resend() {
    setBanner(null);
    const { error } = await getAuthClient().emailOtp.requestPasswordReset({ email });
    if (error) {
      setBanner(t(describeAuthError(error).key));
      return;
    }
    setResent(true);
    restart();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBanner(null);
    const found = fieldErrors(resetPasswordInputSchema, { email, otp, password });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const { error } = await getAuthClient().emailOtp.resetPassword({ email, otp, password });
    if (error) {
      const problem = describeAuthError(error);
      if (problem.field === "otp" || problem.field === "password")
        setErrors({ [problem.field]: problem.key });
      else setBanner(t(problem.key));
      setBusy(false);
      return;
    }
    router.replace(`/${lang}/log-in?reset=1`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-lg">
      <Notice kind="info">
        {resent ? t("forgot.codeResent", { email }) : t("forgot.codeSent", { email })}
      </Notice>
      {banner ? <Notice kind="error">{banner}</Notice> : null}
      <Field
        label={t("fields.code")}
        name="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        autoFocus
        value={otp}
        onChange={(value) => setOtp(value.replace(/\D/g, ""))}
        error={errors.otp ? t(errors.otp) : undefined}
      />
      <Field
        label={t("fields.newPassword")}
        type="password"
        name="password"
        autoComplete="new-password"
        reveal
        hint={t("fields.passwordHint")}
        value={password}
        onChange={setPassword}
        error={errors.password ? t(errors.password) : undefined}
      />
      <SubmitButton busy={busy}>{t("forgot.reset")}</SubmitButton>
      <div className="flex flex-col items-center gap-md">
        <ResendCode left={left} onResend={resend} />
        <TextButton onClick={onChangeEmail}>{t("forgot.differentEmail")}</TextButton>
      </div>
    </form>
  );
}
