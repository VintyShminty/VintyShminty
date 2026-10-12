import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  ListingCard as ListingCardData,
  MyListingCard,
  MyListingStatus,
  PublicProfile,
  ReviewItem,
  ReviewsPage,
} from "@vinty/shared";
import { useRouter } from "expo-router";
import {
  Award,
  BadgeCheck,
  Check,
  Leaf,
  type LucideIcon,
  MapPin,
  Settings as SettingsIcon,
  Upload,
  Zap,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { ListingCard } from "@/components/listing-card";
import { OwnListingCard } from "@/components/own-listing-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { StarRating } from "@/components/ui/star-rating";
import { Tabs } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { myListingsQuery, profileQuery, userListingsQuery, userReviewsQuery } from "@/lib/queries";
import { formatDate, timeAgo } from "@/lib/time";

// Lucide icon for each badge icon name in the database. Unknown names fall back to a medal.
const BADGE_ICONS: Record<string, LucideIcon> = {
  upload: Upload,
  zap: Zap,
  "badge-check": BadgeCheck,
  leaf: Leaf,
};

type TabKey = "listings" | "reviews" | "about";
type Row =
  | { kind: "pair"; items: [ListingCardData, ListingCardData | undefined] }
  | { kind: "ownPair"; items: [MyListingCard, MyListingCard | undefined] }
  | { kind: "review"; review: ReviewItem }
  | { kind: "reviewSummary"; summary: ReviewsPage["summary"] | null }
  | { kind: "about" }
  | { kind: "empty"; message: string }
  | { kind: "loading" }
  | { kind: "error"; message: string };

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 items-center py-md">
      <Text variant="heading">{value}</Text>
      <Text variant="cardMeta" className="mt-px">
        {label}
      </Text>
    </View>
  );
}

function ProfileHeader({
  profile,
  isSelf,
  tab,
  onTab,
}: {
  profile: PublicProfile;
  isSelf: boolean;
  tab: TabKey;
  onTab: (tab: TabKey) => void;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const lang = i18n.language === "he" ? "he" : "en";
  const location = [
    profile.city,
    t(`countries.${profile.countryCode}`, { defaultValue: profile.countryCode }),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View>
      <View className="flex-row items-center gap-lg px-lg pt-sm">
        <Avatar uri={profile.avatarUrl} name={profile.username ?? profile.name} size={72} />
        <View className="flex-1 gap-xs">
          <Text variant="heading" numberOfLines={1} className="self-start">
            {profile.username ?? t("profile.deletedMember")}
          </Text>
          {profile.name && profile.name !== profile.username ? (
            <Text variant="bodySmall" className="self-start text-text-3" numberOfLines={1}>
              {profile.name}
            </Text>
          ) : null}
          <View className="flex-row items-center gap-sm">
            {profile.reviewCount > 0 ? (
              <>
                <StarRating rating={profile.ratingAverage} />
                <Text variant="cardMeta">{t("profile.reviewCount", { count: profile.reviewCount })}</Text>
              </>
            ) : (
              <Text variant="cardMeta">{t("profile.noReviewsYet")}</Text>
            )}
          </View>
          {location ? (
            <View className="flex-row items-center gap-xs">
              <Icon as={MapPin} size={13} className="text-text-3" />
              <Text variant="cardMeta" numberOfLines={1}>
                {location}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {isSelf ? (
        <View className="px-lg pt-lg">
          <Button variant="outline" onPress={() => router.push("/edit-profile")}>
            <Text>{t("profile.edit")}</Text>
          </Button>
        </View>
      ) : null}

      <View className="mx-lg mt-lg flex-row rounded-control border border-border-subtle">
        <Stat value={profile.activeListingCount} label={t("profile.listings")} />
        <View className="my-sm w-px bg-border-subtle" />
        <Stat value={profile.followerCount} label={t("profile.followers")} />
        <View className="my-sm w-px bg-border-subtle" />
        <Stat value={profile.followingCount} label={t("profile.following")} />
      </View>

      {profile.badges.length > 0 ? (
        <View className="flex-row flex-wrap gap-sm px-lg pt-lg">
          {profile.badges.map((b) => (
            <Badge key={b.slug} variant="accent" icon={BADGE_ICONS[b.icon] ?? Award} label={b.name[lang]} />
          ))}
        </View>
      ) : null}

      <Tabs
        className="mt-lg"
        value={tab}
        onChange={onTab}
        items={[
          { key: "listings", label: t("profile.tabs.listings") },
          { key: "reviews", label: t("profile.tabs.reviews") },
          { key: "about", label: t("profile.tabs.about") },
        ]}
      />
    </View>
  );
}

function ReviewSummary({ summary }: { summary: ReviewsPage["summary"] | null }) {
  const { t } = useTranslation();
  if (!summary) return null;
  const { member, automatic, overall, total } = summary;
  return (
    <View className="mx-lg my-lg rounded-control border border-border-subtle p-lg">
      <View className="flex-row items-center gap-lg">
        <Text variant="title">{overall === null ? "-" : overall.toFixed(1)}</Text>
        <View className="gap-xs">
          <StarRating rating={overall} size={18} />
          <Text variant="cardMeta">{t("profile.reviewCount", { count: total })}</Text>
        </View>
      </View>
      <View className="mt-md gap-xs border-t border-border-subtle pt-md">
        <View className="flex-row justify-between">
          <Text variant="bodySmall" className="text-text-2">
            {t("profile.fromMembers")}
          </Text>
          <Text variant="bodySmall" weight={600}>
            {member.average === null ? "-" : member.average.toFixed(1)} ({member.count})
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text variant="bodySmall" className="text-text-2">
            {t("profile.automatic")}
          </Text>
          <Text variant="bodySmall" weight={600}>
            {automatic.average === null ? "-" : automatic.average.toFixed(1)} ({automatic.count})
          </Text>
        </View>
      </View>
    </View>
  );
}

function ReviewRow({ review }: { review: ReviewItem }) {
  const { t, i18n } = useTranslation();
  return (
    <View className="mx-lg gap-sm border-b border-border-subtle py-lg">
      <View className="flex-row items-center gap-md">
        <Avatar uri={review.reviewer.avatarUrl} name={review.reviewer.username} size={36} />
        <View className="flex-1">
          <Text variant="bodySmall" weight={600}>
            {review.reviewer.username ?? t("profile.deletedMember")}
          </Text>
          <View className="flex-row items-center gap-sm">
            <StarRating rating={review.rating} size={12} />
            <Text variant="cardMeta">{formatDate(review.createdAt, i18n.language)}</Text>
          </View>
        </View>
        {review.isAutomatic ? <Badge variant="neutral" icon={Check} label={t("profile.automatic")} /> : null}
      </View>
      {review.comment ? <Text variant="bodySmall">{review.comment}</Text> : null}
      {review.itemTitle ? (
        <Text variant="cardMeta" numberOfLines={1}>
          {t("profile.reviewFor", { title: review.itemTitle })}
        </Text>
      ) : null}
      {review.replyBody ? (
        <View className="rounded-control bg-surface p-md">
          <Text variant="cardMeta" weight={600} className="mb-xs">
            {t("profile.reply")}
          </Text>
          <Text variant="bodySmall">{review.replyBody}</Text>
        </View>
      ) : null}
    </View>
  );
}

function AboutSection({ profile }: { profile: PublicProfile }) {
  const { t } = useTranslation();
  return (
    <View className="gap-xl px-lg py-lg">
      <View className="gap-xs">
        <Text variant="sectionLabel">{t("profile.about.bio")}</Text>
        <Text className={profile.bio ? "" : "text-text-3"}>{profile.bio ?? t("profile.about.noBio")}</Text>
      </View>
      <View className="gap-sm">
        <Text variant="sectionLabel">{t("profile.about.details")}</Text>
        <View className="flex-row items-center gap-sm">
          <Icon as={MapPin} size={16} className="text-text-3" />
          <Text variant="bodySmall">
            {[profile.city, t(`countries.${profile.countryCode}`, { defaultValue: profile.countryCode })]
              .filter(Boolean)
              .join(", ")}
          </Text>
        </View>
        {profile.lastSeenAt ? (
          <Text variant="bodySmall" className="text-text-2">
            {t("profile.about.lastSeen", { when: timeAgo(profile.lastSeenAt, t) })}
          </Text>
        ) : null}
      </View>
      <View className="gap-sm">
        <Text variant="sectionLabel">{t("profile.about.verified")}</Text>
        <View className="flex-row flex-wrap gap-sm">
          {profile.emailVerified ? (
            <Badge variant="success" icon={Check} label={t("profile.about.email")} />
          ) : null}
          {profile.googleVerified ? <Badge variant="success" icon={Check} label="Google" /> : null}
          {!profile.emailVerified && !profile.googleVerified ? (
            <Text variant="bodySmall" className="text-text-3">
              {t("profile.about.notVerified")}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * A member's profile page: header, then Listings, Reviews and About tabs (docs/design.md, spec "Own profile").
 * Own profile adds Edit profile and the Settings button. Listings and Reviews load from the server.
 */
function ProfileView({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("listings");
  const [status, setStatus] = useState<"active" | "sold">("active");
  const [ownStatus, setOwnStatus] = useState<MyListingStatus>("active");
  const [source, setSource] = useState<"all" | "member" | "automatic">("all");

  const profileQ = useQuery(profileQuery(userId));
  const listingsQ = useInfiniteQuery({
    ...userListingsQuery(userId, status),
    enabled: tab === "listings" && !isSelf,
  });
  // Your own page shows every state of your listings, with views and favourites (spec, Own profile).
  const ownQ = useInfiniteQuery({ ...myListingsQuery(ownStatus), enabled: tab === "listings" && isSelf });
  const ownCounts = ownQ.data?.pages[0]?.counts;
  const reviewsQ = useInfiniteQuery({ ...userReviewsQuery(userId, source), enabled: tab === "reviews" });

  const rows = useMemo<Row[]>(() => {
    if (tab === "about") return [{ kind: "about" }];
    if (tab === "listings" && isSelf) {
      if (ownQ.isError && !ownQ.data) return [{ kind: "error", message: t("errors.loadFailed") }];
      if (!ownQ.data) return [{ kind: "loading" }];
      const items = ownQ.data.pages.flatMap((p) => p.items);
      if (items.length === 0) return [{ kind: "empty", message: t(`profile.ownEmpty.${ownStatus}`) }];
      const pairs: Row[] = [];
      for (let i = 0; i < items.length; i += 2) {
        pairs.push({ kind: "ownPair", items: [items[i] as MyListingCard, items[i + 1]] });
      }
      return pairs;
    }
    if (tab === "listings") {
      if (listingsQ.isError && !listingsQ.data) return [{ kind: "error", message: t("errors.loadFailed") }];
      if (!listingsQ.data) return [{ kind: "loading" }];
      const items = listingsQ.data.pages.flatMap((p) => p.items);
      if (items.length === 0) {
        return [
          { kind: "empty", message: status === "active" ? t("profile.noListings") : t("profile.noSold") },
        ];
      }
      const pairs: Row[] = [];
      for (let i = 0; i < items.length; i += 2) {
        pairs.push({ kind: "pair", items: [items[i] as ListingCardData, items[i + 1]] });
      }
      return pairs;
    }
    if (reviewsQ.isError && !reviewsQ.data) return [{ kind: "error", message: t("errors.loadFailed") }];
    if (!reviewsQ.data) return [{ kind: "reviewSummary", summary: null }, { kind: "loading" }];
    const items = reviewsQ.data.pages.flatMap((p) => p.items);
    const body: Row[] = items.length
      ? items.map((review) => ({ kind: "review" as const, review }))
      : [{ kind: "empty", message: t("profile.noReviews") }];
    return [{ kind: "reviewSummary", summary: reviewsQ.data.pages[0]?.summary ?? null }, ...body];
  }, [
    tab,
    status,
    isSelf,
    ownStatus,
    ownQ.data,
    ownQ.isError,
    listingsQ.data,
    listingsQ.isError,
    reviewsQ.data,
    reviewsQ.isError,
    t,
  ]);

  if (profileQ.isPending) {
    return (
      <Screen bottomInset={false}>
        <TopBar leading="none" title={isSelf ? t("tabs.profile") : undefined} />
        <Spinner size="large" />
      </Screen>
    );
  }
  if (profileQ.isError || !profileQ.data) {
    return (
      <Screen bottomInset={false}>
        <TopBar leading="none" title={isSelf ? t("tabs.profile") : undefined} />
        <View className="px-lg pt-lg">
          <Banner variant="error">{t("errors.loadFailed")}</Banner>
          <Button variant="outline" className="mt-lg" onPress={() => profileQ.refetch()}>
            <Text>{t("common.tryAgain")}</Text>
          </Button>
        </View>
      </Screen>
    );
  }
  const profile = profileQ.data;

  const fetchMore = () => {
    if (tab === "listings" && isSelf && ownQ.hasNextPage && !ownQ.isFetchingNextPage)
      void ownQ.fetchNextPage();
    if (tab === "listings" && listingsQ.hasNextPage && !listingsQ.isFetchingNextPage)
      void listingsQ.fetchNextPage();
    if (tab === "reviews" && reviewsQ.hasNextPage && !reviewsQ.isFetchingNextPage)
      void reviewsQ.fetchNextPage();
  };

  return (
    <Screen bottomInset={false}>
      <TopBar
        leading="none"
        title={isSelf ? t("tabs.profile") : undefined}
        trailing={
          isSelf ? (
            <Pressable
              onPress={() => router.push("/settings")}
              hitSlop={8}
              role="button"
              accessibilityLabel={t("settings.title")}
              className="h-11 w-11 items-center justify-center rounded-full active:bg-pressed"
            >
              <Icon as={SettingsIcon} size={22} />
            </Pressable>
          ) : undefined
        }
      />
      <FlatList
        data={rows}
        keyExtractor={(row, index) =>
          row.kind === "review"
            ? row.review.id
            : row.kind === "ownPair"
              ? `own-${row.items[0].id}`
              : `${row.kind}-${index}`
        }
        onEndReached={fetchMore}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-2xl"
        ListHeaderComponent={
          <View>
            <ProfileHeader profile={profile} isSelf={isSelf} tab={tab} onTab={setTab} />
            {tab === "listings" && isSelf ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-sm px-lg pt-lg"
              >
                {(["active", "draft", "reserved", "sold", "hidden"] as const).map((key) => (
                  <Chip
                    key={key}
                    label={t(`profile.ownStatus.${key}`)}
                    count={ownCounts?.[key]}
                    selected={ownStatus === key}
                    onPress={() => setOwnStatus(key)}
                  />
                ))}
              </ScrollView>
            ) : null}
            {tab === "listings" && !isSelf ? (
              <View className="flex-row gap-sm px-lg pt-lg">
                <Chip
                  label={t("profile.active")}
                  selected={status === "active"}
                  onPress={() => setStatus("active")}
                />
                <Chip
                  label={t("profile.sold")}
                  selected={status === "sold"}
                  onPress={() => setStatus("sold")}
                />
              </View>
            ) : null}
            {tab === "reviews" ? (
              <View className="flex-row gap-sm px-lg pt-lg">
                <Chip label={t("profile.all")} selected={source === "all"} onPress={() => setSource("all")} />
                <Chip
                  label={t("profile.fromMembers")}
                  selected={source === "member"}
                  onPress={() => setSource("member")}
                />
                <Chip
                  label={t("profile.automatic")}
                  selected={source === "automatic"}
                  onPress={() => setSource("automatic")}
                />
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          (tab === "listings" && (listingsQ.isFetchingNextPage || ownQ.isFetchingNextPage)) ||
          (tab === "reviews" && reviewsQ.isFetchingNextPage) ? (
            <Spinner />
          ) : null
        }
        renderItem={({ item }) => {
          switch (item.kind) {
            case "pair":
              return (
                <View className="flex-row gap-md px-lg pt-lg">
                  <ListingCard listing={item.items[0]} />
                  {item.items[1] ? <ListingCard listing={item.items[1]} /> : <View className="flex-1" />}
                </View>
              );
            case "ownPair":
              return (
                <View className="flex-row gap-md px-lg pt-lg">
                  {item.items.map((listing) =>
                    listing ? (
                      <OwnListingCard
                        key={listing.id}
                        listing={listing}
                        onPress={() =>
                          listing.status === "draft"
                            ? router.push({ pathname: "/sell-form", params: { id: listing.id } })
                            : router.push({ pathname: "/listing/[id]", params: { id: listing.id } })
                        }
                      />
                    ) : (
                      <View key="filler" className="flex-1" />
                    ),
                  )}
                </View>
              );
            case "review":
              return <ReviewRow review={item.review} />;
            case "reviewSummary":
              return <ReviewSummary summary={item.summary} />;
            case "about":
              return <AboutSection profile={profile} />;
            case "loading":
              return <Spinner />;
            case "error":
              return (
                <View className="px-lg pt-lg">
                  <Banner variant="error">{item.message}</Banner>
                </View>
              );
            case "empty":
              return (
                <View className="items-center px-lg py-2xl">
                  <Text variant="subtitle" className="text-center">
                    {item.message}
                  </Text>
                </View>
              );
          }
        }}
      />
    </Screen>
  );
}

export { ProfileView };
