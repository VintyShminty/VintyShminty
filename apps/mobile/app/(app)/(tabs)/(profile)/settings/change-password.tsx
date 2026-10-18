import { zodResolver } from "@hookform/resolvers/zod";
import { type ChangePasswordForm, changePasswordFormSchema } from "@vinty/shared";
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
import { hasSavedLoginFor, storeLogin } from "@/lib/saved-login";

export default function ChangePassword() {
  const { t } = useTranslation();
  const router = useRouter();
  const [banner, setBanner] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { data: session } = authClient.useSession();
  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const { control, handleSubmit, setError, formState } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordFormSchema),
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const secure = { show: t("fields.showPassword"), hide: t("fields.hidePassword") };

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      // Anyone else who had the old password is logged out.
      revokeOtherSessions: true,
    });
    if (error) {
      const problem = describeAuthError(error);
      if (error.code === "INVALID_PASSWORD") setError("currentPassword", { message: "errors.wrongPassword" });
      else if (problem.field === "password") setError("newPassword", { message: problem.key });
      else setBanner(t(problem.key));
      return;
    }
    // Face ID login keeps working with the new password.
    const user = session?.user;
    if (user && hasSavedLoginFor(user.id)) {
      void storeLogin({ email: user.email, password: values.newPassword, userId: user.id }, t("lock.prompt"));
    }
    setDone(true);
  });

  return (
    <Screen>
      <TopBar title={t("account.changePassword")} />
      <ScreenScroll>
        {done ? (
          <View className="gap-xl">
            <Banner variant="success">{t("account.passwordChanged")}</Banner>
            <Button size="lg" onPress={() => router.back()}>
              <Text>{t("common.done")}</Text>
            </Button>
          </View>
        ) : (
          <>
            {banner ? (
              <Banner variant="error" className="mb-lg">
                {banner}
              </Banner>
            ) : null}
            <View className="gap-lg">
              <FormInput
                control={control}
                name="currentPassword"
                label={t("fields.currentPassword")}
                secureTextEntry
                secureToggle={secure}
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="next"
                onSubmitEditing={() => newRef.current?.focus()}
                submitBehavior="submit"
              />
              <FormInput
                control={control}
                name="newPassword"
                inputRef={newRef}
                label={t("fields.newPassword")}
                hint={t("fields.passwordHint")}
                secureTextEntry
                secureToggle={secure}
                autoCapitalize="none"
                autoComplete="password"
                // Not "newPassword": iOS then offers a Strong Password, which jams without an associated domain (none yet).
                textContentType="password"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                submitBehavior="submit"
              />
              <FormInput
                control={control}
                name="confirmPassword"
                inputRef={confirmRef}
                label={t("fields.confirmPassword")}
                secureTextEntry
                secureToggle={secure}
                autoCapitalize="none"
                autoComplete="password"
                // Not "newPassword": iOS then offers a Strong Password, which jams without an associated domain (none yet).
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />
            </View>
            <Text variant="cardDesc" className="mt-md text-text-3">
              {t("account.passwordLogsOut")}
            </Text>
            <Button size="lg" className="mt-xl" loading={formState.isSubmitting} onPress={onSubmit}>
              <Text>{t("account.changePassword")}</Text>
            </Button>
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}
