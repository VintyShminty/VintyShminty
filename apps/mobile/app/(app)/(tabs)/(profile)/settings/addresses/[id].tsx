import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { AddressForm } from "@/components/address/address-form";
import { EmptyState, LoadError } from "@/components/orders/states";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { TopBar } from "@/components/ui/top-bar";
import { addressesQuery } from "@/lib/orders-queries";

export default function EditAddress() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery(addressesQuery());
  const address = query.data?.find((a) => a.id === id);
  return (
    <Screen>
      <TopBar title={t("address.editTitle")} />
      {address ? (
        <ScreenScroll>
          <AddressForm address={address} onSaved={() => router.back()} />
        </ScreenScroll>
      ) : query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <LoadError onRetry={() => void query.refetch()} />
      ) : (
        <EmptyState title={t("address.missing")} />
      )}
    </Screen>
  );
}
