import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OTP_LENGTH, verifyCodeInputSchema } from "@vinty/shared";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import type { z } from "zod";
import { FormInput } from "@/components/form-input";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { authClient } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth-errors";
import { meQuery } from "@/lib/queries";

type Values = z.infer<typeof verifyCodeInputSchema>;
const RESEND_SECONDS = 30;

/** Settings, Account settings, Verify email: type the 6 digit code from the email. */
export default function VerifyEmail() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useQuery(meQuery());
  const [banner, setBanner] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [wait, setWait] = useState(0);
  const { control, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(verifyCodeInputSchema),
    mode: "onTouched",
    defaultValues: { otp: "" },
  });

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  if (!me) {
    return (
      <Screen>
        <TopBar title={t("account.verifyEmail")} />
        <Spinner />
      </Screen>
    );
  }

  const resend = async () => {
    setBanner(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: me.email,
      type: "email-verification",
    });
    if (error) {
      setBanner(t(describeAuthError(error).key));
      return;
    }
    setSent(true);
    setWait(RESEND_SECONDS);
  };

  const onSubmit = handleSubmit(async ({ otp }) => {
    setBanner(null);
    const { error } = await authClient.emailOtp.verifyEmail({ email: me.email, otp });
    if (error) {
      const problem = describeAuthError(error);
      if (problem.field === "otp") setError("otp", { message: problem.key });
      else setBanner(t(problem.key));
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["me"] });
    void queryClient.invalidateQueries({ queryKey: ["profile", me.id] });
    setDone(true);
  });

  return (
    <Screen>
      <TopBar title={t("account.verifyEmail")} />
      <ScreenScroll>
        {done ? (
          <View className="gap-xl">
            <Banner variant="success">{t("account.emailVerifiedDone")}</Banner>
            <Button size="lg" onPress={() => router.back()}>
              <Text>{t("common.done")}</Text>
            </Button>
          </View>
        ) : (
          <>
            <Text variant="subtitle" className="mb-xl">
              {sent
                ? t("forgot.codeResent", { email: me.email })
                : t("account.verifyIntro", { email: me.email })}
            </Text>
            {banner ? (
              <Banner variant="error" className="mb-lg">
                {banner}
              </Banner>
            ) : null}
            <FormInput
              control={control}
              name="otp"
              label={t("fields.code")}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
            <Button size="lg" className="mt-xl" loading={formState.isSubmitting} onPress={onSubmit}>
              <Text>{t("account.verifyButton")}</Text>
            </Button>
            <Text
              variant="bodySmall"
              weight={700}
              className={`mt-xl self-center ${wait > 0 ? "text-text-4" : "text-primary"}`}
              role="link"
              onPress={wait > 0 ? undefined : resend}
            >
              {wait > 0 ? t("forgot.resendIn", { seconds: wait }) : t("forgot.resend")}
            </Text>
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}
