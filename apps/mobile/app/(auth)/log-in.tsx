import { zodResolver } from "@hookform/resolvers/zod";
import { type SignInInput, signInInputSchema } from "@vinty/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TextInput } from "react-native";
import { View } from "react-native";
import { AuthPhotoBand } from "@/components/auth-photo";
import { FormInput } from "@/components/form-input";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth-errors";
import { useLockStore } from "@/lib/lock-store";

export default function LogIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ reset?: string; email?: string }>();
  const [banner, setBanner] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const { control, handleSubmit, formState } = useForm<SignInInput>({
    resolver: zodResolver(signInInputSchema),
    mode: "onTouched",
    defaultValues: { email: params.email ?? "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    const { error } = await authClient.signIn.email({ email: values.email, password: values.password });
    if (error) {
      setBanner(t(describeAuthError(error).key));
      return;
    }
    useLockStore.getState().unlock();
  });

  return (
    <Screen topInset={false}>
      <AuthPhotoBand />
      <ScreenScroll>
        <Text variant="title" className="mt-lg">
          {t("logIn.title")}
        </Text>
        <Text variant="subtitle" className="mb-xl mt-sm">
          {t("logIn.subtitle")}
        </Text>
        {params.reset ? (
          <Banner variant="success" className="mb-lg">
            {t("logIn.passwordChanged")}
          </Banner>
        ) : null}
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
            secureTextEntry
            secureToggle={{ show: t("fields.showPassword"), hide: t("fields.hidePassword") }}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
        </View>
        <Text
          variant="bodySmall"
          weight={700}
          className="mt-md self-start text-primary"
          role="link"
          onPress={() => router.push("/forgot-password")}
        >
          {t("logIn.forgot")}
        </Text>
        <Button size="lg" className="mt-xl" loading={formState.isSubmitting} onPress={onSubmit}>
          <Text>{t("logIn.submit")}</Text>
        </Button>
        <View className="mt-xl flex-row items-center justify-center gap-xs">
          <Text variant="bodySmall" className="text-text-3">
            {t("logIn.noAccount")}
          </Text>
          <Text
            variant="bodySmall"
            weight={700}
            className="text-primary"
            role="link"
            onPress={() => router.replace("/sign-up")}
          >
            {t("logIn.signUp")}
          </Text>
        </View>
      </ScreenScroll>
    </Screen>
  );
}
