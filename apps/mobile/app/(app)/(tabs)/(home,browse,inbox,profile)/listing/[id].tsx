import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { BuyerView } from "@/components/item/buyer-view";
import { OwnListingView } from "@/components/item/own-listing-view";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { ApiClientError } from "@/lib/api";
import { listingQuery } from "@/lib/item-queries";

/**
 * The item page, reachable from every tab. One address, two views: the owner keeps the seller's view with
 * its actions (Milestone 2), everyone else gets the buyer's view. The server's `viewer.isOwner` decides.
 */
export default function ItemPage() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery(listingQuery(id));

  if (query.isPending) {
    return (
      <Screen>
        <TopBar />
        <Spinner size="large" />
      </Screen>
    );
  }
  if (query.isError || !query.data) {
    const gone = query.error instanceof ApiClientError && query.error.status === 404;
    return (
      <Screen>
        <TopBar />
        {gone ? (
          <View className="items-center gap-sm px-xl pt-2xl">
            <Text variant="heading" className="text-center">
              {t("item.unavailable")}
            </Text>
            <Text variant="subtitle" className="text-center text-text-3">
              {t("item.unavailableNote")}
            </Text>
          </View>
        ) : (
          <View className="gap-lg px-lg">
            <Banner variant="error">{t("errors.loadFailed")}</Banner>
            <Button variant="outline" onPress={() => query.refetch()}>
              <Text>{t("common.tryAgain")}</Text>
            </Button>
          </View>
        )}
      </Screen>
    );
  }
  if (query.data.viewer.isOwner) return <OwnListingView id={id} placeholder={query.data} />;
  return <BuyerView listing={query.data} />;
}
