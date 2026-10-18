import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WelcomeContent } from "@/components/auth-motion";
import { SocialButtons } from "@/components/social-buttons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { LANGUAGE_PREF_KEY, type Language, SUPPORTED_LANGUAGES } from "@/i18n";
import { useAppStore } from "@/lib/app-store";
import { readPref } from "@/lib/secure-prefs";

/**
 * First screen for someone who is not logged in: one strong photo with the headline over it (D-021).
 * The very first time on this phone it starts with the language, so everything after it (sign up, the welcome
 * questions, emails) is in the language the person is comfortable with (D-058).
 */
export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [choosing, setChoosing] = useState(() => readPref(LANGUAGE_PREF_KEY) === null);
  if (choosing) return <LanguageStep onChosen={() => setChoosing(false)} />;
  return (
    <WelcomeContent>
      <View
        className="flex-1 px-lg"
        style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}
      >
        <Text
          weight={800}
          className="text-primary-foreground"
          style={{ fontSize: 28, lineHeight: 34, letterSpacing: -1 }}
        >
          Yadii
        </Text>
        <View className="mt-md self-start rounded-full bg-background/95 px-md py-xs">
          <Text variant="cardMeta" weight={700} className="text-text-1">
            {t("welcome.photoChip")}
          </Text>
        </View>
        <View className="flex-1 justify-end">
          <Text
            weight={700}
            className="text-primary-foreground"
            style={{ fontSize: 36, lineHeight: 40, letterSpacing: -1 }}
          >
            {t("welcome.title")}
          </Text>
          <Text variant="subtitle" className="mt-sm text-primary-foreground/90">
            {t("welcome.subtitle")}
          </Text>
          <View className="mt-xl gap-md">
            <Button
              size="lg"
              className="bg-background active:bg-pressed"
              onPress={() => router.push("/sign-up")}
            >
              <Text className="text-primary">{t("welcome.signUp")}</Text>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/60 bg-transparent active:bg-primary-foreground/10"
              onPress={() => router.push("/log-in")}
            >
              <Text className="text-primary-foreground">{t("welcome.logIn")}</Text>
            </Button>
          </View>
          <SocialButtons onPhoto className="mt-lg" />
        </View>
      </View>
    </WelcomeContent>
  );
}

/** The language step: the question in both languages, then one big button each, written in its own language. */
function LanguageStep({ onChosen }: { onChosen: () => void }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const choose = (language: Language) => {
    setLanguage(language);
    onChosen();
  };
  return (
    <WelcomeContent>
      <View
        className="flex-1 px-lg"
        style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}
      >
        <Text
          weight={800}
          className="text-primary-foreground"
          style={{ fontSize: 28, lineHeight: 34, letterSpacing: -1 }}
        >
          Yadii
        </Text>
        <View className="flex-1 justify-end">
          {SUPPORTED_LANGUAGES.map((language) => (
            <Text
              key={language}
              weight={700}
              font={language === "he" ? "heebo" : "aileron"}
              className="text-center text-primary-foreground"
              style={{ fontSize: 32, lineHeight: 38, letterSpacing: -0.5 }}
            >
              {i18n.t("welcome.chooseLanguage", { lng: language })}
            </Text>
          ))}
          <View className="mt-xl gap-md">
            {SUPPORTED_LANGUAGES.map((language) => (
              <Button
                key={language}
                size="lg"
                className="bg-background active:bg-pressed"
                onPress={() => choose(language)}
              >
                <Text className="text-primary" font={language === "he" ? "heebo" : "aileron"}>
                  {i18n.t(`languages.${language}`)}
                </Text>
              </Button>
            ))}
          </View>
        </View>
      </View>
    </WelcomeContent>
  );
}
