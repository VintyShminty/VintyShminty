import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { type ChangeUsernameForm, changeUsernameFormSchema } from "@vinty/shared";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormInput } from "@/components/form-input";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { ApiClientError } from "@/lib/api";
import { describeApiError } from "@/lib/auth-errors";
import { meQuery, useUpdateProfile } from "@/lib/queries";

export default function ChangeUsername() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: me } = useQuery(meQuery());
  const update = useUpdateProfile();
  const [banner, setBanner] = useState<string | null>(null);
  const { control, handleSubmit, reset, setError, formState } = useForm<ChangeUsernameForm>({
    resolver: zodResolver(changeUsernameFormSchema),
    mode: "onTouched",
    defaultValues: { username: "" },
  });
  useEffect(() => {
    if (me?.username) reset({ username: me.username });
  }, [me?.username, reset]);

  const onSubmit = handleSubmit(async ({ username }) => {
    setBanner(null);
    try {
      await update.mutateAsync({ username });
      router.back();
    } catch (err) {
      if (err instanceof ApiClientError && err.fields?.username) {
        setError("username", { message: err.fields.username });
      } else {
        setBanner(t(describeApiError(err).key));
      }
    }
  });

  return (
    <Screen>
      <TopBar title={t("fields.username")} />
      <ScreenScroll>
        <Text variant="subtitle" className="mb-xl">
          {t("account.usernameIntro")}
        </Text>
        {banner ? (
          <Banner variant="error" className="mb-lg">
            {banner}
          </Banner>
        ) : null}
        <FormInput
          control={control}
          name="username"
          label={t("fields.username")}
          hint={t("fields.usernameHint")}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />
        <Button
          size="lg"
          className="mt-xl"
          loading={update.isPending}
          disabled={!formState.isDirty}
          onPress={onSubmit}
        >
          <Text>{t("common.save")}</Text>
        </Button>
      </ScreenScroll>
    </Screen>
  );
}
