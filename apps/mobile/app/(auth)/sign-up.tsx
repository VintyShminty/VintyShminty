import { zodResolver } from "@hookform/resolvers/zod";
import { type SignUpInput, signUpInputSchema } from "@vinty/shared";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TextInput } from "react-native";
import { View } from "react-native";
import { AuthSheet } from "@/components/auth-motion";
import { FormInput } from "@/components/form-input";
import { SocialButtons } from "@/components/social-buttons";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { ScreenScroll } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth-errors";
import { useLockStore } from "@/lib/lock-store";
import { markOnboardingPending } from "@/lib/onboarding";

export default function SignUp() {
  const { t } = useTranslation();
  const router = useRouter();
  const [banner, setBanner] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const { control, handleSubmit, setError, formState } = useForm<SignUpInput>({
    resolver: zodResolver(signUpInputSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    const { data, error } = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      // No name or username here (D-020). The server makes the username from the email, and the name starts as it.
      name: "",
    });
    if (error) {
      const problem = describeAuthError(error);
      if (problem.field === "email" || problem.field === "password") {
        setError(problem.field, { message: problem.key });
      } else {
        setBanner(t(problem.key));
      }
      return;
    }
    // A new account gets the two short questions once, before Home (lib/onboarding.ts).
    if (data?.user.id) markOnboardingPending(data.user.id);
    // Logged in. The app switches to the tabs by itself.
    useLockStore.getState().unlock();
  });

  return (
    <AuthSheet>
      <ScreenScroll>
        <Text variant="title" className="mt-lg">
          {t("signUp.title")}
        </Text>
        <Text variant="subtitle" className="mb-xl mt-sm">
          {t("signUp.subtitle")}
        </Text>
        {banner ? (
          <Banner variant="error" className="mb-lg">
            {banner}
          </Banner>
        ) : null}
        <View className="gap-lg">
          <FormInput
            control={control}
            name="email"
            label={t("fields.email")}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
          />
          <FormInput
            control={control}
            name="password"
            inputRef={passwordRef}
            label={t("fields.password")}
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
          <Text>{t("signUp.submit")}</Text>
        </Button>
        <SocialButtons className="mt-xl" />
        <View className="mt-xl flex-row items-center justify-center gap-xs">
          <Text variant="bodySmall" className="text-text-3">
            {t("signUp.haveAccount")}
          </Text>
          <Text
            variant="bodySmall"
            weight={700}
            className="text-primary"
            role="link"
            onPress={() => router.replace("/log-in")}
          >
            {t("signUp.logIn")}
          </Text>
        </View>
      </ScreenScroll>
    </AuthSheet>
  );
}
