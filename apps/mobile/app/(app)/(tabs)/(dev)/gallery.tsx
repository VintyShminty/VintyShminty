import { Stack } from "expo-router";
import { Check, Clock, Sparkles, TrendingDown, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useAppStore } from "@/lib/app-store";
import { colors } from "@/theme";

// Dev-only screen. It proves tokens, fonts, Reusables components and icons work.
// Class names are written out in full so Tailwind can see them.
const SWATCHES: { name: keyof typeof colors; className: string }[] = [
  { name: "background", className: "bg-background" },
  { name: "surface", className: "bg-surface" },
  { name: "pressed", className: "bg-pressed" },
  { name: "border", className: "bg-border" },
  { name: "borderSubtle", className: "bg-border-subtle" },
  { name: "text1", className: "bg-text-1" },
  { name: "text2", className: "bg-text-2" },
  { name: "text3", className: "bg-text-3" },
  { name: "text4", className: "bg-text-4" },
  { name: "accent", className: "bg-primary" },
  { name: "accentTint", className: "bg-accent-tint" },
  { name: "chipSelected", className: "bg-chip-selected" },
  { name: "success", className: "bg-success" },
  { name: "successTint", className: "bg-success-tint" },
  { name: "warning", className: "bg-warning" },
  { name: "warningTint", className: "bg-warning-tint" },
  { name: "error", className: "bg-error" },
  { name: "errorTint", className: "bg-error-tint" },
];

const TYPE_ROWS = [
  { variant: "display", label: "display 40 / 300" },
  { variant: "title", label: "title 32 / 700" },
  { variant: "itemName", label: "itemName 28 / 800" },
  { variant: "heading", label: "heading 18 / 700" },
  { variant: "body", label: "body 16 / 400" },
  { variant: "subtitle", label: "subtitle 14 / 400" },
  { variant: "cardBrand", label: "cardBrand 13.5 / 800" },
  { variant: "pill", label: "pill 13 / 500" },
  { variant: "cardDesc", label: "cardDesc 12 / 400" },
  { variant: "sectionLabel", label: "sectionLabel 12 / 600" },
  { variant: "cardMeta", label: "cardMeta 11 / 400" },
  { variant: "smallLabel", label: "smallLabel 10 / 500" },
  { variant: "badge", label: "badge 10 / 600" },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-xl">
      <Text variant="sectionLabel" className="mb-md">
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function Gallery() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [chip, setChip] = useState("all");
  const { language, setLanguage } = useAppStore();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }}
      >
        <View className="px-lg">
          <Text variant="title" className="mb-lg">
            {t("gallery.title")}
          </Text>

          <Section title={t("common.language")}>
            <View className="flex-row gap-sm">
              <Chip label="English" selected={language === "en"} onPress={() => setLanguage("en")} />
              <Chip label="עברית" selected={language === "he"} onPress={() => setLanguage("he")} />
            </View>
          </Section>

          <Section title={t("gallery.colours")}>
            <View className="flex-row flex-wrap gap-md">
              {SWATCHES.map(({ name, className }) => (
                <View key={name} className="w-[30%]">
                  <View className={`h-12 rounded-control border border-border-subtle ${className}`} />
                  <Text variant="cardMeta" className="mt-xs">
                    {name}
                  </Text>
                  <Text variant="cardMeta" className="text-text-4">
                    {colors[name]}
                  </Text>
                </View>
              ))}
            </View>
          </Section>

          <Section title={t("gallery.typeScale")}>
            {TYPE_ROWS.map(({ variant, label }) => (
              <View key={variant} className="mb-md">
                <Text variant="smallLabel" font="aileron" className="mb-xs normal-case">
                  {label}
                </Text>
                <Text variant={variant} font="aileron" numberOfLines={1}>
                  {t("gallery.sample", { lng: "en" })}
                </Text>
                <Text variant={variant} font="heebo" numberOfLines={1} style={{ writingDirection: "rtl" }}>
                  {t("gallery.hebrewSample")}
                </Text>
              </View>
            ))}
          </Section>

          <Section title={t("gallery.buttons")}>
            <View className="gap-md">
              <Button size="lg">
                <Text>{t("gallery.primary")}</Text>
              </Button>
              <Button variant="outline">
                <Text>{t("gallery.outline")}</Text>
              </Button>
              <Button variant="ghost" size="sm">
                <Text>{t("gallery.ghost")}</Text>
              </Button>
              <Button disabled>
                <Text>{t("gallery.primary")}</Text>
              </Button>
            </View>
          </Section>

          <Section title={t("gallery.badges")}>
            <View className="flex-row flex-wrap gap-sm">
              <Badge variant="accent" icon={Sparkles} label={t("gallery.priceDrop")} />
              <Badge variant="success" icon={Check} label={t("gallery.sold")} />
              <Badge variant="warning" icon={Clock} label={t("gallery.reserved")} />
              <Badge variant="error" icon={X} label={t("gallery.cancelled")} />
              <Badge variant="neutral" icon={TrendingDown} label={t("gallery.info")} />
            </View>
          </Section>

          <Section title={t("gallery.chips")}>
            <View className="flex-row flex-wrap gap-sm">
              <Chip
                label={t("gallery.all")}
                count={19}
                selected={chip === "all"}
                onPress={() => setChip("all")}
              />
              <Chip
                label={t("gallery.dresses")}
                selected={chip === "dresses"}
                onPress={() => setChip("dresses")}
              />
              <Chip label={t("gallery.dresses")} disabled />
            </View>
          </Section>

          <Section title={t("gallery.switch")}>
            <View className="gap-md">
              <View className="flex-row items-center justify-between">
                <Text>{t("gallery.bundleDiscounts")}</Text>
                <Switch checked={on} onCheckedChange={setOn} />
              </View>
              <View className="flex-row items-center justify-between">
                <Text>{t("gallery.bundleDiscounts")}</Text>
                <Switch checked={off} onCheckedChange={setOff} />
              </View>
            </View>
          </Section>
        </View>
      </ScrollView>
    </>
  );
}
