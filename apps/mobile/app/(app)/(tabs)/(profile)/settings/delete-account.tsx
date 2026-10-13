import { zodResolver } from "@hookform/resolvers/zod";
import { PASSWORD_MAX } from "@vinty/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";
import { z } from "zod";
import { FormInput } from "@/components/form-input";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { ApiClientError, api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { describeApiError } from "@/lib/auth-errors";
import { queryClient } from "@/lib/query-client";

const formSchema = z.object({
  password: z.string().min(1, "validation.password.required").max(PASSWORD_MAX),
});
type Values = z.infer<typeof formSchema>;

/** Settings, Account settings, Delete my account (open decision 15: close it, keep orders and reviews anonymous). */
export default function DeleteAccount() {
  const { t } = useTranslation();
  const [banner, setBanner] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: { password: "" },
  });

  const run = handleSubmit(async ({ password }) => {
    setBanner(null);
    try {
      await api("/v1/me", { method: "DELETE", body: { password } });
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403)
        setError("password", { message: "errors.wrongPassword" });
      else if (err instanceof ApiClientError && err.status === 409) setBanner(t("account.deleteBlocked"));
      else setBanner(t(describeApiError(err).key));
      return;
    }
    // The account is closed on the server. Clear this phone too, which sends the person to the welcome screen.
    await authClient.signOut().catch(() => {});
    queryClient.clear();
  });

  const confirm = handleSubmit(() => {
    Alert.alert(t("account.deleteConfirmTitle"), t("account.deleteConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("account.deleteConfirm"), style: "destructive", onPress: () => void run() },
    ]);
  });

  return (
    <Screen>
      <TopBar title={t("account.delete")} />
      <ScreenScroll>
        <Text variant="heading">{t("account.deleteTitle")}</Text>
        <View className="mt-md gap-sm">
          <Text variant="bodySmall" className="text-text-2">
            {t("account.deleteBullet1")}
          </Text>
          <Text variant="bodySmall" className="text-text-2">
            {t("account.deleteBullet2")}
          </Text>
          <Text variant="bodySmall" className="text-text-2">
            {t("account.deleteBullet3")}
          </Text>
        </View>
        {banner ? (
          <Banner variant="error" className="mt-lg">
            {banner}
          </Banner>
        ) : null}
        <View className="mt-xl">
          <FormInput
            control={control}
            name="password"
            label={t("account.deletePassword")}
            secureTextEntry
            secureToggle={{ show: t("fields.showPassword"), hide: t("fields.hidePassword") }}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={confirm}
          />
        </View>
        <Button
          size="lg"
          variant="destructive"
          className="mt-xl"
          loading={formState.isSubmitting}
          onPress={confirm}
        >
          <Text>{t("account.delete")}</Text>
        </Button>
      </ScreenScroll>
    </Screen>
  );
}
