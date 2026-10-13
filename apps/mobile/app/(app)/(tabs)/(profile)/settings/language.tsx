import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { useAppStore } from "@/lib/app-store";
import { useUpdateSettings } from "@/lib/queries";

/**
 * Settings, Language. Picking Hebrew or English switches the app at once, saves it on your account and flips
 * the layout direction with it, no restart (lib/rtl.ts, D-018).
 */
export default function Language() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const update = useUpdateSettings();
  const setLanguage = useAppStore((s) => s.setLanguage);

  const choose = (language: (typeof SUPPORTED_LANGUAGES)[number]) => {
    if (language === i18n.language) return;
    // Save on the account (not awaited), then switch. Everything on screen changes language and direction at once.
    update.mutate({ language });
    setLanguage(language);
  };

  return (
    <Screen>
      <TopBar title={t("settings.language")} onBack={() => router.back()} />
      {SUPPORTED_LANGUAGES.map((language, index) => {
        const selected = i18n.language === language;
        return (
          <Pressable
            key={language}
            onPress={() => choose(language)}
            role="radio"
            accessibilityState={{ selected }}
            className="active:bg-surface"
          >
            <View
              className={`min-h-[58px] flex-row items-center gap-md px-lg ${index < SUPPORTED_LANGUAGES.length - 1 ? "border-b border-border-subtle" : ""}`}
            >
              <Text weight={500} font={language === "he" ? "heebo" : "aileron"} className="flex-1 py-md">
                {t(`languages.${language}`)}
              </Text>
              {selected ? <Icon as={Check} size={20} className="text-primary" /> : null}
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}
