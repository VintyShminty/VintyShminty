import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ForgotPasswordInput,
  forgotPasswordInputSchema,
  OTP_LENGTH,
  type ResetPasswordInput,
  resetPasswordInputSchema,
} from "@vinty/shared";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TextInput } from "react-native";
import { View } from "react-native";
import { FormInput } from "@/components/form-input";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth-errors";

const RESEND_SECONDS = 30;

/** Step one: ask for a code by email. */
export function RequestCodeForm({ onSent }: { onSent: (email: string) => void }) {
  const { t } = useTranslation();
  const [banner, setBanner] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordInputSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setBanner(null);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    if (error) {
      setBanner(t(describeAuthError(error).key));
      return;
    }
    onSent(email);
  });

  return (
    <View>
      {banner ? (
        <Banner variant="error" className="mb-lg">
          {banner}
        </Banner>
      ) : null}
      <FormInput
        control={control}
        name="email"
        label={t("fields.email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={onSubmit}
      />
      <Button size="lg" className="mt-xl" loading={formState.isSubmitting} onPress={onSubmit}>
        <Text>{t("forgot.sendCode")}</Text>
      </Button>
    </View>
  );
}

/** Step two: the 6 digit code from the email and a new password. */
export function ResetPasswordForm({
  email,
  onDone,
  onChangeEmail,
}: {
  email: string;
  onDone: () => void;
  onChangeEmail: () => void;
}) {
  const { t } = useTranslation();
  const [banner, setBanner] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const passwordRef = useRef<TextInput>(null);
  const { control, handleSubmit, setError, formState } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordInputSchema),
    mode: "onTouched",
    defaultValues: { email, otp: "", password: "" },
  });

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const resend = async () => {
    setBanner(null);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    if (error) {
      setBanner(t(describeAuthError(error).key));
      return;
    }
    setResent(true);
    setWait(RESEND_SECONDS);
  };

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    const { error } = await authClient.emailOtp.resetPassword({
      email: values.email,
      otp: values.otp,
      password: values.password,
    });
    if (error) {
      const problem = describeAuthError(error);
      if (problem.field === "otp" || problem.field === "password")
        setError(problem.field, { message: problem.key });
      else setBanner(t(problem.key));
      return;
    }
    onDone();
  });

  return (
    <View>
      <Banner variant="info" className="mb-lg">
        {resent ? t("forgot.codeResent", { email }) : t("forgot.codeSent", { email })}
      </Banner>
      {banner ? (
        <Banner variant="error" className="mb-lg">
          {banner}
        </Banner>
      ) : null}
      <View className="gap-lg">
        <FormInput
          control={control}
          name="otp"
          label={t("fields.code")}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
        />
        <FormInput
          control={control}
          name="password"
          inputRef={passwordRef}
          label={t("fields.newPassword")}
          hint={t("fields.passwordHint")}
          secureTextEntry
          secureToggle={{ show: t("fields.showPassword"), hide: t("fields.hidePassword") }}
          autoCapitalize="none"
          autoComplete="password"
          // Not "newPassword": iOS then offers a Strong Password, which jams without an associated domain (none yet).
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
        />
      </View>
      <Button size="lg" className="mt-xl" loading={formState.isSubmitting} onPress={onSubmit}>
        <Text>{t("forgot.reset")}</Text>
      </Button>
      <View className="mt-xl items-center gap-md">
        <Text
          variant="bodySmall"
          weight={700}
          className={wait > 0 ? "text-text-4" : "text-primary"}
          role="link"
          onPress={wait > 0 ? undefined : resend}
        >
          {wait > 0 ? t("forgot.resendIn", { seconds: wait }) : t("forgot.resend")}
        </Text>
        <Text variant="bodySmall" weight={700} className="text-primary" role="link" onPress={onChangeEmail}>
          {t("forgot.differentEmail")}
        </Text>
      </View>
    </View>
  );
}
