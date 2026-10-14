"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OWNER_NAME_MAX, type StandIn, standInSchema, USERNAME_MAX } from "@vinty/shared";
import type { TFunction } from "i18next";
import { Globe, Lock, Plus, Search } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/admin/toast";
import { Card, inputClass, primaryButton, QueryState, quietButton } from "@/components/admin/ui";
import { adminKeys } from "@/lib/admin-keys";
import { adminErrorText } from "@/lib/admin-queries";
import { useStandIns } from "@/lib/admin-upload-queries";
import { clientApi } from "@/lib/api-client";
import { ApiClientError } from "@/lib/api-error";
import { cn } from "@/lib/utils";

/** The words for a username problem the server named with a translation key (taken, reserved, too short...). */
function usernameProblem(error: unknown, t: TFunction): string {
  if (error instanceof ApiClientError) {
    const key = error.fields?.username;
    if (key?.startsWith("validation.")) return t(key);
  }
  return adminErrorText(error, t);
}

function CreateStandIn({ onCreated }: { onCreated: (standIn: StandIn) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      clientApi("/v1/admin/stand-ins", {
        method: "POST",
        body: {
          username: username.trim(),
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        },
        schema: standInSchema,
      }),
    onSuccess: (created) => {
      void client.invalidateQueries({ queryKey: adminKeys.standIns });
      toast(t("admin.upload.who.created", { name: created.username }));
      setOpen(false);
      setUsername("");
      setDisplayName("");
      setProblem(null);
      onCreated(created);
    },
    onError: (error) => setProblem(usernameProblem(error, t)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    create.mutate();
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn(quietButton, "mt-md gap-sm")}>
        <Plus size={16} aria-hidden />
        {t("admin.upload.who.new")}
      </button>
    );
  }
  return (
    <form
      onSubmit={submit}
      className="mt-md flex flex-col gap-md rounded-control border border-border bg-background p-md"
    >
      <label className="flex flex-col gap-xs">
        <span className="text-card-meta font-semibold text-text-3">{t("admin.upload.who.username")}</span>
        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setProblem(null);
          }}
          maxLength={USERNAME_MAX + 5}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          aria-invalid={problem ? true : undefined}
          placeholder="vintage.closet"
          className={cn(inputClass, problem && "border-error")}
        />
        <span className="text-card-meta text-text-3">{t("admin.upload.who.usernameHint")}</span>
      </label>
      <label className="flex flex-col gap-xs">
        <span className="text-card-meta font-semibold text-text-3">{t("admin.upload.who.displayName")}</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={50}
          className={inputClass}
        />
      </label>
      {problem ? (
        <p role="alert" className="text-body-sm font-semibold text-error">
          {problem}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-sm">
        <button
          type="submit"
          disabled={create.isPending || username.trim().length === 0}
          className={primaryButton}
        >
          {t("admin.upload.who.create")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setProblem(null);
          }}
          className={quietButton}
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

/** Step 1: who is this batch for. The public username to show, and the private full name of the real owner. */
export function UploadWho({
  standInId,
  onStandIn,
  owner,
  onOwner,
  locked,
}: {
  standInId: string | null;
  onStandIn: (id: string | null) => void;
  owner: string;
  onOwner: (name: string) => void;
  /** Items are waiting in the table, so the username cannot change under them. */
  locked: boolean;
}) {
  const { t } = useTranslation();
  const standIns = useStandIns();
  const [search, setSearch] = useState("");

  return (
    <section aria-labelledby="upload-step-1">
      <h2 id="upload-step-1" className="mb-md text-heading font-bold text-text-1">
        {t("admin.upload.step1")}
      </h2>
      <div className="grid gap-md lg:grid-cols-2">
        <Card>
          <p className="mb-xs flex items-center gap-sm text-body-sm font-semibold text-text-1">
            <Globe size={16} aria-hidden />
            {t("admin.upload.who.publicTitle")}
          </p>
          <p className="mb-md text-body-sm text-text-3">{t("admin.upload.who.publicNote")}</p>
          <QueryState query={standIns}>
            {({ items }) => {
              const needle = search.trim().toLowerCase();
              const shown = needle
                ? items.filter((s) => `${s.username} ${s.displayName}`.toLowerCase().includes(needle))
                : items;
              return (
                <>
                  {items.length > 0 ? (
                    <label className="relative mb-sm block">
                      <span className="sr-only">{t("admin.upload.who.search")}</span>
                      <Search
                        size={16}
                        aria-hidden
                        className="pointer-events-none absolute start-md top-1/2 -translate-y-1/2 text-text-3"
                      />
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("admin.upload.who.search")}
                        className={cn(inputClass, "w-full ps-[38px]")}
                      />
                    </label>
                  ) : (
                    <p className="mb-sm text-body-sm text-text-3">{t("admin.upload.who.none")}</p>
                  )}
                  {items.length > 0 ? (
                    <ul
                      className="flex max-h-60 flex-col gap-xs overflow-y-auto"
                      aria-label={t("admin.upload.who.publicTitle")}
                    >
                      {shown.map((s) => {
                        const selected = s.id === standInId;
                        return (
                          <li key={s.id}>
                            <button
                              type="button"
                              aria-pressed={selected}
                              disabled={locked && !selected}
                              onClick={() => onStandIn(s.id)}
                              className={cn(
                                "flex w-full flex-col items-start gap-px rounded-control border px-md py-sm text-start disabled:opacity-50",
                                selected ? "border-primary bg-pressed" : "border-border hover:bg-pressed",
                              )}
                            >
                              <span className="text-body-sm font-semibold text-text-1" dir="ltr">
                                {s.username}
                              </span>
                              <span className="text-card-meta text-text-3">
                                {t("admin.upload.who.counts", {
                                  active: s.listingCounts.active,
                                  sold: s.listingCounts.sold,
                                })}
                                {s.ownerNames.length > 0
                                  ? ` · ${t("admin.upload.who.owners", { count: s.ownerNames.length })}`
                                  : ""}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      {shown.length === 0 ? (
                        <li className="py-sm text-body-sm text-text-3">{t("admin.upload.who.noMatch")}</li>
                      ) : null}
                    </ul>
                  ) : null}
                  {locked ? (
                    <p className="mt-sm text-card-meta text-warning">{t("admin.upload.who.locked")}</p>
                  ) : null}
                  {!locked ? (
                    <CreateStandIn
                      onCreated={(created) => {
                        setSearch("");
                        onStandIn(created.id);
                      }}
                    />
                  ) : null}
                </>
              );
            }}
          </QueryState>
        </Card>

        <Card>
          <p className="mb-xs flex items-center gap-sm text-body-sm font-semibold text-text-1">
            <Lock size={16} aria-hidden />
            {t("admin.upload.who.privateTitle")}
          </p>
          <p className="mb-md text-body-sm text-text-3">{t("admin.upload.who.privateNote")}</p>
          <label className="flex flex-col gap-xs">
            <span className="text-card-meta font-semibold text-text-3">
              {t("admin.upload.who.ownerLabel")}
            </span>
            <input
              type="text"
              value={owner}
              maxLength={OWNER_NAME_MAX}
              onChange={(e) => onOwner(e.target.value)}
              dir="auto"
              autoComplete="off"
              className={inputClass}
            />
          </label>
          <p className="mt-sm text-card-meta text-text-3">{t("admin.upload.who.ownerHint")}</p>
        </Card>
      </div>
    </section>
  );
}
