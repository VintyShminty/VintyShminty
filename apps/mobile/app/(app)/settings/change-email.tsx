import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { changeEmailInputSchema, OTP_LENGTH, verifyCodeInputSchema } from "@vinty/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import type { z } from "zod";
import { FormInput } from "@/components/form-input";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { authClient } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth-errors";
import { meQuery } from "@/lib/queries";

type EmailValues = z.infer<typeof changeEmailInputSchema>;
type CodeValues = z.infer<typeof verifyCodeInputSchema>;

/** Settings, Account settings, Email: enter the new address, then the code sent to it. */
export default function ChangeEmail() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useQuery(meQuery());
  const [newEmail, setNewEmail] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(changeEmailInputSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });
  const codeForm = useForm<CodeValues>({
    resolver: zodResolver(verifyCodeInputSchema),
    mode: "onTouched",
    defaultValues: { otp: "" },
  });

  const sendCode = emailForm.handleSubmit(async ({ email }) => {
    setBanner(null);
    if (me && email.toLowerCase() === me.email.toLowerCase()) {
      emailForm.setError("email", { message: "errors.sameEmail" });
      return;
    }
    const { error } = await authClient.emailOtp.requestEmailChange({ newEmail: email });
    if (error) {
      const problem = describeAuthError(error);
      if (problem.field === "email") emailForm.setError("email", { message: problem.key });
      else setBanner(t(problem.key));
      return;
    }
    setNewEmail(email);
  });

  const confirm = codeForm.handleSubmit(async ({ otp }) => {
    if (!newEmail) return;
    setBanner(null);
    const { error } = await authClient.emailOtp.changeEmail({ newEmail, otp });
    if (error) {
      const problem = describeAuthError(error);
      if (problem.field === "otp") codeForm.setError("otp", { message: problem.key });
      else if (problem.field === "email") {
        setBanner(t(problem.key));
      } else setBanner(t(problem.key));
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["me"] });
    if (me) void queryClient.invalidateQueries({ queryKey: ["profile", me.id] });
    setDone(true);
  });

  return (
    <Screen>
      <TopBar title={t("fields.email")} />
      <ScreenScroll>
        {done ? (
          <View className="gap-xl">
            <Banner variant="success">{t("account.emailChanged", { email: newEmail ?? "" })}</Banner>
            <Button size="lg" onPress={() => router.back()}>
              <Text>{t("common.done")}</Text>
            </Button>
          </View>
        ) : newEmail ? (
          <>
            <Text variant="subtitle" className="mb-xl">
              {t("forgot.codeSent", { email: newEmail })}
            </Text>
            {banner ? (
              <Banner variant="error" className="mb-lg">
                {banner}
              </Banner>
            ) : null}
            <FormInput
              control={codeForm.control}
              name="otp"
              label={t("fields.code")}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="go"
              onSubmitEditing={confirm}
            />
            <Button size="lg" className="mt-xl" loading={codeForm.formState.isSubmitting} onPress={confirm}>
              <Text>{t("account.confirmEmail")}</Text>
            </Button>
            <Text
              variant="bodySmall"
              weight={700}
              className="mt-xl self-center text-primary"
              role="link"
              onPress={() => setNewEmail(null)}
            >
              {t("forgot.differentEmail")}
            </Text>
          </>
        ) : (
          <>
            <Text variant="subtitle" className="mb-xl">
              {t("account.emailIntro", { email: me?.email ?? "" })}
            </Text>
            {banner ? (
              <Banner variant="error" className="mb-lg">
                {banner}
              </Banner>
            ) : null}
            <FormInput
              control={emailForm.control}
              name="email"
              label={t("fields.newEmail")}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={sendCode}
            />
            <Button size="lg" className="mt-xl" loading={emailForm.formState.isSubmitting} onPress={sendCode}>
              <Text>{t("forgot.sendCode")}</Text>
            </Button>
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}
