import { useQuery } from "@tanstack/react-query";
import type { ReferralItem, Voucher } from "@vinty/shared";
import { Check, Clock, Gift, Share2, Ticket, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, LoadError } from "@/components/orders/states";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/row";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { ApiClientError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { referralQuery, useRedeemReferral } from "@/lib/referral-queries";
import { colors } from "@/theme";

/** Maps what the server said about a friend's code to words. */
function redeemErrorKey(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "network") return "errors.network";
    if (error.status === 429) return "errors.tooManyRequests";
    if (error.status === 404) return "invite.errorNotFound";
    if (error.status === 403) return "invite.errorTooOld";
    if (error.status === 409) return "invite.errorAlready";
    if (error.fields?.code === "own_code") return "invite.errorOwn";
    if (error.status === 400) return "invite.errorShape";
  }
  return "errors.general";
}

function FriendRow({ item }: { item: ReferralItem }) {
  const { t } = useTranslation();
  const name = item.friend?.username ?? t("invite.closedAccount");
  const rewarded = item.status === "rewarded";
  return (
    <View className="flex-row items-center gap-md border-b border-border-subtle px-lg py-md">
      <Avatar uri={item.friend?.avatarUrl} name={name} size={40} />
      <Text weight={600} className="flex-1" numberOfLines={1}>
        {name}
      </Text>
      <Badge
        variant={rewarded ? "success" : "neutral"}
        icon={rewarded ? Check : Clock}
        label={rewarded ? t("invite.statusRewarded") : t("invite.statusJoined")}
      />
    </View>
  );
}

function VoucherRow({ voucher }: { voucher: Voucher }) {
  const { t, i18n } = useTranslation();
  const active = voucher.status === "active";
  const until = voucher.expiresAt
    ? new Date(voucher.expiresAt).toLocaleDateString(i18n.language, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  return (
    <View className="flex-row items-center gap-md border-b border-border-subtle px-lg py-md">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-tint">
        <Icon as={Ticket} size={20} className="text-primary" />
      </View>
      <View className="flex-1 gap-xs">
        <Text weight={700} className={active ? undefined : "text-text-4"}>
          {formatMoney(voucher.amountMinor, voucher.currency)}
        </Text>
        <Text variant="cardMeta">
          {[
            voucher.minOrderMinor > 0
              ? t("invite.voucherMin", { amount: formatMoney(voucher.minOrderMinor, voucher.currency) })
              : null,
            active && until ? t("invite.voucherUntil", { date: until }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <Badge
        variant={active ? "success" : "neutral"}
        icon={active ? Check : X}
        label={t(
          active
            ? "invite.voucherReady"
            : voucher.status === "used"
              ? "invite.voucherUsed"
              : "invite.voucherExpired",
        )}
      />
    </View>
  );
}

/** Invite friends: your code, how it works, who joined, your vouchers, and a way to enter a friend's code. */
export default function Invite() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const referral = useQuery(referralQuery());
  const redeem = useRedeemReferral();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const data = referral.data;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await referral.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const share = async () => {
    if (!data) return;
    try {
      await Share.share({ message: t("invite.shareMessage", { code: data.inviteCode, link: data.link }) });
    } catch {
      // Closing the share sheet is not an error.
    }
  };

  const addCode = async () => {
    setCodeError(undefined);
    try {
      await redeem.mutateAsync({ code });
      setCode("");
    } catch (err) {
      setCodeError(t(redeemErrorKey(err)));
    }
  };

  let body: React.ReactElement;
  if (referral.isPending) {
    body = <Spinner />;
  } else if (!data) {
    body = <LoadError onRetry={() => void referral.refetch()} />;
  } else {
    const amount = formatMoney(data.rewardMinor, data.currency);
    const minimum = formatMoney(data.minOrderMinor, data.currency);
    body = (
      <>
        <View className="mx-lg mt-md items-center gap-md rounded-window border border-border bg-surface p-xl">
          <Icon as={Gift} size={28} className="text-primary" />
          <Text variant="heading" className="text-center">
            {t("invite.heroTitle", { amount })}
          </Text>
          <Text variant="cardMeta">{t("invite.yourCode")}</Text>
          <Text
            variant="title"
            weight={700}
            className="tracking-widest"
            selectable
            accessibilityLabel={data.inviteCode.split("").join(" ")}
          >
            {data.inviteCode}
          </Text>
          <Button size="lg" className="self-stretch" onPress={() => void share()}>
            <Icon as={Share2} size={18} className="text-primary-foreground" />
            <Text>{t("invite.share")}</Text>
          </Button>
        </View>

        <SectionHeader>{t("invite.howTitle")}</SectionHeader>
        <View className="gap-md px-lg">
          {[t("invite.how1"), t("invite.how2"), t("invite.how3", { minimum, amount })].map((line, n) => (
            <View key={line} className="flex-row items-start gap-md">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-pressed">
                <Text variant="badge" weight={700}>
                  {n + 1}
                </Text>
              </View>
              <Text className="flex-1">{line}</Text>
            </View>
          ))}
        </View>

        <SectionHeader>{t("invite.friendsTitle")}</SectionHeader>
        {data.referrals.length === 0 ? (
          <EmptyState title={t("invite.friendsEmpty")} note={t("invite.friendsEmptyNote")} />
        ) : (
          data.referrals.map((r) => <FriendRow key={r.id} item={r} />)
        )}

        <SectionHeader>{t("invite.vouchersTitle")}</SectionHeader>
        {data.vouchers.length === 0 ? (
          <EmptyState title={t("invite.vouchersEmpty")} note={t("invite.vouchersEmptyNote")} />
        ) : (
          <>
            {data.vouchers.map((v) => (
              <VoucherRow key={v.id} voucher={v} />
            ))}
            <Banner variant="info" className="mx-lg mt-md">
              {t("invite.checkoutSoon")}
            </Banner>
          </>
        )}

        {data.invitedBy ? (
          <>
            <SectionHeader>{t("invite.haveCode")}</SectionHeader>
            <Banner variant="success" className="mx-lg">
              {t("invite.invitedBy", { name: data.invitedBy.username ?? t("invite.closedAccount") })}
            </Banner>
          </>
        ) : data.canRedeem ? (
          <>
            <SectionHeader>{t("invite.haveCode")}</SectionHeader>
            <View className="gap-md px-lg">
              <Input
                label={t("invite.codeLabel")}
                hint={t("invite.codeHint")}
                value={code}
                onChangeText={(v) => {
                  setCode(v);
                  setCodeError(undefined);
                }}
                error={codeError}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => void addCode()}
              />
              <Button
                variant="outline"
                loading={redeem.isPending}
                disabled={code.trim().length === 0}
                onPress={() => void addCode()}
              >
                <Text>{t("invite.codeApply")}</Text>
              </Button>
            </View>
          </>
        ) : null}
      </>
    );
  }

  return (
    <Screen bottomInset={false}>
      <TopBar title={t("invite.title")} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.accent}
          />
        }
      >
        {body}
      </ScrollView>
    </Screen>
  );
}
