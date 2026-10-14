"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ADMIN_USER_FILTERS, type AdminUser } from "@vinty/shared";
import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/admin/toast";
import { inputClass, LoadFailed, Loading, PageTitle, quietButton } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useViewer } from "@/components/site-context";
import { adminKeys } from "@/lib/admin-keys";
import { adminErrorText, useAdminUsers } from "@/lib/admin-queries";
import { clientApi } from "@/lib/api-client";
import { formatDate, timeAgo } from "@/lib/time";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

const rowButton =
  "inline-flex h-9 items-center rounded-control border border-border px-md text-body-sm font-semibold hover:bg-pressed disabled:opacity-60";

function UserRow({
  user,
  isSelf,
  busy,
  onRole,
  onDelete,
}: {
  user: AdminUser;
  isSelf: boolean;
  busy: boolean;
  onRole: (role: "user" | "admin") => void;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isAdmin = user.role === "admin";
  return (
    <li className="flex flex-col gap-md rounded-window border border-border bg-surface p-lg md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-sm">
          <p className="truncate text-body font-semibold text-text-1">{user.username ?? user.name}</p>
          {isAdmin ? <Tag tone="primary">{t("admin.users.adminTag")}</Tag> : null}
          {user.role === "moderator" ? <Tag tone="primary">{t("admin.users.moderatorTag")}</Tag> : null}
          {user.banned ? <Tag tone="error">{t("admin.users.bannedTag")}</Tag> : null}
          {user.isStandIn ? <Tag tone="warning">{t("admin.users.standIn")}</Tag> : null}
        </div>
        <p className="truncate text-body-sm text-text-3" dir="auto">
          {user.name} · {user.email}
        </p>
        <p className="text-card-meta text-text-3">
          {t("admin.users.joined", { date: formatDate(user.createdAt, i18n.language) })}
          {" · "}
          {user.lastSignInAt
            ? t("admin.users.lastSignIn", { when: timeAgo(user.lastSignInAt, t) })
            : t("admin.users.neverSignedIn")}
          {" · "}
          {t("admin.users.listings", { count: user.listingCount })}
        </p>
      </div>
      {isSelf ? (
        <p className="text-body-sm text-text-3">{t("admin.users.you")}</p>
      ) : (
        <div className="flex shrink-0 flex-wrap gap-sm">
          <button
            type="button"
            disabled={busy}
            onClick={() => onRole(isAdmin ? "user" : "admin")}
            className={cn(rowButton, "text-text-1")}
          >
            {isAdmin ? t("admin.users.removeAdmin") : t("admin.users.makeAdmin")}
          </button>
          <button type="button" disabled={busy} onClick={onDelete} className={cn(rowButton, "text-error")}>
            {t("admin.users.delete")}
          </button>
        </div>
      )}
    </li>
  );
}

function Tag({ tone, children }: { tone: "primary" | "error" | "warning"; children: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-sm py-px text-badge font-semibold",
        tone === "primary" && "bg-chip-selected text-on-chip",
        tone === "error" && "bg-error-tint text-error",
        tone === "warning" && "bg-warning-tint text-warning",
      )}
    >
      {children}
    </span>
  );
}

/** Every person, with filter tabs, search, make or remove admin and delete. */
export function UsersView() {
  const { t } = useTranslation();
  const toast = useToast();
  const client = useQueryClient();
  const viewer = useViewer();
  const [filter, setFilter] = useState<(typeof ADMIN_USER_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const query = useAdminUsers(filter, q);
  const users = query.data?.pages.flatMap((p) => p.items) ?? [];

  const refresh = () => {
    void client.invalidateQueries({ queryKey: adminKeys.usersAll });
    void client.invalidateQueries({ queryKey: adminKeys.dashboard });
  };

  const setRole = useMutation({
    mutationFn: ({ user, role }: { user: AdminUser; role: "user" | "admin" }) =>
      clientApi(`/v1/admin/users/${user.id}/role`, { method: "POST", body: { role } }),
    onSuccess: (_, { user, role }) => {
      refresh();
      toast(
        t(role === "admin" ? "admin.users.madeAdmin" : "admin.users.removedAdmin", {
          name: user.username ?? user.name,
        }),
      );
    },
    onError: (error) => toast(adminErrorText(error, t), "error"),
  });

  const remove = useMutation({
    mutationFn: (user: AdminUser) => clientApi(`/v1/admin/users/${user.id}`, { method: "DELETE" }),
    onSuccess: (_, user) => {
      refresh();
      toast(t("admin.users.deleted", { name: user.username ?? user.name }));
    },
    onError: (error) => toast(adminErrorText(error, t), "error"),
    onSettled: () => setToDelete(null),
  });

  return (
    <>
      <PageTitle title={t("admin.nav.users")} />
      <div className="mb-lg flex flex-col gap-md md:flex-row md:items-center md:justify-between">
        <fieldset className="m-0 flex min-w-0 flex-wrap gap-sm border-0 p-0">
          <legend className="sr-only">{t("admin.users.filters")}</legend>
          {ADMIN_USER_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-md text-body-sm font-semibold",
                filter === f
                  ? "border-transparent bg-chip-selected text-on-chip"
                  : "border-text-4 text-text-2 hover:bg-pressed",
              )}
            >
              {t(`admin.users.filter.${f}`)}
            </button>
          ))}
        </fieldset>
        <label className="relative md:w-72">
          <span className="sr-only">{t("admin.users.search")}</span>
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute start-md top-1/2 -translate-y-1/2 text-text-3"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.users.search")}
            className={cn(inputClass, "w-full ps-[38px]")}
          />
        </label>
      </div>

      {query.data === undefined ? (
        query.isError ? (
          <LoadFailed onRetry={() => void query.refetch()} />
        ) : (
          <Loading />
        )
      ) : users.length === 0 ? (
        <p className="py-2xl text-center text-body-sm text-text-3">{t("admin.users.empty")}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-sm">
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === viewer?.id}
                busy={setRole.isPending || remove.isPending}
                onRole={(role) => setRole.mutate({ user, role })}
                onDelete={() => setToDelete(user)}
              />
            ))}
          </ul>
          {query.hasNextPage ? (
            <div className="mt-lg flex justify-center">
              <button
                type="button"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
                className={quietButton}
              >
                {t("admin.users.loadMore")}
              </button>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={t("admin.users.deleteTitle", { name: toDelete?.username ?? toDelete?.name ?? "" })}
        body={t("admin.users.deleteBody")}
        confirmLabel={t("admin.users.delete")}
        destructive
        busy={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
