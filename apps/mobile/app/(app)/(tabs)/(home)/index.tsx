import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { FEED_GROUPS, type FeedCard, type FeedGroup, type FeedMood } from "@vinty/shared";
import { useNavigation, useRouter } from "expo-router";
import { Bell, Bookmark } from "lucide-react-native";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Pressable, ScrollView, type TextInput, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { FeedReasonSheet } from "@/components/feed-reason-sheet";
import {
  HomePriceSheet,
  hasPrice,
  NO_PRICE,
  type PriceRange,
  priceLabel,
} from "@/components/home-price-sheet";
import { ListingGrid } from "@/components/listing-grid";
import {
  SaveSearchButton,
  SearchField,
  SearchPanel,
  useSearchSession,
} from "@/components/search/search-panel";
import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { feedQuery } from "@/lib/discovery-queries";
import { personalisationSizesQuery } from "@/lib/item-queries";
import { unreadQuery } from "@/lib/messaging-queries";
import { meQuery } from "@/lib/queries";
import { useSearchStore } from "@/lib/search-store";

/** The mood chips, in order. There is no For you chip: plain Home is For you. The last two need an account (sizes and city). */
const MOODS: { key: FeedMood; needsAccount: boolean }[] = [
  { key: "new_today", needsAccount: false },
  { key: "your_sizes", needsAccount: true },
  { key: "near_you", needsAccount: true },
];

/**
 * The glide between the bar's place in the header and the top. About as long as a page sliding in, easing in and
 * out evenly (a quicker start read as a jump), and the same curve both ways so closing is opening played back.
 */
const GLIDE = { duration: 450, easing: Easing.bezier(0.4, 0, 0.2, 1), reduceMotion: ReduceMotion.System };
const PANEL_FADE = { duration: 200, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };

/** The Cancel label next to the field. Home also lays out a hidden copy to know its width before search opens. */
function CancelLabel() {
  const { t } = useTranslation();
  return (
    <View className="h-11 justify-center ps-md">
      <Text weight={600} className="text-primary" numberOfLines={1}>
        {t("common.cancel")}
      </Text>
    </View>
  );
}

/**
 * Home while the search bar is in use: the field with Cancel at its end, and the shared search panel under it
 * (suggestions, recent and saved searches, then results). It starts fresh each time it opens.
 * It lies over the feed. On opening the field glides up from where the bar sat in the header (`fromY`, its top
 * on screen) while the page fades in and Cancel slides in at the end. Everything it needs is known before the
 * first frame, so the glide starts at once. The panel is drawn only after the glide lands, so building the lists
 * never competes with the motion. `closing` plays the glide backwards, then calls `onClosed`.
 */
function HomeSearch({
  fromY,
  cancelWidth,
  closing,
  onCancel,
  onClosed,
}: {
  fromY: number | null;
  cancelWidth: number;
  closing: boolean;
  onCancel: () => void;
  onClosed: () => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const session = useSearchSession();
  const insets = useSafeAreaInsets();
  // The row's top on screen: below the status bar plus the row's own top padding (pt-md, 12).
  const offset = fromY === null ? 0 : fromY - (insets.top + 12);
  const progress = useSharedValue(0);
  const panelFade = useSharedValue(0);
  const [panelShown, setPanelShown] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when search opens
  useEffect(() => {
    progress.value = withTiming(1, GLIDE, (finished) => {
      if (finished) scheduleOnRN(setPanelShown, true);
    });
  }, []);

  useEffect(() => {
    if (panelShown) panelFade.value = withTiming(1, PANEL_FADE);
  }, [panelShown, panelFade]);

  useEffect(() => {
    if (!closing) return;
    progress.value = withTiming(0, GLIDE, (finished) => {
      if (finished) scheduleOnRN(onClosed);
    });
  }, [closing, progress, onClosed]);

  const pageStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * offset }],
  }));
  // Cancel starts tucked past the end edge and slides in, and the field gives it room as it comes.
  const cancelStyle = useAnimatedStyle(() => ({
    marginEnd: (progress.value - 1) * cancelWidth,
    opacity: progress.value,
  }));
  // On the way back the lists are gone by halfway, so they never hang over the returning feed.
  const panelStyle = useAnimatedStyle(() => ({
    opacity: Math.min(panelFade.value, Math.max(0, progress.value * 2 - 1)),
  }));

  return (
    <View
      className="absolute inset-0"
      style={{ paddingTop: insets.top }}
      pointerEvents={closing ? "none" : "auto"}
    >
      <Animated.View className="absolute inset-0 bg-background" style={pageStyle} />
      <Animated.View className="px-lg pb-sm pt-md" style={rowStyle}>
        <View className="flex-row items-center">
          <SearchField session={session} inputRef={inputRef} autoFocus />
          <SaveSearchButton session={session} />
          <Animated.View style={cancelStyle}>
            <Pressable onPress={onCancel} hitSlop={8} role="button">
              <CancelLabel />
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
      <Animated.View className="flex-1" style={panelStyle}>
        {panelShown ? <SearchPanel session={session} /> : null}
      </Animated.View>
    </View>
  );
}

/** Home: the wordmark with Alerts and Saved, a full-width search bar, the mood chips and the feed (D-047). */
export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  // "open" while searching, "closing" while the bar glides back down.
  const [search, setSearch] = useState<"closed" | "open" | "closing">("closed");
  const searching = search !== "closed";
  const barRef = useRef<View>(null);
  const [barY, setBarY] = useState<number | null>(null);
  const [cancelWidth, setCancelWidth] = useState(0);
  const [mood, setMood] = useState<FeedMood>("for_you");
  // Women or Men, kept for this app session only. Works together with a mood.
  const [group, setGroup] = useState<FeedGroup | null>(null);
  // The price range from the Price chip, in minor units. Also for this app session only.
  const [price, setPrice] = useState<PriceRange>(NO_PRICE);
  const priceSheet = useRef<BottomSheetModal>(null);
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session);
  const me = useQuery({ ...meQuery(), enabled: signedIn });
  const sizes = useQuery({ ...personalisationSizesQuery(), enabled: signedIn });
  const unread = useQuery({ ...unreadQuery(), enabled: signedIn });
  const notificationsUnread = (unread.data?.notifications ?? 0) > 0;

  // Where the bar sits on screen right now, so the field can glide from and back to it.
  const measureBar = (then: (y: number | null) => void) => {
    if (!barRef.current) return then(null);
    barRef.current.measureInWindow((_x, y, _w, h) => then(h > 0 ? y : null));
  };
  const startSearch = () => {
    useSearchStore.getState().reset("search");
    measureBar((y) => {
      setBarY(y);
      setSearch("open");
    });
  };
  const cancelSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearch((now) => (now === "open" ? "closing" : now));
  }, []);
  const closedSearch = useCallback(() => {
    useSearchStore.getState().reset("search");
    setSearch("closed");
  }, []);

  // Pressing the Home tab while searching goes back to the feed.
  useEffect(() => {
    if (!searching) return;
    return navigation.getParent()?.addListener("tabPress" as never, cancelSearch);
  }, [navigation, searching, cancelSearch]);

  const activeMood: FeedMood =
    !signedIn && mood !== "for_you" && MOODS.find((m) => m.key === mood)?.needsAccount ? "for_you" : mood;
  const feedOptions = feedQuery({
    mood: activeMood,
    group,
    priceMinMinor: price.min,
    priceMaxMinor: price.max,
  });
  const query = useInfiniteQuery(feedOptions);
  const queryClient = useQueryClient();
  // The list the cards came from. The app sends it with each "card seen".
  const feedId = query.data?.pages[0]?.feedId ?? null;

  // Pull to refresh builds a new list: keep only page one, then ask for it again without a cursor.
  const refreshFeed = async () => {
    queryClient.setQueryData(feedOptions.queryKey, (old: typeof query.data) =>
      old ? { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) } : old,
    );
    await query.refetch();
  };

  // Once the open chip has loaded, load page one of the other chips in the background, so tapping one shows its
  // items at once instead of waiting on the network.
  const loaded = query.isSuccess;
  useEffect(() => {
    if (!loaded) return;
    for (const m of MOODS) {
      if (m.key === activeMood || (m.needsAccount && !signedIn)) continue;
      void queryClient.prefetchInfiniteQuery(
        feedQuery({ mood: m.key, group, priceMinMinor: price.min, priceMaxMinor: price.max }),
      );
    }
  }, [loaded, activeMood, group, price, signedIn, queryClient]);

  // "Why you see this" on a long press.
  const reasonSheet = useRef<BottomSheetModal>(null);
  const [whyCard, setWhyCard] = useState<FeedCard | null>(null);
  const feedData = query.data;
  // Kept the same between renders, so the cards do not all redraw when a chip is tapped.
  const openWhy = useCallback(
    (card: { id: string }) => {
      setWhyCard(feedData?.pages.flatMap((p) => p.items).find((c) => c.id === card.id) ?? null);
      reasonSheet.current?.present();
    },
    [feedData],
  );

  const hasSizes = (sizes.data?.sizeIds.length ?? 0) > 0;
  const city = me.data?.profile.city?.trim() || null;

  let emptyTitle = t("home.emptyTitle");
  let emptyMessage: string | undefined = t("home.emptyMessage");
  let emptyAction: React.ReactElement | null = null;
  if (hasPrice(price)) {
    emptyTitle = t("home.price.emptyTitle");
    emptyMessage = t("home.price.emptyNote");
  } else if (activeMood === "new_today") {
    emptyTitle = t("home.empty.newToday.title");
    emptyMessage = t("home.empty.newToday.note");
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
      <View className="flex-row items-center justify-between px-lg pt-md">
        <Text
          weight={800}
          accessibilityRole="header"
          className="text-text-1"
          style={{ fontSize: 28, lineHeight: 34, letterSpacing: -1 }}
        >
          Yadii
        </Text>
        {signedIn ? (
          <View className="flex-row items-center gap-xs">
            <Pressable
              onPress={() => router.push("/notifications")}
              role="button"
              accessibilityLabel={t("inbox.notifications")}
              className="h-11 w-11 items-center justify-center rounded-full bg-transparent active:bg-pressed"
            >
              <Icon as={Bell} size={22} />
              {notificationsUnread ? (
                <View className="absolute end-2.5 top-2.5 h-2 w-2 rounded-full bg-primary" />
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => router.push("/favourites")}
              role="button"
              accessibilityLabel={t("favourites.title")}
              className="h-11 w-11 items-center justify-center rounded-full bg-transparent active:bg-pressed"
            >
              <Icon as={Bookmark} size={22} />
            </Pressable>
          </View>
        ) : null}
      </View>
      {/* Hidden while search is open: the moving field stands in for it, and they swap where they overlap. */}
      <View ref={barRef} collapsable={false} className="px-lg" style={{ opacity: searching ? 0 : 1 }}>
        <SearchBar onPress={startSearch} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm px-lg">
        {FEED_GROUPS.map((g) => (
          <Chip
            key={g}
            label={t(`browse.groups.${g}`)}
            selected={group === g}
            onPress={() => setGroup((now) => (now === g ? null : g))}
          />
        ))}
        <View className="my-xs w-px self-stretch bg-border" />
        {MOODS.filter((m) => signedIn || !m.needsAccount).map((m) => (
          <Fragment key={m.key}>
            <Chip
              label={t(`home.moods.${m.key}`)}
              selected={activeMood === m.key}
              onPress={() => setMood((now) => (now === m.key ? "for_you" : m.key))}
            />
            {/* Price sits second, where Under 50 used to be. */}
            {m.key === "new_today" ? (
              <Chip
                label={priceLabel(price, t)}
                selected={hasPrice(price)}
                onPress={() => priceSheet.current?.present()}
              />
            ) : null}
          </Fragment>
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
        track={signedIn ? { feedId } : undefined}
        onRefresh={refreshFeed}
        onCardLongPress={signedIn ? openWhy : undefined}
      />
      {/* Lies over the feed, so the feed keeps its cards and place underneath. */}
      {/* A hidden Cancel, laid out once so the search knows its width before it opens. */}
      <View
        className="absolute opacity-0"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={(e) => setCancelWidth(e.nativeEvent.layout.width)}
      >
        <CancelLabel />
      </View>
      {searching ? (
        <HomeSearch
          fromY={barY}
          cancelWidth={cancelWidth}
          closing={search === "closing"}
          onCancel={cancelSearch}
          onClosed={closedSearch}
        />
      ) : null}
      <HomePriceSheet ref={priceSheet} value={price} onApply={setPrice} />
      {signedIn ? <FeedReasonSheet ref={reasonSheet} card={whyCard} /> : null}
    </Screen>
  );
}
