"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  changeEmailInputSchema,
  changePasswordFormSchema,
  changeUsernameFormSchema,
  describeAuthError,
  OTP_LENGTH,
  verifyCodeInputSchema,
} from "@vinty/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ResendCode } from "@/components/auth/code-resend";
import { Field, Notice, SubmitButton, TextButton, useCountdown } from "@/components/auth/fields";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { clientApi } from "@/lib/api-client";
import { ApiClientError } from "@/lib/api-error";
import { getAuthClient } from "@/lib/auth-client";
import { describeApiError } from "@/lib/describe-api-error";
import { fieldErrors } from "@/lib/form";

const RESEND_SECONDS = 30;

/** The green box and the Done button that end a change. */
function Done({ lang, message }: { lang: string; message: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-lg">
      <Notice kind="success">{message}</Notice>
      <Link
        href={`/${lang}/settings/account`}
        className="inline-flex h-12 items-center justify-center rounded-control bg-primary px-lg text-body font-semibold text-on-accent hover:opacity-90"
      >
        {t("common.done")}
      </Link>
    </div>
  );
}

/** Change email: the new address, then the 6 digit code sent to it. */
export function ChangeEmailFlow({ lang, email }: { lang: string; email: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const { left, restart } = useCountdown(RESEND_SECONDS);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    setBanner(null);
    const found = fieldErrors(changeEmailInputSchema, { email: newEmail });
    if (found.email) return setErrors({ email: found.email });
    if (newEmail.trim().toLowerCase() === email.toLowerCase())
      return setErrors({ email: "errors.sameEmail" });
    setErrors({});
    setBusy(true);
    const { error } = await getAuthClient().emailOtp.requestEmailChange({ newEmail: newEmail.trim() });
    setBusy(false);
    if (error) {
      const problem = describeAuthError(error);
      if (problem.field === "email") setErrors({ email: problem.key });
      else setBanner(t(problem.key));
      return;
    }
    setSentTo(newEmail.trim());
    restart();
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!sentTo) return;
    setBanner(null);
    const found = fieldErrors(verifyCodeInputSchema, { otp });
    setErrors(found);
    if (found.otp) return;
    setBusy(true);
    const { error } = await getAuthClient().emailOtp.changeEmail({ newEmail: sentTo, otp });
    setBusy(false);
    if (error) {
      const problem = describeAuthError(error);
      if (problem.field === "otp") setErrors({ otp: problem.key });
      else setBanner(t(problem.key));
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) return <Done lang={lang} message={t("account.emailChanged", { email: sentTo ?? "" })} />;
  if (sentTo) {
    return (
      <form onSubmit={confirm} noValidate className="flex flex-col gap-lg">
        <Notice kind="info">{t("forgot.codeSent", { email: sentTo })}</Notice>
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
        <SubmitButton busy={busy}>{t("account.confirmEmail")}</SubmitButton>
        <div className="flex flex-col items-center gap-md">
          <ResendCode left={left} onResend={() => void send()} />
          <TextButton onClick={() => setSentTo(null)}>{t("forgot.differentEmail")}</TextButton>
        </div>
      </form>
    );
  }
  return (
    <form onSubmit={send} noValidate className="flex flex-col gap-lg">
      {banner ? <Notice kind="error">{banner}</Notice> : null}
      <Field
        label={t("fields.newEmail")}
        type="email"
        name="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        value={newEmail}
        onChange={setNewEmail}
        error={errors.email ? t(errors.email) : undefined}
      />
      <SubmitButton busy={busy}>{t("forgot.sendCode")}</SubmitButton>
    </form>
  );
}

/** Verify email: asks for a code to the current address (sent when the person taps Send), then checks it. */
export function VerifyEmailFlow({ lang, email }: { lang: string; email: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const { left, restart } = useCountdown(RESEND_SECONDS);

  async function send() {
    setBanner(null);
    setBusy(true);
    const { error } = await getAuthClient().emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    setBusy(false);
    if (error) return setBanner(t(describeAuthError(error).key));
    if (sent) setResent(true);
    setSent(true);
    restart();
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBanner(null);
    const found = fieldErrors(verifyCodeInputSchema, { otp });
    setErrors(found);
    if (found.otp) return;
    setBusy(true);
    const { error } = await getAuthClient().emailOtp.verifyEmail({ email, otp });
    setBusy(false);
    if (error) {
      const problem = describeAuthError(error);
      if (problem.field === "otp") setErrors({ otp: problem.key });
      else setBanner(t(problem.key));
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) return <Done lang={lang} message={t("account.emailVerifiedDone")} />;
  return (
    <div className="flex flex-col gap-lg">
      {banner ? <Notice kind="error">{banner}</Notice> : null}
      {sent ? (
        <form onSubmit={verify} noValidate className="flex flex-col gap-lg">
          <Notice kind="info">
            {resent ? t("forgot.codeResent", { email }) : t("forgot.codeSent", { email })}
          </Notice>
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
          <SubmitButton busy={busy}>{t("account.verifyButton")}</SubmitButton>
          <div className="flex justify-center">
            <ResendCode left={left} onResend={() => void send()} />
          </div>
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="flex flex-col gap-lg"
        >
          <p className="text-body-sm text-text-2">{t("account.verifyIntro", { email })}</p>
          <SubmitButton busy={busy}>{t("forgot.sendCode")}</SubmitButton>
        </form>
      )}
    </div>
  );
}

/** Change password: current, new, repeat. Other devices are logged out, like the app. */
export function ChangePasswordForm({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBanner(null);
    const found = fieldErrors(changePasswordFormSchema, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const { error } = await getAuthClient().changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      // Anyone else who had the old password is logged out.
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) {
      const problem = describeAuthError(error);
      if (error.code === "INVALID_PASSWORD") setErrors({ currentPassword: "errors.wrongPassword" });
      else if (problem.field === "password") setErrors({ newPassword: problem.key });
      else setBanner(t(problem.key));
      return;
    }
    setDone(true);
  }

  if (done) return <Done lang={lang} message={t("account.passwordChanged")} />;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-lg">
      {banner ? <Notice kind="error">{banner}</Notice> : null}
      <Field
        label={t("fields.currentPassword")}
        type="password"
        name="currentPassword"
        autoComplete="current-password"
        reveal
        value={values.currentPassword}
        onChange={set("currentPassword")}
        error={errors.currentPassword ? t(errors.currentPassword) : undefined}
      />
      <Field
        label={t("fields.newPassword")}
        type="password"
        name="newPassword"
        autoComplete="new-password"
        reveal
        hint={t("fields.passwordHint")}
        value={values.newPassword}
        onChange={set("newPassword")}
        error={errors.newPassword ? t(errors.newPassword) : undefined}
      />
      <Field
        label={t("fields.confirmPassword")}
        type="password"
        name="confirmPassword"
        autoComplete="new-password"
        reveal
        value={values.confirmPassword}
        onChange={set("confirmPassword")}
        error={errors.confirmPassword ? t(errors.confirmPassword) : undefined}
      />
      <p className="text-body-sm text-text-3">{t("account.passwordLogsOut")}</p>
      <SubmitButton busy={busy}>{t("account.changePassword")}</SubmitButton>
    </form>
  );
}

/** Change username: one field, saved with the profile call. A taken name shows under the field. */
export function ChangeUsernameForm({ lang, username }: { lang: string; username: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(username);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBanner(null);
    const found = fieldErrors(changeUsernameFormSchema, { username: value });
    setErrors(found);
    if (found.username) return;
    setBusy(true);
    try {
      await clientApi("/v1/me/profile", { method: "PATCH", body: { username: value.trim() } });
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
      setDone(true);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError && error.fields?.username)
        setErrors({ username: error.fields.username });
      else setBanner(t(describeApiError(error).key));
    } finally {
      setBusy(false);
    }
  }

  if (done) return <Done lang={lang} message={t("web.settings.saved")} />;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-lg">
      {banner ? <Notice kind="error">{banner}</Notice> : null}
      <Field
        label={t("fields.username")}
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        hint={t("fields.usernameHint")}
        value={value}
        onChange={setValue}
        error={errors.username ? t(errors.username) : undefined}
      />
      <SubmitButton busy={busy} disabled={value.trim() === username}>
        {t("common.save")}
      </SubmitButton>
    </form>
  );
}

/** Delete account: says what goes and what stays, asks for the password, then asks once more in a box (like the app). */
export function DeleteAccountForm({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  function ask(event: FormEvent) {
    event.preventDefault();
    setBanner(null);
    setError(null);
    setAsking(true);
  }

  async function run() {
    setBusy(true);
    try {
      // An account made with Apple or Google has no password, so an empty box sends none.
      await clientApi("/v1/me", { method: "DELETE", body: password ? { password } : {} });
    } catch (failure) {
      setAsking(false);
      setBusy(false);
      if (failure instanceof ApiClientError && failure.status === 403) setError("errors.wrongPassword");
      else if (failure instanceof ApiClientError && failure.status === 409)
        setBanner(t("account.deleteBlocked"));
      else setBanner(t(describeApiError(failure).key));
      return;
    }
    // The account is closed on the server. End the login in this browser too and go Home.
    await getAuthClient()
      .signOut()
      .catch(() => undefined);
    router.replace(`/${lang}`);
    router.refresh();
  }

  return (
    <>
      <h2 className="text-heading font-bold text-text-1">{t("account.deleteTitle")}</h2>
      <ul className="mt-md flex flex-col gap-sm text-body-sm text-text-2">
        <li>{t("account.deleteBullet1")}</li>
        <li>{t("account.deleteBullet2")}</li>
        <li>{t("account.deleteBullet3")}</li>
      </ul>
      <form onSubmit={ask} noValidate className="mt-xl flex flex-col gap-lg">
        {banner ? <Notice kind="error">{banner}</Notice> : null}
        <Field
          label={t("account.deletePassword")}
          type="password"
          name="password"
          autoComplete="current-password"
          reveal
          value={password}
          onChange={setPassword}
          error={error ? t(error) : undefined}
        />
        <button
          type="submit"
          className="inline-flex h-12 w-full items-center justify-center rounded-control bg-error px-lg text-body font-semibold text-on-accent hover:opacity-90"
        >
          {t("account.delete")}
        </button>
      </form>
      <ConfirmDialog
        open={asking}
        title={t("account.deleteConfirmTitle")}
        body={t("account.deleteConfirmBody")}
        confirmLabel={t("account.deleteConfirm")}
        destructive
        busy={busy}
        onConfirm={() => void run()}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}
