import { zodResolver } from "@hookform/resolvers/zod";
import { type SignUpInput, signUpInputSchema, usernameSchema } from "@vinty/shared";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TextInput } from "react-native";
import { View } from "react-native";
import { FormInput } from "@/components/form-input";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { authClient } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth-errors";
import { useLockStore } from "@/lib/lock-store";

export default function SignUp() {
  const { t } = useTranslation();
  const router = useRouter();
  const [banner, setBanner] = useState<string | null>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const { control, handleSubmit, setError, getValues, formState } = useForm<SignUpInput>({
    resolver: zodResolver(signUpInputSchema),
    mode: "onTouched",
    defaultValues: { email: "", username: "", password: "" },
  });

  // Tell them right away if the username is taken, not after they have chosen a password too.
  const checkUsername = async () => {
    const username = getValues("username");
    if (!usernameSchema.safeParse(username).success) return;
    const { data } = await authClient.isUsernameAvailable({ username });
    if (data && !data.available) setError("username", { message: "validation.username.taken" });
  };

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    const { error } = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      name: values.username,
      username: values.username,
    });
    if (error) {
      const problem = describeAuthError(error);
      if (problem.field === "email" || problem.field === "username" || problem.field === "password") {
        setError(problem.field, { message: problem.key });
      } else {
        setBanner(t(problem.key));
      }
      return;
    }
    // Logged in. The app switches to the tabs by itself.
    useLockStore.getState().unlock();
  });

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <ScreenScroll>
        <Text variant="title">{t("signUp.title")}</Text>
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
            onSubmitEditing={() => usernameRef.current?.focus()}
            submitBehavior="submit"
          />
          <FormInput
            control={control}
            name="username"
            inputRef={usernameRef}
            label={t("fields.username")}
            hint={t("fields.usernameHint")}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            textContentType="username"
            returnKeyType="next"
            onBlur={checkUsername}
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
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
        </View>
        <Button size="lg" className="mt-xl" loading={formState.isSubmitting} onPress={onSubmit}>
          <Text>{t("signUp.submit")}</Text>
        </Button>
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
    </Screen>
  );
}
