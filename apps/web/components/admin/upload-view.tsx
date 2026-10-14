"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoadFailed, Loading, PageTitle } from "@/components/admin/ui";
import { UploadedItems } from "@/components/admin/upload-items";
import { UploadTable } from "@/components/admin/upload-table";
import { UploadWho } from "@/components/admin/upload-who";
import { useReferenceData } from "@/lib/admin-upload-queries";
import { cn } from "@/lib/utils";

const TABS = ["new", "items"] as const;

/**
 * Listing upload: put many clothes online under a public username the team picks, and record the private full name of
 * the real owner of each item. Both tabs stay on the page while you switch, so the table is never lost.
 */
export function UploadView() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "he" ? "he" : "en";
  const reference = useReferenceData();
  const [tab, setTab] = useState<(typeof TABS)[number]>("new");
  const [standInId, setStandInId] = useState<string | null>(null);
  const [owner, setOwner] = useState("");
  const [locked, setLocked] = useState(false);
  const onOpenRows = useCallback((open: boolean) => setLocked(open), []);

  return (
    <>
      <PageTitle title={t("admin.nav.upload")} />
      <div role="tablist" aria-label={t("admin.nav.upload")} className="mb-lg flex flex-wrap gap-sm">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`upload-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`upload-panel-${key}`}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-md text-body-sm font-semibold",
              tab === key
                ? "border-transparent bg-chip-selected text-on-chip"
                : "border-text-4 text-text-2 hover:bg-pressed",
            )}
          >
            {t(`admin.upload.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div id="upload-panel-new" role="tabpanel" aria-labelledby="upload-tab-new" hidden={tab !== "new"}>
        <UploadWho
          standInId={standInId}
          onStandIn={setStandInId}
          owner={owner}
          onOwner={setOwner}
          locked={locked}
        />
        {reference.data ? (
          <UploadTable
            standInId={standInId}
            owner={owner}
            reference={reference.data}
            lang={lang}
            onOpenRows={onOpenRows}
          />
        ) : reference.isError ? (
          <LoadFailed onRetry={() => void reference.refetch()} />
        ) : (
          <Loading />
        )}
      </div>
      <div
        id="upload-panel-items"
        role="tabpanel"
        aria-labelledby="upload-tab-items"
        hidden={tab !== "items"}
      >
        <UploadedItems lang={lang} />
      </div>
    </>
  );
}
