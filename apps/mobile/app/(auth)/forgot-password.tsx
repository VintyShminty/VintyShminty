import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RequestCodeForm, ResetPasswordForm } from "@/components/code-reset-form";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <ScreenScroll>
        <Text variant="title">{email ? t("forgot.titleCode") : t("forgot.title")}</Text>
        <Text variant="subtitle" className="mb-xl mt-sm">
          {email ? t("forgot.subtitleCode") : t("forgot.subtitle")}
        </Text>
        {email ? (
          <ResetPasswordForm
            email={email}
            onChangeEmail={() => setEmail(null)}
            onDone={() => router.replace({ pathname: "/log-in", params: { reset: "1", email } })}
          />
        ) : (
          <RequestCodeForm onSent={setEmail} />
        )}
      </ScreenScroll>
    </Screen>
  );
}
