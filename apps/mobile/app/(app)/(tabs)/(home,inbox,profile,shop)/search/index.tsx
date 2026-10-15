import { useNavigation, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, type TextInput, View } from "react-native";
import {
  SaveSearchButton,
  SearchField,
  SearchPanel,
  useSearchSession,
} from "@/components/search/search-panel";
import { Screen } from "@/components/ui/screen";
import { BackIcon } from "@/components/ui/top-bar";

/**
 * The search page: the field with a back arrow, and the shared search panel under it (the same one Home shows
 * when its search bar is used). The bookmark next to the field saves the search.
 */
export default function SearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const inputRef = useRef<TextInput>(null);
  const session = useSearchSession();
  const { startsCommitted } = session;

  // The keyboard waits until the page has slid in. Opening both at once made the slide stutter.
  useEffect(() => {
    if (startsCommitted) return;
    const focus = () => inputRef.current?.focus();
    // In case the slide-in event never comes (no animation), focus anyway.
    const fallback = setTimeout(focus, 600);
    const unsubscribe = navigation.addListener(
      "transitionEnd" as never,
      (e: { data?: { closing?: boolean } }) => {
        if (e.data?.closing) return;
        clearTimeout(fallback);
        focus();
      },
    );
    return () => {
      clearTimeout(fallback);
      unsubscribe();
    };
  }, [navigation, startsCommitted]);

  return (
    <Screen bottomInset={false}>
      <View className="flex-row items-center gap-xs px-sm py-sm">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={8}
          role="button"
          accessibilityLabel={t("common.back")}
          className="h-11 w-11 items-center justify-center rounded-full bg-transparent active:bg-pressed"
        >
          <BackIcon />
        </Pressable>
        <SearchField session={session} inputRef={inputRef} />
        <SaveSearchButton session={session} />
      </View>
      <SearchPanel session={session} />
    </Screen>
  );
}
