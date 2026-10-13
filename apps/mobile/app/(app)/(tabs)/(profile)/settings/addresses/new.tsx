import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { AddressForm } from "@/components/address/address-form";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";

export default function NewAddress() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <TopBar title={t("address.addTitle")} />
      <ScreenScroll>
        <AddressForm onSaved={() => router.back()} />
      </ScreenScroll>
    </Screen>
  );
}
