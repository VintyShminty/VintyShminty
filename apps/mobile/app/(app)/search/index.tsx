import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Bookmark, Clock, LayoutGrid, Search, Tag, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Keyboard, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchResults } from "@/components/search-results";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { StarRating } from "@/components/ui/star-rating";
import { Tabs } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { BackIcon } from "@/components/ui/top-bar";
import {
  membersQuery,
  recentSearchesQuery,
  suggestionsQuery,
  useAddRecentSearch,
  useClearRecentSearches,
  useSaveSearch,
} from "@/lib/discovery-queries";
import { activeFilters, useSearchStore } from "@/lib/search-store";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

type TabKey = "items" | "members";

/**
 * The search page: autosuggest while typing, recent searches when the field is empty, and after a search the Items
 * and Members tabs. The bookmark next to the field saves the search.
 */
export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isHe = i18n.language === "he";
  const inputRef = useRef<TextInput>(null);
  const state = useSearchStore((s) => s.scopes.search);
  const { setQuery, setFilters, setBrands, setCategory } = useSearchStore.getState();
  const [draft, setDraft] = useState(state.q);
  const [focused, setFocused] = useState(true);
  const [tab, setTab] = useState<TabKey>("items");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const filters = activeFilters(state);
  const committed = Boolean(filters.q) || Object.keys(filters).some((k) => k !== "sort" && k !== "q");
  const key = JSON.stringify(filters);
  const saved = savedKey === key;

  const typed = useDebounced(draft.trim(), 200);
  const suggestions = useQuery(suggestionsQuery(typed));
  const recent = useQuery(recentSearchesQuery());
  const addRecent = useAddRecentSearch();
  const clearRecent = useClearRecentSearches();
  const save = useSaveSearch();

  const finish = () => {
    setFocused(false);
    setTab("items");
    Keyboard.dismiss();
  };

  const submit = (text: string) => {
    const q = text.trim();
    setDraft(q);
    setQuery("search", q);
    finish();
    if (q) addRecent.mutate({ queryText: q, filters: activeFilters({ ...state, q }) });
  };

  const onSave = () => {
    setSaveFailed(false);
    save.mutate(
      { queryText: filters.q, filters: { sort: "relevance", ...filters, q: undefined }, notifyOnNew: true },
      { onSuccess: () => setSavedKey(key), onError: () => setSaveFailed(true) },
    );
  };

  const showSuggestions = focused || !committed;
  const typing = draft.trim().length > 0;

  return (
    <Screen bottomInset={false}>
      <View className="flex-row items-center gap-xs px-sm py-sm">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={8}
          role="button"
          accessibilityLabel={t("common.back")}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-pressed"
        >
          <BackIcon />
        </Pressable>
        <View className="h-11 flex-1 flex-row items-center gap-sm rounded-bar border border-border bg-surface px-md">
          <Icon as={Search} size={18} className="text-text-3" />
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            onFocus={() => setFocused(true)}
            onSubmitEditing={() => submit(draft)}
            autoFocus
            placeholder={t("search.placeholder")}
            placeholderTextColor={colors.text4}
            selectionColor={colors.accent}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel={t("search.placeholder")}
            className="flex-1 font-aileron-400 text-body text-text-1 rtl:font-heebo-400"
            style={{ textAlign: isHe ? "right" : "left", writingDirection: isHe ? "rtl" : "ltr" }}
          />
          {typing ? (
            <Pressable
              onPress={() => {
                setDraft("");
                setQuery("search", "");
                inputRef.current?.focus();
              }}
              hitSlop={8}
              role="button"
              accessibilityLabel={t("search.clearField")}
            >
              <Icon as={X} size={18} className="text-text-3" />
            </Pressable>
          ) : null}
        </View>
        {committed && !focused ? (
          <Pressable
            onPress={onSave}
            disabled={saved || save.isPending}
            hitSlop={8}
            role="button"
            accessibilityLabel={saved ? t("search.saved") : t("search.save")}
            accessibilityState={{ selected: saved }}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-pressed"
          >
            <Icon as={Bookmark} size={22} color={colors.accent} fill={saved ? colors.accent : "none"} />
          </Pressable>
        ) : null}
      </View>

      {showSuggestions ? (
        typing ? (
          <FlatList
            data={suggestions.data?.suggestions ?? []}
            keyExtractor={(s, i) => `${s.kind}-${s.text}-${i}`}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  if (item.kind === "brand" && item.brandId) {
                    setBrands("search", [{ id: item.brandId, name: item.text }]);
                    setCategory("search", null);
                    submit("");
                  } else if (item.kind === "category" && item.categoryId) {
                    setCategory("search", {
                      id: item.categoryId,
                      name: (isHe ? item.categoryName?.he : item.categoryName?.en) ?? item.text,
                    });
                    setBrands("search", []);
                    setDraft("");
                    submit("");
                  } else {
                    submit(item.text);
                  }
                }}
                role="button"
                className="active:bg-surface"
              >
                <View className="min-h-14 flex-row items-center gap-md border-b border-border-subtle px-lg">
                  <Icon
                    as={item.kind === "brand" ? Tag : item.kind === "category" ? LayoutGrid : Search}
                    size={18}
                    className="text-text-3"
                  />
                  <Text className="flex-1" numberOfLines={1}>
                    {item.text}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        ) : (
          <FlatList
            data={recent.data?.items ?? []}
            keyExtractor={(r) => r.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            ListHeaderComponent={
              (recent.data?.items.length ?? 0) > 0 ? (
                <View className="flex-row items-center justify-between px-lg pb-sm pt-md">
                  <Text variant="sectionLabel">{t("search.recent")}</Text>
                  <Text
                    variant="bodySmall"
                    weight={600}
                    className="text-primary"
                    role="button"
                    onPress={() => clearRecent.mutate()}
                  >
                    {t("search.clearAll")}
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              recent.isPending ? (
                <Spinner />
              ) : (
                <Text variant="subtitle" className="px-lg py-xl text-center text-text-3">
                  {t("search.noRecent")}
                </Text>
              )
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  const { q: _ignored, ...rest } = item.filters;
                  setFilters("search", rest);
                  submit(item.queryText);
                }}
                role="button"
                className="active:bg-surface"
              >
                <View className="min-h-14 flex-row items-center gap-md border-b border-border-subtle px-lg">
                  <Icon as={Clock} size={18} className="text-text-3" />
                  <Text className="flex-1" numberOfLines={1}>
                    {item.queryText}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )
      ) : (
        <View className="flex-1">
          <Tabs
            items={[
              { key: "items", label: t("search.items") },
              { key: "members", label: t("search.members") },
            ]}
            value={tab}
            onChange={setTab}
          />
          {saveFailed ? (
            <Text variant="bodySmall" className="px-lg pt-sm text-error" accessibilityLiveRegion="polite">
              {t("search.saveFailed")}
            </Text>
          ) : null}
          {tab === "items" ? (
            <SearchResults scope="search" />
          ) : (
            <Members q={state.q} bottom={insets.bottom} />
          )}
        </View>
      )}
    </Screen>
  );
}

function Members({ q, bottom }: { q: string; bottom: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const query = useInfiniteQuery(membersQuery(q.trim()));
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (!q.trim()) {
    return (
      <Text variant="subtitle" className="px-lg py-xl text-center text-text-3">
        {t("search.membersHint")}
      </Text>
    );
  }
  if (query.isPending) return <Spinner />;
  if (query.isError) {
    return (
      <Text variant="subtitle" className="px-lg py-xl text-center text-error">
        {t("errors.general")}
      </Text>
    );
  }
  return (
    <FlatList
      data={items}
      keyExtractor={(m) => m.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: bottom + 24 }}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      ListFooterComponent={query.isFetchingNextPage ? <Spinner /> : null}
      ListEmptyComponent={
        <Text variant="subtitle" className="px-lg py-xl text-center text-text-3">
          {t("search.noMembers")}
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          // The member page is built with the profile screens (/user/[id]).
          onPress={() => router.push({ pathname: "/user/[id]", params: { id: item.id } })}
          role="button"
          accessibilityLabel={item.username ?? ""}
          className="active:bg-surface"
        >
          <View
            className={cn("min-h-[68px] flex-row items-center gap-md border-b border-border-subtle px-lg")}
          >
            <Avatar uri={item.avatarUrl} name={item.username} size={44} />
            <View className="flex-1 gap-xs">
              <Text weight={600} numberOfLines={1}>
                {item.username}
              </Text>
              <View className="flex-row items-center gap-xs">
                <StarRating rating={item.ratingAverage} size={12} />
                <Text variant="cardMeta">{`(${item.reviewCount})`}</Text>
              </View>
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}
