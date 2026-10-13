import { useInfiniteQuery } from "@tanstack/react-query";
import type { MyBump } from "@vinty/shared";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Clock, Zap } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { ForwardIcon, TopBar } from "@/components/ui/top-bar";
import { myBumpsQuery } from "@/lib/bump-queries";
import { useLocalName } from "@/lib/reference";
import { formatDateTime } from "@/lib/time";
import { colors } from "@/theme";

/** One buzz: the item photo, the plan, and when it ends or ended. Tap opens the item. */
function BuzzRow({ bump }: { bump: MyBump }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const name = useLocalName();
  const when = formatDateTime(bump.endsAt, i18n.language);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/listing/[id]", params: { id: bump.listing.id } })}
      role="button"
      accessibilityLabel={`${bump.listing.title}, ${name(bump.plan.name)}`}
      className="flex-row items-center gap-md border-b border-border-subtle px-lg py-md active:bg-surface"
    >
      <View className="h-16 w-12 overflow-hidden rounded-control bg-pressed">
        {bump.listing.cover ? (
          <Image
            source={{ uri: bump.listing.cover.url }}
            placeholder={bump.listing.cover.placeholder ?? undefined}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            recyclingKey={bump.id}
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>
      <View className="flex-1 gap-xs">
        <Text weight={600} numberOfLines={1} className="self-start">
          {bump.listing.title || t("listing.untitled")}
        </Text>
        <Text variant="bodySmall" className="self-start text-text-3" numberOfLines={1}>
          {name(bump.plan.name)}
        </Text>
        <Text variant="bodySmall" className="self-start text-text-3">
          {bump.isActive ? t("buzz.endsOn", { date: when }) : t("buzz.endedOn", { date: when })}
        </Text>
      </View>
      {bump.isActive ? (
        <Badge variant="accent" icon={Zap} label={t("buzz.buzzing")} />
      ) : (
        <Badge variant="neutral" icon={Clock} label={t("buzz.ended")} />
      )}
      <ForwardIcon />
    </Pressable>
  );
}

/** Your buzzes: every time you gave an item buzz, newest first. Reached from your own profile. */
export default function Buzzes() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const query = useInfiniteQuery(myBumpsQuery());
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen>
      <TopBar title={t("buzz.yourBuzzes")} />
      {query.isPending ? (
        <Spinner size="large" />
      ) : query.isError && !query.data ? (
        <View className="gap-lg px-lg">
          <Banner variant="error">{t("errors.loadFailed")}</Banner>
          <Button variant="outline" onPress={() => query.refetch()}>
            <Text>{t("common.tryAgain")}</Text>
          </Button>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          renderItem={({ item }) => <BuzzRow bump={item} />}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => void query.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View className="items-center gap-sm px-xl py-2xl">
              <Text variant="heading" className="text-center">
                {t("buzz.empty")}
              </Text>
              <Text variant="subtitle" className="text-center text-text-3">
                {t("buzz.emptyNote")}
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}
