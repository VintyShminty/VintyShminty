"use client";

import { type AuthProviders, describeAuthError, signInInputSchema } from "@vinty/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, Notice, SubmitButton } from "@/components/auth/fields";
import { SocialSlot } from "@/components/auth/social-slot";
import { getAuthClient } from "@/lib/auth-client";
import { fieldErrors } from "@/lib/form";
import { safeNext, signUpHref } from "@/lib/login-links";

/** Email and password (D-020 wording). After logging in the person lands on `next`, else Home. */
export function LogInForm({
  lang,
  next,
  reset,
  providers,
  initialError,
}: {
  lang: string;
  next?: string;
  reset?: boolean;
  providers: AuthProviders | null;
  /** Words for a refused Apple or Google login that sent the person back here. */
  initialError?: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);

  const check = (values = { email, password }) => {
    const found = fieldErrors(signInInputSchema, values);
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBanner(null);
    if (!check()) return;
    setBusy(true);
    const { error } = await getAuthClient().signIn.email({ email, password });
    if (error) {
      setBanner(t(describeAuthError(error).key));
      setBusy(false);
      return;
    }
    router.replace(safeNext(next) ?? `/${lang}`);
    // The top bar and the pages read who is logged in on the server, so ask them to look again.
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-lg">
      {reset ? <Notice kind="success">{t("logIn.passwordChanged")}</Notice> : null}
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
        autoComplete="current-password"
        reveal
        value={password}
        onChange={setPassword}
        error={errors.password ? t(errors.password) : undefined}
      />
      <Link
        href={`/${lang}/forgot-password`}
        className="self-start text-body-sm font-bold text-primary hover:underline"
      >
        {t("logIn.forgot")}
      </Link>
      <SubmitButton busy={busy}>{t("logIn.submit")}</SubmitButton>
      <SocialSlot lang={lang} next={next} providers={providers} />
      <p className="text-center text-body-sm text-text-3">
        {t("logIn.noAccount")}{" "}
        <Link href={signUpHref(lang, next)} className="font-bold text-primary hover:underline">
          {t("logIn.signUp")}
        </Link>
      </p>
    </form>
  );
}
