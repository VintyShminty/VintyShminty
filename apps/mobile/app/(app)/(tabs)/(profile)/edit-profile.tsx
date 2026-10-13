import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { BIO_MAX, type EditProfileForm, editProfileFormSchema } from "@vinty/shared";
import { useRouter } from "expo-router";
import { AtSign, Camera, Globe } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, View } from "react-native";
import { FormInput } from "@/components/form-input";
import { Avatar } from "@/components/ui/avatar";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Row } from "@/components/ui/row";
import { Screen, ScreenScroll } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { describeApiError } from "@/lib/auth-errors";
import { meQuery, useUpdateProfile } from "@/lib/queries";
import { pickAvatar, uploadAvatar } from "@/lib/upload";

/** Settings, Profile details: photo, display name, about you, city, username (D-020), language. */
export default function EditProfile() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { data: me } = useQuery(meQuery());
  const update = useUpdateProfile();
  const [banner, setBanner] = useState<string | null>(null);
  // The photo is uploaded as soon as it is picked. It is saved on the profile with the Save button.
  const [photo, setPhoto] = useState<{ uri: string; key: string } | "removed" | null>(null);
  const [uploading, setUploading] = useState(false);

  const { control, handleSubmit, reset, formState } = useForm<EditProfileForm>({
    resolver: zodResolver(editProfileFormSchema),
    mode: "onTouched",
    defaultValues: { name: "", bio: "", city: "" },
  });
  useEffect(() => {
    if (me) reset({ name: me.name, bio: me.profile.bio ?? "", city: me.profile.city ?? "" });
  }, [me, reset]);

  if (!me) {
    return (
      <Screen>
        <TopBar title={t("editProfile.title")} />
        <Spinner />
      </Screen>
    );
  }

  const avatarUri = photo === "removed" ? null : (photo?.uri ?? me.profile.avatarUrl);
  const dirty = formState.isDirty || photo !== null;

  const changePhoto = async () => {
    setBanner(null);
    const picked = await pickAvatar();
    if (picked.status === "denied") {
      setBanner(t("editProfile.photosDenied"));
      return;
    }
    if (picked.status !== "picked") return;
    setUploading(true);
    try {
      const upload = await uploadAvatar(picked.uri);
      setPhoto({ uri: picked.uri, key: upload.key });
    } catch (err) {
      if (__DEV__) console.warn("Avatar upload failed:", err);
      setBanner(t("editProfile.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    Alert.alert(t("editProfile.removePhotoTitle"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("editProfile.removePhoto"), style: "destructive", onPress: () => setPhoto("removed") },
    ]);
  };

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    try {
      await update.mutateAsync({
        name: values.name,
        bio: values.bio.trim() === "" ? null : values.bio,
        city: values.city.trim() === "" ? null : values.city,
        ...(photo === "removed" ? { avatarKey: null } : photo ? { avatarKey: photo.key } : {}),
      });
      router.back();
    } catch (err) {
      setBanner(t(describeApiError(err).key));
    }
  });

  return (
    <Screen>
      <TopBar title={t("editProfile.title")} />
      <ScreenScroll>
        {banner ? (
          <Banner variant="error" className="mb-lg">
            {banner}
          </Banner>
        ) : null}
        <View className="items-center pb-xl pt-sm">
          <Pressable
            onPress={changePhoto}
            disabled={uploading}
            role="button"
            accessibilityLabel={t("editProfile.changePhoto")}
          >
            <Avatar uri={avatarUri} name={me.username ?? me.name} size={96} />
            <View className="absolute bottom-0 end-0 h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary">
              <Icon as={Camera} size={16} className="text-primary-foreground" />
            </View>
          </Pressable>
          <View className="mt-md flex-row items-center gap-lg">
            <Text variant="bodySmall" weight={700} className="text-primary" role="link" onPress={changePhoto}>
              {uploading ? t("editProfile.uploading") : t("editProfile.changePhoto")}
            </Text>
            {avatarUri ? (
              <Text
                variant="bodySmall"
                weight={500}
                className="text-text-3"
                role="link"
                onPress={removePhoto}
              >
                {t("editProfile.removePhoto")}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="gap-lg">
          <FormInput
            control={control}
            name="name"
            label={t("fields.displayName")}
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />
          <FormInput
            control={control}
            name="bio"
            label={t("fields.about")}
            placeholder={t("fields.aboutPlaceholder")}
            multiline
            maxLength={BIO_MAX}
            showCount
          />
          <FormInput
            control={control}
            name="city"
            label={t("fields.city")}
            autoComplete="postal-address-locality"
            textContentType="addressCity"
            returnKeyType="done"
          />
        </View>

        <View className="-mx-lg mt-lg">
          <Row
            icon={AtSign}
            label={t("fields.username")}
            value={me.username ?? undefined}
            onPress={() => router.push("/settings/change-username")}
          />
          <Row
            icon={Globe}
            label={t("settings.language")}
            value={t(`languages.${i18n.language}`)}
            onPress={() => router.push("/settings/language")}
            last
          />
        </View>

        <Button
          size="lg"
          className="mt-xl"
          loading={update.isPending}
          disabled={!dirty || uploading}
          onPress={onSubmit}
        >
          <Text>{t("editProfile.save")}</Text>
        </Button>
      </ScreenScroll>
    </Screen>
  );
}
