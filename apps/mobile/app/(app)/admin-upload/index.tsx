import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ADMIN_UPLOAD_BATCH_MAX,
  conditionWords,
  findCategory,
  LISTING_COLOURS_MAX,
  leafOptions,
  listingLimits,
  OWNER_NAME_MIN,
  sizeOptionsFor,
  splitIntoGroups,
} from "@vinty/shared";
import { useFocusEffect, useRouter } from "expo-router";
import { ImagePlus, Plus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategorySheet } from "@/components/admin-upload/category-sheet";
import { ItemCard, type PickerKind } from "@/components/admin-upload/item-card";
import { UploadTile } from "@/components/admin-upload/upload-tile";
import { BrandSheet } from "@/components/sell/brand-sheet";
import { ColourGridSheet } from "@/components/sell/colour-grid-sheet";
import { type Option, OptionListSheet } from "@/components/sell/option-list-sheet";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { PickerRow } from "@/components/ui/picker-row";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import {
  initialUploadState,
  itemIsReady,
  newUploadId,
  suggestionKeys,
  toPublishItem,
  type UploadPhoto,
  unpostedCount,
  uploadReducer,
  wantsSuggestion,
} from "@/lib/admin-upload";
import {
  createStandIn,
  publishItems,
  standInsQuery,
  suggestForItem,
  uploadStandInPhoto,
} from "@/lib/admin-upload-queries";
import { ApiClientError } from "@/lib/api";
import { pickListingPhotos } from "@/lib/listing-photos";
import { useLocalName, useReference } from "@/lib/reference";

const PARALLEL_UPLOADS = 3;
/** Most photos taken from the library in one go. */
const PICK_LIMIT = 50;
const GAP = 8;
const SIDE = 16;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-md pt-xl">
      <Text variant="sectionLabel" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Batch upload on the phone. Pick the stand-in username and the owner, add photos (they upload at once into a tray),
 * tap photos to select them in order and make an item, fill the few rows each item needs, then post all ready items.
 */
export default function AdminUploadScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const name = useLocalName();
  const lang = i18n.language === "he" ? "he" : "en";
  const reference = useReference();
  const standIns = useQuery(standInsQuery());

  const [state, dispatch] = useReducer(uploadReducer, initialUploadState);
  const [standInId, setStandInId] = useState<string | null>(null);
  const [owner, setOwner] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  // The "New username" form under the username row.
  const [creating, setCreating] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [createProblem, setCreateProblem] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createStandIn(newUsername.trim(), newDisplayName.trim()),
    onSuccess: (created) => {
      void client.invalidateQueries({ queryKey: standInsQuery().queryKey });
      setStandInId(created.id);
      setCreating(false);
      setNewUsername("");
      setNewDisplayName("");
      setCreateProblem(null);
    },
    onError: (error) => {
      const key = error instanceof ApiClientError ? error.fields?.username : undefined;
      setCreateProblem(key?.startsWith("validation.") ? t(key) : t("adminUpload.who.createFailed"));
    },
  });

  const standInRef = useRef<BottomSheetModal>(null);
  const categoryRef = useRef<BottomSheetModal>(null);
  const sizeRef = useRef<BottomSheetModal>(null);
  const conditionRef = useRef<BottomSheetModal>(null);
  const brandRef = useRef<BottomSheetModal>(null);
  const colourRef = useRef<BottomSheetModal>(null);

  const ref = reference.data;
  const maxPhotos = ref ? listingLimits(ref).maxPhotos : 20;
  const tile = Math.floor((width - SIDE * 2 - GAP * 3) / 4);

  // Uploads: a small queue so many photos do not all go at once.
  const queue = useRef<(() => Promise<void>)[]>([]);
  const running = useRef(0);
  const asked = useRef(new Set<string>());
  const standInIdRef = useRef(standInId);
  standInIdRef.current = standInId;

  const pump = useCallback(() => {
    while (running.current < PARALLEL_UPLOADS && queue.current.length > 0) {
      const job = queue.current.shift() as () => Promise<void>;
      running.current += 1;
      void job().finally(() => {
        running.current -= 1;
        pump();
      });
    }
  }, []);

  const enqueueUpload = useCallback(
    (photo: UploadPhoto) => {
      const standIn = standInIdRef.current;
      if (!standIn) return;
      queue.current.push(async () => {
        let last = 0;
        try {
          const done = await uploadStandInPhoto(
            standIn,
            { uri: photo.uri, width: photo.width, height: photo.height },
            (progress) => {
              if (progress - last < 0.05 && progress < 1) return;
              last = progress;
              dispatch({ type: "photo", photoId: photo.id, patch: { progress } });
            },
          );
          dispatch({ type: "photo", photoId: photo.id, patch: { state: "done", progress: 1, ...done } });
        } catch (error) {
          if (__DEV__) console.warn("Admin photo upload failed:", error);
          dispatch({ type: "photo", photoId: photo.id, patch: { state: "failed" } });
        }
      });
      pump();
    },
    [pump],
  );

  const addPhotos = async () => {
    if (!standInId) return;
    const picked = await pickListingPhotos("library", PICK_LIMIT);
    if (picked.status === "denied") {
      Alert.alert(t("adminUpload.photos.deniedTitle"), t("adminUpload.photos.denied"));
      return;
    }
    if (picked.status !== "picked") return;
    const photos: UploadPhoto[] = picked.photos.map((p) => ({
      id: newUploadId("photo"),
      uri: p.uri,
      width: p.width,
      height: p.height,
      state: "uploading",
      progress: 0,
    }));
    dispatch({ type: "addToTray", photos });
    for (const photo of photos) enqueueUpload(photo);
  };

  const retryPhoto = (photo: UploadPhoto) => {
    dispatch({ type: "photo", photoId: photo.id, patch: { state: "uploading", progress: 0 } });
    enqueueUpload(photo);
  };

  // When an item's photos have all finished going up, the AI looks at them once.
  useEffect(() => {
    if (!standInId || !ref) return;
    for (const item of state.items) {
      if (!wantsSuggestion(item) || asked.current.has(item.id)) continue;
      asked.current.add(item.id);
      dispatch({ type: "suggesting", itemId: item.id });
      suggestForItem(standInId, suggestionKeys(item), lang)
        .then((suggestion) => dispatch({ type: "suggested", itemId: item.id, suggestion, reference: ref }))
        .catch(() => dispatch({ type: "suggestFailed", itemId: item.id }));
    }
  }, [state.items, standInId, lang, ref]);

  const options = useMemo(() => (ref ? leafOptions(ref, lang) : []), [ref, lang]);
  const categoryLabels = useMemo(() => new Map(options.map((o) => [o.id, o.path])), [options]);

  const open = unpostedCount(state.items) > 0;
  const hasWork = open || state.tray.length > 0;
  const ready = ref ? state.items.filter((i) => itemIsReady(i, ref)) : [];
  const ownerOk = owner.trim().length >= OWNER_NAME_MIN;
  const postedCount = state.items.filter((i) => i.state === "published").length;
  const selecting = state.selected.length > 0;

  // Closing with work that is not posted asks first. Photos stay in storage, the items do not.
  const close = () => {
    if (!hasWork) {
      router.back();
      return;
    }
    Alert.alert(t("adminUpload.leaveTitle"), t("adminUpload.leaveBody"), [
      { text: t("adminUpload.stay"), style: "cancel" },
      { text: t("adminUpload.leave"), style: "destructive", onPress: () => router.back() },
    ]);
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        closeRef.current();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  const post = async () => {
    if (!standInId || !ref || ready.length === 0 || posting || !ownerOk) return;
    setPosting(true);
    setNotice(null);
    dispatch({ type: "publishing", itemIds: ready.map((i) => i.id) });
    let created = 0;
    let failed = 0;
    for (const part of splitIntoGroups(ready, ADMIN_UPLOAD_BATCH_MAX)) {
      try {
        const result = await publishItems(standInId, {
          ownerFullName: owner.trim(),
          items: part.map((i) => toPublishItem(i, ref)),
        });
        dispatch({ type: "results", result });
        created += result.createdCount;
        failed += result.failedCount;
      } catch (error) {
        dispatch({
          type: "publishFailed",
          itemIds: part.map((i) => i.id),
          message: error instanceof Error ? error.message : "",
        });
        failed += part.length;
      }
    }
    setPosting(false);
    void client.invalidateQueries({ queryKey: ["admin"] });
    setNotice(
      failed > 0
        ? { kind: "error", text: t("adminUpload.failedToast", { count: failed }) }
        : { kind: "success", text: t("adminUpload.postedToast", { count: created }) },
    );
  };

  if (!ref) {
    return (
      <Screen>
        <TopBar leading="close" title={t("adminUpload.title")} />
        <Spinner />
      </Screen>
    );
  }

  const stand = standIns.data?.items.find((s) => s.id === standInId);
  const active = state.items.find((i) => i.id === activeId) ?? null;
  const activeCategory = active?.categoryId ? findCategory(ref.categories, active.categoryId) : null;
  const sizeOptions: Option[] = sizeOptionsFor(ref, activeCategory).map((s) => ({
    id: s.id,
    label: s.label,
  }));
  const openPicker = (itemId: string, kind: PickerKind) => {
    setActiveId(itemId);
    const target = {
      category: categoryRef,
      size: sizeRef,
      condition: conditionRef,
      brand: brandRef,
      colours: colourRef,
    }[kind];
    target.current?.present();
  };
  const patchActive = (patch: Record<string, unknown>) => {
    if (!active) return;
    dispatch({ type: "edit", itemId: active.id, patch, reference: ref });
  };

  const confirmDelete = (itemId: string) =>
    Alert.alert(t("adminUpload.item.deleteTitle"), t("adminUpload.item.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("adminUpload.item.delete"),
        style: "destructive",
        onPress: () => dispatch({ type: "deleteItem", itemId }),
      },
    ]);

  return (
    <Screen bottomInset={false}>
      <TopBar leading="close" onBack={close} title={t("adminUpload.title")} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-lg pb-xl"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Section title={t("adminUpload.who.title")}>
          <PickerRow
            label={t("adminUpload.who.username")}
            value={stand?.username}
            onPress={() => standInRef.current?.present()}
            disabled={hasWork}
          />
          {hasWork ? (
            <Text variant="cardMeta" className="-mt-sm">
              {t("adminUpload.who.locked")}
            </Text>
          ) : null}
          {creating && !hasWork ? (
            <View className="gap-md rounded-control border border-border p-md">
              <Text variant="heading">{t("adminUpload.who.newTitle")}</Text>
              <Input
                label={t("adminUpload.who.newUsername")}
                hint={t("adminUpload.who.usernameHint")}
                error={createProblem ?? undefined}
                value={newUsername}
                onChangeText={(text) => {
                  setNewUsername(text);
                  setCreateProblem(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="next"
              />
              <Input
                label={t("adminUpload.who.displayName")}
                value={newDisplayName}
                onChangeText={setNewDisplayName}
                returnKeyType="done"
              />
              <View className="flex-row gap-sm">
                <Button
                  variant="ghost"
                  onPress={() => {
                    setCreating(false);
                    setCreateProblem(null);
                  }}
                >
                  <Text>{t("common.cancel")}</Text>
                </Button>
                <Button
                  className="flex-1"
                  loading={create.isPending}
                  disabled={newUsername.trim().length === 0}
                  onPress={() => create.mutate()}
                >
                  <Text>{t("adminUpload.who.create")}</Text>
                </Button>
              </View>
            </View>
          ) : null}
          <Input
            label={t("adminUpload.who.ownerLabel")}
            hint={t("adminUpload.who.ownerHint")}
            value={owner}
            onChangeText={setOwner}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </Section>

        <Section title={t("adminUpload.photos.title")}>
          <Button
            variant={state.tray.length === 0 ? "default" : "outline"}
            disabled={!standInId}
            onPress={() => void addPhotos()}
          >
            <Icon
              as={ImagePlus}
              size={18}
              className={state.tray.length === 0 ? "text-primary-foreground" : "text-primary"}
            />
            <Text>
              {state.tray.length === 0 ? t("adminUpload.photos.add") : t("adminUpload.photos.addMore")}
            </Text>
          </Button>
          {!standInId ? (
            <Text variant="bodySmall" className="text-text-3">
              {t("adminUpload.photos.needWho")}
            </Text>
          ) : state.tray.length === 0 ? (
            <Text variant="bodySmall" className="text-text-3">
              {t("adminUpload.photos.empty")}
            </Text>
          ) : (
            <Text variant="bodySmall" className="text-text-3">
              {t("adminUpload.photos.hint")}
            </Text>
          )}
          {state.tray.length > 0 ? (
            <View className="flex-row flex-wrap" style={{ gap: GAP }}>
              {state.tray.map((photo) => {
                const order = state.selected.indexOf(photo.id);
                return (
                  <UploadTile
                    key={photo.id}
                    photo={photo}
                    size={tile}
                    order={order >= 0 ? order + 1 : undefined}
                    accessibilityLabel={
                      order >= 0
                        ? t("adminUpload.photos.selected", {
                            n: state.tray.indexOf(photo) + 1,
                            order: order + 1,
                          })
                        : t("adminUpload.photos.select", { n: state.tray.indexOf(photo) + 1 })
                    }
                    onPress={() =>
                      photo.state === "failed"
                        ? retryPhoto(photo)
                        : dispatch({ type: "toggleSelect", photoId: photo.id, max: maxPhotos })
                    }
                    onRemove={() => dispatch({ type: "removeFromTray", photoId: photo.id })}
                  />
                );
              })}
            </View>
          ) : null}
        </Section>

        {state.items.length > 0 ? (
          <View className="gap-md pt-xl">
            {state.items.map((item, index) => (
              <ItemCard
                key={item.id}
                item={item}
                index={index}
                reference={ref}
                categoryLabel={item.categoryId ? (categoryLabels.get(item.categoryId) ?? null) : null}
                onEdit={(patch) => dispatch({ type: "edit", itemId: item.id, patch, reference: ref })}
                onOpenPicker={(kind) => openPicker(item.id, kind)}
                onRemovePhoto={(photoId) =>
                  dispatch({ type: "removePhotoFromItem", itemId: item.id, photoId })
                }
                onRetryPhoto={retryPhoto}
                onDelete={() => confirmDelete(item.id)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View
        className="gap-sm border-t border-border-subtle bg-background px-lg pt-md"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        {notice ? <Banner variant={notice.kind}>{notice.text}</Banner> : null}
        {selecting ? (
          <>
            <Text variant="bodySmall" className="text-text-2">
              {t("adminUpload.selectedCount", { count: state.selected.length, max: maxPhotos })}
            </Text>
            <View className="flex-row gap-sm">
              <Button variant="ghost" onPress={() => dispatch({ type: "clearSelection" })}>
                <Text>{t("adminUpload.clearSelection")}</Text>
              </Button>
              <Button className="flex-1" size="lg" onPress={() => dispatch({ type: "makeItem" })}>
                <Text>{t("adminUpload.makeItem", { count: state.selected.length })}</Text>
              </Button>
            </View>
          </>
        ) : state.items.length > 0 ? (
          <>
            <Text variant="bodySmall" className="text-text-2">
              {t("adminUpload.summary", { ready: ready.length, total: state.items.length - postedCount })}
              {!ownerOk ? (
                <Text variant="bodySmall" className="text-warning">{` ${t("adminUpload.ownerNeeded")}`}</Text>
              ) : null}
            </Text>
            <View className="flex-row gap-sm">
              {postedCount > 0 ? (
                <Button variant="ghost" onPress={() => dispatch({ type: "clearPosted" })}>
                  <Text>{t("adminUpload.clearPosted")}</Text>
                </Button>
              ) : null}
              <Button
                className="flex-1"
                size="lg"
                loading={posting}
                disabled={ready.length === 0 || !ownerOk}
                onPress={() => void post()}
              >
                <Text>
                  {posting ? t("adminUpload.posting") : t("adminUpload.post", { count: ready.length })}
                </Text>
              </Button>
            </View>
          </>
        ) : null}
      </View>

      <OptionListSheet
        ref={standInRef}
        title={t("adminUpload.who.username")}
        mode="single"
        options={(standIns.data?.items ?? []).map((s) => ({
          id: s.id,
          label: s.username,
          description: t("adminUpload.who.counts", {
            active: s.listingCounts.active,
            sold: s.listingCounts.sold,
          }),
        }))}
        selected={standInId ? [standInId] : []}
        header={
          <View className="gap-sm">
            <Pressable
              onPress={() => {
                standInRef.current?.dismiss();
                setCreating(true);
              }}
              role="button"
              accessibilityLabel={t("adminUpload.who.new")}
              className="min-h-12 flex-row items-center gap-sm active:opacity-60"
            >
              <Icon as={Plus} size={20} className="text-primary" />
              <Text weight={600} className="text-primary">
                {t("adminUpload.who.new")}
              </Text>
            </Pressable>
            {standIns.isPending ? (
              <Spinner />
            ) : (standIns.data?.items.length ?? 0) === 0 ? (
              <Text className="text-text-3">{t("adminUpload.who.none")}</Text>
            ) : null}
          </View>
        }
        onChange={([id]) => setStandInId(id ?? null)}
      />
      <CategorySheet
        ref={categoryRef}
        options={options}
        selectedId={active?.categoryId ?? null}
        suggestedIds={active?.categoryGuesses ?? []}
        onChange={(categoryId) => patchActive({ categoryId })}
      />
      <OptionListSheet
        ref={sizeRef}
        title={t("sell.size")}
        mode="single"
        options={sizeOptions}
        selected={active?.sizeId ? [active.sizeId] : []}
        onChange={([sizeId]) => patchActive({ sizeId: sizeId ?? null })}
      />
      <OptionListSheet
        ref={conditionRef}
        title={t("sell.condition")}
        mode="single"
        options={ref.conditions.map((c) => ({
          id: c.id,
          label: name(conditionWords(c, activeCategory).name),
        }))}
        selected={active?.conditionId ? [active.conditionId] : []}
        onChange={([conditionId]) => patchActive({ conditionId: conditionId ?? null })}
      />
      <BrandSheet
        ref={brandRef}
        selected={active?.brandText.trim() ? { id: active.brandId, name: active.brandText } : null}
        onChange={(brand) => patchActive({ brandId: brand?.id ?? null, brandText: brand?.name ?? "" })}
      />
      <ColourGridSheet
        ref={colourRef}
        title={t("sell.colours")}
        max={LISTING_COLOURS_MAX}
        options={ref.colours.map((c) => ({
          id: c.id,
          label: name(c.name),
          en: c.name.en,
          swatch: c.swatchHex,
        }))}
        selected={active?.colourIds ?? []}
        header={
          <Text variant="bodySmall" className="text-text-3">
            {t("sell.coloursHint", { max: LISTING_COLOURS_MAX })}
          </Text>
        }
        onChange={(colourIds) => patchActive({ colourIds })}
      />
    </Screen>
  );
}
