import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { GoogleMark } from "@/components/google-mark";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useSocialProviders } from "@/lib/auth-providers";
import { type SocialProvider, signInWithApple, signInWithGoogle } from "@/lib/social-login";
import { cn } from "@/lib/utils";
import { radii } from "@/theme";

/**
 * "Continue with Apple" and "Continue with Google". Shows nothing until the server says the provider has keys,
 * so the buttons are simply absent while Apple or Google is not set up (D-023).
 * `onPhoto` is for the welcome screen, where the buttons sit on the dark photo.
 */
export function SocialButtons({ onPhoto = false, className }: { onPhoto?: boolean; className?: string }) {
  const { t } = useTranslation();
  const providers = useSocialProviders();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!providers.apple && !providers.google) return null;

  const run = async (provider: SocialProvider, start: typeof signInWithApple) => {
    if (busy) return;
    setBusy(provider);
    setError(null);
    const result = await start();
    // On success the app switches to the tabs by itself, so there is nothing to show.
    if (result.status === "error") {
      setError(
        t(result.key, { provider: t(provider === "apple" ? "social.appleName" : "social.googleName") }),
      );
    }
    setBusy(null);
  };

  return (
    <View className={cn("gap-md", className)}>
      <View className="flex-row items-center gap-md">
        <View className={cn("h-px flex-1", onPhoto ? "bg-primary-foreground/40" : "bg-border")} />
        <Text variant="bodySmall" className={onPhoto ? "text-primary-foreground/90" : "text-text-3"}>
          {t("social.or")}
        </Text>
        <View className={cn("h-px flex-1", onPhoto ? "bg-primary-foreground/40" : "bg-border")} />
      </View>
      {error ? <Banner variant="error">{error}</Banner> : null}
      {providers.apple ? (
        // Apple requires its own button, with its own words (they follow the phone language).
        <View pointerEvents={busy ? "none" : "auto"} style={{ opacity: busy && busy !== "apple" ? 0.5 : 1 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              onPhoto
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE
            }
            cornerRadius={radii.control}
            style={{ width: "100%", height: 48 }}
            onPress={() => run("apple", signInWithApple)}
          />
        </View>
      ) : null}
      {providers.google ? (
        <Button
          size="lg"
          variant="ghost"
          className={cn("bg-background", onPhoto ? "border-background" : "border-border")}
          loading={busy === "google"}
          disabled={busy === "apple"}
          onPress={() => run("google", signInWithGoogle)}
        >
          {busy === "google" ? null : <GoogleMark />}
          <Text className="text-text-1">{t("social.google")}</Text>
        </Button>
      ) : null}
    </View>
  );
}
