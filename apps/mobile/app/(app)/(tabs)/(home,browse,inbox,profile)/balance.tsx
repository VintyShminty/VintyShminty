import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { BalanceEntry } from "@vinty/shared";
import { useRouter } from "expo-router";
import { Clock, Landmark, ShoppingBag, XCircle } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, SectionList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ListSkeleton, LoadError } from "@/components/orders/states";
import { WithdrawSheet } from "@/components/orders/withdraw-sheet";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { ForwardIcon, TopBar } from "@/components/ui/top-bar";
import { formatMoney } from "@/lib/money";
import { balanceEntriesQuery, balanceQuery } from "@/lib/orders-queries";
import { cn } from "@/lib/utils";
import { colors } from "@/theme";

function CircleAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: typeof Landmark;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      role="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={cn("items-center gap-sm", disabled && "opacity-40")}
    >
      <View className="h-[60px] w-[60px] items-center justify-center rounded-full bg-pressed active:bg-chip-selected">
        <Icon as={icon} size={24} className="text-primary" />
      </View>
      <Text variant="bodySmall" weight={600}>
        {label}
      </Text>
    </Pressable>
  );
}

function EntryRow({ entry }: { entry: BalanceEntry }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const label = t(`balance.entry.${entry.type}`);
  const body = (
    <View className="flex-row items-center gap-md border-b border-border-subtle px-lg py-md">
      <View className="flex-1 gap-xs">
        <Text weight={600} className={entry.status === "void" ? "text-text-4 line-through" : undefined}>
          {label}
        </Text>
        <Text variant="cardMeta">
          {[
            entry.orderNumber !== null ? t("orders.orderNumber", { number: entry.orderNumber }) : null,
            new Date(entry.createdAt).toLocaleDateString(i18n.language, { day: "numeric", month: "short" }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {entry.status === "pending" ? (
          <Badge variant="warning" icon={Clock} label={t("balance.pending")} />
        ) : entry.status === "void" ? (
          <Badge variant="error" icon={XCircle} label={t("balance.void")} />
        ) : null}
      </View>
      <Text
        weight={700}
        className={cn(
          entry.status === "void"
            ? "text-text-4 line-through"
            : entry.amountMinor < 0
              ? "text-text-1"
              : "text-success",
        )}
      >
        {entry.amountMinor > 0 ? "+" : entry.amountMinor < 0 ? "-" : ""}
        {formatMoney(Math.abs(entry.amountMinor), entry.currency)}
      </Text>
      {entry.orderId ? <ForwardIcon /> : null}
    </View>
  );
  if (!entry.orderId) return body;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/order/[id]", params: { id: entry.orderId as string } })}
      role="button"
      accessibilityLabel={label}
      className="active:bg-surface"
    >
      {body}
    </Pressable>
  );
}

/** Balance: what you can withdraw, what is still waiting for a delivery, and every move, newest first by month. */
export default function Balance() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const balance = useQuery(balanceQuery());
  const entries = useInfiniteQuery(balanceEntriesQuery());
  const withdrawSheet = useRef<BottomSheetModal>(null);
  const [refreshing, setRefreshing] = useState(false);
  const rows = entries.data?.pages.flatMap((p) => p.items) ?? [];
  const sections: { month: string; data: BalanceEntry[] }[] = [];
  for (const row of rows) {
    const last = sections[sections.length - 1];
    if (last?.month === row.month) last.data.push(row);
    else sections.push({ month: row.month, data: [row] });
  }
  const b = balance.data;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([balance.refetch(), entries.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const monthLabel = (month: string) => {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y as number, (m as number) - 1, 1)).toLocaleDateString(i18n.language, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  let empty: React.ReactElement | null = null;
  if (entries.isPending) empty = <ListSkeleton rows={3} />;
  else if (entries.isError && rows.length === 0) empty = <LoadError onRetry={() => void entries.refetch()} />;
  else if (rows.length === 0)
    empty = <EmptyState title={t("balance.emptyTitle")} note={t("balance.emptyNote")} />;

  return (
    <Screen bottomInset={false}>
      <TopBar title={t("balance.title")} />
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <EntryRow entry={item} />}
        renderSectionHeader={({ section }) => (
          <Text variant="sectionLabel" className="bg-background px-lg pb-sm pt-xl" accessibilityRole="header">
            {monthLabel(section.month)}
          </Text>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        ListHeaderComponent={
          <View className="items-center gap-lg px-lg pb-md pt-md">
            {balance.isError && !b ? (
              <Banner variant="error">{t("errors.loadFailed")}</Banner>
            ) : !b ? (
              <Spinner />
            ) : (
              <>
                <View className="items-center gap-xs">
                  <Text variant="cardMeta">{t("balance.available")}</Text>
                  <Text
                    variant="title"
                    accessibilityLabel={`${t("balance.available")}: ${formatMoney(b.available, b.currency)}`}
                  >
                    {formatMoney(b.available, b.currency)}
                  </Text>
                  <Text variant="bodySmall" className="text-text-3">
                    {t("balance.pendingLine", { amount: formatMoney(b.pending, b.currency) })}
                  </Text>
                </View>
                <View className="flex-row gap-2xl">
                  <CircleAction
                    icon={Landmark}
                    label={t("balance.withdraw")}
                    disabled={b.available <= 0}
                    onPress={() => withdrawSheet.current?.present()}
                  />
                  <CircleAction
                    icon={ShoppingBag}
                    label={t("balance.shop")}
                    onPress={() => router.navigate("/")}
                  />
                </View>
                <Banner variant="info" className="self-stretch">
                  {t("balance.pretendNote")}
                </Banner>
              </>
            )}
          </View>
        }
        ListEmptyComponent={empty}
        ListFooterComponent={entries.isFetchingNextPage ? <Spinner /> : null}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (entries.hasNextPage && !entries.isFetchingNextPage) void entries.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-2xl"
      />
      <WithdrawSheet ref={withdrawSheet} availableMinor={b?.available ?? 0} currency={b?.currency ?? "ILS"} />
    </Screen>
  );
}
