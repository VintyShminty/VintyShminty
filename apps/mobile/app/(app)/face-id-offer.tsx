import { useRouter } from "expo-router";
import { ScanFace } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";
import { closeOffer, pendingLoginFor } from "@/lib/saved-login";
import { useFaceId } from "@/lib/use-face-id";

/** Shown once per person on this phone, right after logging in with a password. */
export default function FaceIdOffer() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const userId = user?.id;
  const faceId = useFaceId(user);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const method = t(`biometric.${faceId.kind}`);

  const close = () => {
    if (userId) closeOffer(userId);
    router.back();
  };

  const turnOn = async () => {
    setBusy(true);
    setFailed(false);
    const login = pendingLoginFor(userId);
    const ok = login ? await faceId.save(login.password) : false;
    setBusy(false);
    if (ok) close();
    else setFailed(true);
  };

  return (
    <Screen className="px-lg">
      <View className="flex-1 items-center justify-center">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-accent-tint">
          <Icon as={ScanFace} size={44} className="text-primary" />
        </View>
        <Text variant="title" className="mt-xl text-center">
          {t("faceId.offerTitle", { method })}
        </Text>
        <Text variant="subtitle" className="mt-md max-w-[300px] text-center">
          {t("faceId.offerBody", { method })}
        </Text>
        {failed ? (
          <Banner variant="error" className="mt-xl">
            {t("faceId.turnOnFailed", { method })}
          </Banner>
        ) : null}
      </View>
      <View className="gap-md pb-md">
        <Button size="lg" loading={busy} onPress={turnOn}>
          <Text>{t("faceId.turnOn", { method })}</Text>
        </Button>
        <Button size="lg" variant="ghost" onPress={close}>
          <Text>{t("faceId.notNow")}</Text>
        </Button>
      </View>
    </Screen>
  );
}
