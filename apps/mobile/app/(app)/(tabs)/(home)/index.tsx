import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { type FeedMood, UNDER_50_MINOR } from "@vinty/shared";
import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { ListingGrid } from "@/components/listing-grid";
import { openSearch } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { feedQuery } from "@/lib/discovery-queries";
import { personalisationSizesQuery } from "@/lib/item-queries";
import { formatMoney } from "@/lib/money";
import { meQuery } from "@/lib/queries";

/** The mood chips, in order. The last two need an account (sizes and city). */
const MOODS: { key: FeedMood; needsAccount: boolean }[] = [
  { key: "for_you", needsAccount: false },
  { key: "new_today", needsAccount: false },
  { key: "under_50", needsAccount: false },
  { key: "your_sizes", needsAccount: true },
  { key: "near_you", needsAccount: true },
];

type Part = "morning" | "afternoon" | "evening";

/** Morning until noon, afternoon until 5 in the evening, evening after that (and through the night). */
function partOfDay(date: Date): Part {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

/** Home: a greeting with a round search button, the mood chips and the feed (D-019, row 4). */
export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const [mood, setMood] = useState<FeedMood>("for_you");
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session);
  const me = useQuery({ ...meQuery(), enabled: signedIn });
  const sizes = useQuery({ ...personalisationSizesQuery(), enabled: signedIn });

  const activeMood: FeedMood =
    !signedIn && mood !== "for_you" && MOODS.find((m) => m.key === mood)?.needsAccount ? "for_you" : mood;
  const query = useInfiniteQuery(feedQuery({ mood: activeMood }));

  // First name, or the username when the name is empty. Nothing before the account has loaded.
  const who = me.data?.name?.trim().split(/\s+/)[0] || me.data?.username || null;
  const greeting = t(`home.greeting.${partOfDay(new Date())}`);

  const hasSizes = (sizes.data?.sizeIds.length ?? 0) > 0;
  const city = me.data?.profile.city?.trim() || null;

  let emptyTitle = t("home.emptyTitle");
  let emptyMessage: string | undefined = t("home.emptyMessage");
  let emptyAction: React.ReactElement | null = null;
  if (activeMood === "new_today") {
    emptyTitle = t("home.empty.newToday.title");
    emptyMessage = t("home.empty.newToday.note");
  } else if (activeMood === "under_50") {
    emptyTitle = t("home.empty.under50.title", { amount: formatMoney(UNDER_50_MINOR, "ILS") });
    emptyMessage = t("home.empty.under50.note");
  } else if (activeMood === "your_sizes") {
    if (sizes.isSuccess && !hasSizes) {
      emptyTitle = t("home.empty.sizesUnset.title");
      emptyMessage = t("home.empty.sizesUnset.note");
      emptyAction = (
        <Button variant="outline" className="mt-md" onPress={() => router.push("/settings/personalisation")}>
          <Text>{t("home.empty.sizesUnset.action")}</Text>
        </Button>
      );
    } else {
      emptyTitle = t("home.empty.sizes.title");
      emptyMessage = t("home.empty.sizes.note");
    }
  } else if (activeMood === "near_you") {
    if (me.isSuccess && !city) {
      emptyTitle = t("home.empty.cityUnset.title");
      emptyMessage = t("home.empty.cityUnset.note");
      emptyAction = (
        <Button variant="outline" className="mt-md" onPress={() => router.push("/edit-profile")}>
          <Text>{t("home.empty.cityUnset.action")}</Text>
        </Button>
      );
    } else {
      emptyTitle = t("home.empty.near.title", { city: city ?? "" });
      emptyMessage = t("home.empty.near.note");
    }
  }

  const header = (
    <View className="gap-lg pb-md">
      <View className="flex-row items-start justify-between gap-md px-lg pt-md">
        <View className="flex-1">
          <Text
            variant="title"
            weight={300}
            accessibilityRole="header"
            accessibilityLabel={who ? `${greeting} ${who}` : greeting}
          >
            {greeting}
          </Text>
          <Text variant="title" weight={800} numberOfLines={1}>
            {who ?? t("home.greetingGuest")}
          </Text>
        </View>
        <Pressable
          onPress={() => openSearch(router)}
          role="button"
          accessibilityLabel={t("search.placeholder")}
          className="mt-xs h-11 w-11 items-center justify-center rounded-full border border-border bg-surface active:bg-pressed"
        >
          <Icon as={Search} size={20} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm px-lg">
        {MOODS.filter((m) => signedIn || !m.needsAccount).map((m) => (
          <Chip
            key={m.key}
            label={t(`home.moods.${m.key}`, { amount: formatMoney(UNDER_50_MINOR, "ILS") })}
            selected={activeMood === m.key}
            onPress={() => setMood(m.key)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen bottomInset={false}>
      <ListingGrid
        query={query}
        header={header}
        bottomPadding={16}
        emptyTitle={emptyTitle}
        emptyMessage={emptyMessage}
        emptyAction={emptyAction}
      />
    </Screen>
  );
}
