"use client";

import { describeAuthError, OTP_LENGTH, signUpInputSchema, verifyCodeInputSchema } from "@vinty/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ResendCode } from "@/components/auth/code-resend";
import { AuthShell, Field, Notice, SubmitButton, TextButton, useCountdown } from "@/components/auth/fields";
import { SocialSlot } from "@/components/auth/social-slot";
import { getAuthClient } from "@/lib/auth-client";
import { fieldErrors } from "@/lib/form";
import { loginHref, safeNext } from "@/lib/login-links";
import { markOnboardingPending } from "@/lib/onboarding";

const RESEND_SECONDS = 30;

/** Sign up with email and password only (D-020), then the 6 digit code from the email, then the two welcome questions. */
export function SignUpFlow({ lang, next }: { lang: string; next?: string }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string | null>(null);
  return (
    <AuthShell
      title={email ? t("forgot.titleCode") : t("signUp.title")}
      subtitle={email ? t("web.auth.confirmSubtitle") : t("signUp.subtitle")}
    >
      {email ? (
        <CodeStep lang={lang} next={next} email={email} />
      ) : (
        <AccountStep lang={lang} next={next} onCreated={setEmail} />
      )}
    </AuthShell>
  );
}

function AccountStep({
  lang,
  next,
  onCreated,
}: {
  lang: string;
  next?: string;
  onCreated: (email: string) => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = () => {
    const found = fieldErrors(signUpInputSchema, { email, password });
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBanner(null);
    if (!check()) return;
    setBusy(true);
    // No name or username here (D-020). The server makes the username from the email.
    const { data, error } = await getAuthClient().signUp.email({ email, password, name: "" });
    if (error) {
      const problem = describeAuthError(error);
      if (problem.field === "email" || problem.field === "password") {
        setErrors({ [problem.field]: problem.key });
      } else {
        setBanner(t(problem.key));
      }
      setBusy(false);
      return;
    }
    // A new account gets the two short questions once, before Home.
    if (data?.user.id) markOnboardingPending(data.user.id);
    onCreated(email);
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
        value={email}
        onChange={setEmail}
        onBlur={() => email && check()}
        error={errors.email ? t(errors.email) : undefined}
      />
      <Field
        label={t("fields.password")}
        type="password"
        name="password"
        autoComplete="new-password"
        reveal
        hint={t("fields.passwordHint")}
        value={password}
        onChange={setPassword}
        error={errors.password ? t(errors.password) : undefined}
      />
      <SubmitButton busy={busy}>{t("signUp.submit")}</SubmitButton>
      <SocialSlot />
      <p className="text-center text-body-sm text-text-3">
        {t("signUp.haveAccount")}{" "}
        <Link href={loginHref(lang, next)} className="font-bold text-primary hover:underline">
          {t("signUp.logIn")}
        </Link>
      </p>
    </form>
  );
}

/** The account exists and is logged in. The server has just emailed a code, here the person confirms the email. */
function CodeStep({ lang, next, email }: { lang: string; next?: string; email: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { left, restart } = useCountdown(RESEND_SECONDS);

  const toQuestions = () => {
    const safe = safeNext(next);
    router.replace(`/${lang}/welcome-questions${safe ? `?next=${encodeURIComponent(safe)}` : ""}`);
    router.refresh();
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBanner(null);
    const found = fieldErrors(verifyCodeInputSchema, { otp });
    setError(found.otp ?? null);
    if (found.otp) return;
    setBusy(true);
    const { error: failure } = await getAuthClient().emailOtp.verifyEmail({ email, otp });
    if (failure) {
      const problem = describeAuthError(failure);
      if (problem.field === "otp") setError(problem.key);
      else setBanner(t(problem.key));
      setBusy(false);
      return;
    }
    toQuestions();
  }

  async function resend() {
    setBanner(null);
    const { error: failure } = await getAuthClient().emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    if (failure) {
      setBanner(t(describeAuthError(failure).key));
      return;
    }
    setResent(true);
    restart();
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
        error={error ? t(error) : undefined}
      />
      <SubmitButton busy={busy}>{t("web.auth.confirmButton")}</SubmitButton>
      <div className="flex flex-col items-center gap-md">
        <ResendCode left={left} onResend={resend} />
        <TextButton onClick={toQuestions}>{t("web.auth.confirmLater")}</TextButton>
      </div>
    </form>
  );
}
