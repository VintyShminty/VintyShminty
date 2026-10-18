import { zodResolver } from "@hookform/resolvers/zod";
import { type SignInInput, signInInputSchema } from "@vinty/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScanFace } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TextInput } from "react-native";
import { View } from "react-native";
import { AuthSheet } from "@/components/auth-motion";
import { FormInput } from "@/components/form-input";
import { SocialButtons } from "@/components/social-buttons";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ScreenScroll } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth-errors";
import { useBiometricSupport } from "@/lib/biometrics";
import { forgetLogin, notePasswordLogin, readSavedLogin, useSavedLogin } from "@/lib/saved-login";

export default function LogIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ reset?: string; email?: string }>();
  const [banner, setBanner] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const support = useBiometricSupport();
  const saved = useSavedLogin();
  const method = t(`biometric.${support?.kind ?? "generic"}`);
  const canUseFaceId = Boolean(saved) && Boolean(support?.available);
  const [faceIdBusy, setFaceIdBusy] = useState(false);
  const askedOnce = useRef(false);
  const { control, handleSubmit, formState, setValue } = useForm<SignInInput>({
    resolver: zodResolver(signInInputSchema),
    mode: "onTouched",
    defaultValues: { email: params.email ?? "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    const { data, error } = await authClient.signIn.email({ email: values.email, password: values.password });
    if (error) {
      setBanner(t(describeAuthError(error).key));
      return;
    }
    notePasswordLogin(
      { email: values.email, password: values.password, userId: data.user.id },
      t("lock.prompt"),
    );
  });

  const logInWithFaceId = async () => {
    if (faceIdBusy) return;
    setBanner(null);
    setFaceIdBusy(true);
    const login = await readSavedLogin(t("lock.prompt"), t("common.cancel"));
    if (!login) {
      setFaceIdBusy(false);
      return;
    }
    const { error } = await authClient.signIn.email(login);
    setFaceIdBusy(false);
    if (!error) return;
    if (error.status === 401) {
      // The password changed somewhere else (a reset by email code, another phone). Forget it and ask for the new one.
      forgetLogin();
      setValue("email", login.email);
      setBanner(t("faceId.loginStale", { method }));
      return;
    }
    setBanner(t(describeAuthError(error).key));
  };

  // Arriving here with a saved login asks for Face ID straight away, once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when Face ID login becomes possible
  useEffect(() => {
    if (!canUseFaceId || askedOnce.current || params.reset) return;
    askedOnce.current = true;
    void logInWithFaceId();
  }, [canUseFaceId]);

  return (
    <AuthSheet>
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
        {canUseFaceId ? (
          <Button size="lg" className="mb-xl" loading={faceIdBusy} onPress={logInWithFaceId}>
            {!faceIdBusy ? <Icon as={ScanFace} size={20} className="text-primary-foreground" /> : null}
            <Text>{t("faceId.logIn", { method })}</Text>
          </Button>
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
        <SocialButtons className="mt-xl" />
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
    </AuthSheet>
  );
}
