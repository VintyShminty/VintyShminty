import { useQuery } from "@tanstack/react-query";
import type { SavedSearch } from "@vinty/shared";
import { useRouter } from "expo-router";
import { Bell, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { ForwardIcon, TopBar } from "@/components/ui/top-bar";
import { savedSearchesQuery, useDeleteSavedSearch, useUpdateSavedSearch } from "@/lib/item-queries";
import { useSavedSearchSummary } from "@/lib/saved-search-summary";
import { colors } from "@/theme";

/** One saved search: the words, a short line of what is filtered, the alert switch and delete. Tap runs it again. */
function SavedSearchRow({ search }: { search: SavedSearch }) {
  const { t } = useTranslation();
  const router = useRouter();
  const update = useUpdateSavedSearch();
  const remove = useDeleteSavedSearch();
  const { title, parts, load } = useSavedSearchSummary(search);

  const confirmDelete = () =>
    Alert.alert(t("savedSearches.deleteTitle"), t("savedSearches.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("savedSearches.delete"), style: "destructive", onPress: () => remove.mutate(search.id) },
    ]);

  return (
    <View className="border-b border-border-subtle px-lg py-md">
      <Pressable
        onPress={() => {
          load();
          router.push("/search");
        }}
        role="button"
        accessibilityLabel={[title, parts.join(", ")].filter(Boolean).join(", ")}
        className="flex-row items-center gap-md active:opacity-70"
      >
        <View className="flex-1 gap-xs">
          <Text weight={600} numberOfLines={1} className="self-start">
            {title}
          </Text>
          {parts.length > 0 ? (
            <Text variant="bodySmall" className="self-start text-text-3" numberOfLines={2}>
              {parts.join(" · ")}
            </Text>
          ) : null}
        </View>
        <ForwardIcon />
      </Pressable>
      <View className="mt-md flex-row items-center gap-md">
        <Icon as={Bell} size={16} className="text-text-3" />
        <Text variant="bodySmall" className="flex-1 text-text-2">
          {t("savedSearches.notify")}
        </Text>
        <Switch
          checked={search.notifyOnNew}
          onCheckedChange={(notifyOnNew) => update.mutate({ id: search.id, notifyOnNew })}
          accessibilityLabel={t("savedSearches.notify")}
        />
        <Pressable
          onPress={confirmDelete}
          hitSlop={8}
          role="button"
          accessibilityLabel={t("savedSearches.delete")}
          className="h-9 w-9 items-center justify-center rounded-full bg-transparent active:bg-pressed"
        >
          <Icon as={Trash2} size={18} className="text-destructive" />
        </Pressable>
      </View>
    </View>
  );
}

/** Your saved searches (spec, Saved searches). Tapping one runs the search again with its filters. */
export default function SavedSearches() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const query = useQuery(savedSearchesQuery());
  const items = query.data?.items ?? [];

  return (
    <Screen>
      <TopBar title={t("savedSearches.title")} />
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
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          renderItem={({ item }) => <SavedSearchRow search={item} />}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View className="items-center gap-sm px-xl py-2xl">
              <Text variant="heading" className="text-center">
                {t("savedSearches.empty")}
              </Text>
              <Text variant="subtitle" className="text-center text-text-3">
                {t("savedSearches.emptyNote")}
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}
