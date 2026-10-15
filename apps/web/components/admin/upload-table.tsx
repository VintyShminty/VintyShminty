"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ADMIN_UPLOAD_BATCH_MAX,
  type AdminPublishInput,
  adminPublishResultSchema,
  listingLimits,
  OWNER_NAME_MIN,
  photoSuggestionSchema,
  type ReferenceData,
  splitIntoGroups,
} from "@vinty/shared";
import { Loader2, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/admin/toast";
import { primaryButton, quietButton } from "@/components/admin/ui";
import { UploadRowCard } from "@/components/admin/upload-row";
import { adminKeys } from "@/lib/admin-keys";
import { adminErrorText } from "@/lib/admin-queries";
import {
  chunk,
  imageFilesOf,
  leafOptions,
  newId,
  newRow,
  photoRoom,
  rowIsReady,
  toPublishItem,
  type UploadPhoto,
  type UploadRow,
  unpublishedCount,
  uploadReducer,
  wantsSuggestion,
} from "@/lib/admin-upload";
import { uploadStandInPhoto } from "@/lib/admin-upload-photos";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const PARALLEL_UPLOADS = 4;

/**
 * Step 2: the fast table. Drop the photos of one item (one drop is one item), fill in the few fields, publish what is complete.
 * Photos go up as they are dropped, then the AI reads each item's photos and suggests category, brand and colours.
 */
export function UploadTable({
  standInId,
  owner,
  reference,
  lang,
  onOpenRows,
}: {
  standInId: string | null;
  owner: string;
  reference: ReferenceData;
  lang: "en" | "he";
  /** Tells the page whether rows are waiting, so the username cannot change under them. */
  onOpenRows: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const client = useQueryClient();
  const [rows, dispatch] = useReducer(uploadReducer, [] as UploadRow[]);
  const [publishing, setPublishing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const options = useMemo(() => leafOptions(reference, lang), [reference, lang]);

  // The files stay here (not in the rows) so a failed photo can be tried again.
  const files = useRef(new Map<string, File>());
  const queue = useRef<(() => Promise<void>)[]>([]);
  const running = useRef(0);
  const asked = useRef(new Set<string>());
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

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
    (rowId: string, photoId: string) => {
      const file = files.current.get(photoId);
      if (!file || !standInId) return;
      queue.current.push(async () => {
        let last = 0;
        try {
          const done = await uploadStandInPhoto(standInId, file, (progress) => {
            if (progress - last < 0.05 && progress < 1) return;
            last = progress;
            dispatch({ type: "photo", rowId, photoId, patch: { progress } });
          });
          dispatch({ type: "photo", rowId, photoId, patch: { status: "done", progress: 1, ...done } });
        } catch (error) {
          dispatch({
            type: "photo",
            rowId,
            photoId,
            patch: { status: "error", error: error instanceof Error ? error.message : undefined },
          });
        }
      });
      pump();
    },
    [standInId, pump],
  );

  const makePhotos = (list: File[]): UploadPhoto[] =>
    list.map((file) => {
      const photo: UploadPhoto = {
        id: newId("photo"),
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        status: "uploading",
        progress: 0,
      };
      files.current.set(photo.id, file);
      return photo;
    });

  /** One drop (or one file picker choice) is one item. Photos past the photo maximum start further items. */
  const addAsRows = (list: File[]) => {
    if (!standInId || list.length === 0) return;
    const created = splitIntoGroups(makePhotos(list), listingLimits(reference).maxPhotos).map((photos) =>
      newRow(photos),
    );
    dispatch({ type: "addRows", rows: created });
    for (const row of created) for (const photo of row.photos) enqueueUpload(row.id, photo.id);
  };

  const addToRow = (rowId: string, list: File[]) => {
    if (!standInId || list.length === 0) return;
    const row = rowsRef.current.find((r) => r.id === rowId);
    if (!row) return;
    const photos = makePhotos(list.slice(0, photoRoom(row, reference)));
    dispatch({ type: "addPhotos", rowId, photos });
    for (const photo of photos) enqueueUpload(rowId, photo.id);
  };

  const removePhoto = (rowId: string, photoId: string) => {
    const photo = rowsRef.current.find((r) => r.id === rowId)?.photos.find((p) => p.id === photoId);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    files.current.delete(photoId);
    dispatch({ type: "removePhoto", rowId, photoId });
  };

  const retryPhoto = (rowId: string, photoId: string) => {
    dispatch({
      type: "photo",
      rowId,
      photoId,
      patch: { status: "uploading", progress: 0, error: undefined },
    });
    enqueueUpload(rowId, photoId);
  };

  // When a row's photos have all finished, the AI looks at them once.
  useEffect(() => {
    if (!standInId) return;
    for (const row of rows) {
      if (!wantsSuggestion(row) || asked.current.has(row.id)) continue;
      asked.current.add(row.id);
      dispatch({ type: "suggesting", rowId: row.id });
      const keys = row.photos.flatMap((p) => (p.status === "done" && p.key ? [p.key] : [])).slice(0, 4);
      clientApi(`/v1/admin/stand-ins/${standInId}/suggest`, {
        method: "POST",
        body: { photoKeys: keys, language: lang },
        schema: photoSuggestionSchema,
      })
        .then((suggestion) => dispatch({ type: "suggested", rowId: row.id, suggestion, reference }))
        .catch(() => dispatch({ type: "suggestFailed", rowId: row.id }));
    }
  }, [rows, standInId, lang, reference]);

  const open = unpublishedCount(rows) > 0;
  useEffect(() => onOpenRows(open), [open, onOpenRows]);

  // Leaving the page with unpublished items loses them (the photos stay in storage, the rows do not).
  useEffect(() => {
    if (!open) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    // Links inside the site (the admin sidebar, Back to Yadii) do not fire beforeunload, so ask before following one.
    const guardLinks = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (window.confirm(t("admin.upload.leaveWarning"))) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLinks, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLinks, true);
    };
  }, [open, t]);

  const ready = rows.filter((r) => rowIsReady(r, reference));
  const ownerOk = owner.trim().length >= OWNER_NAME_MIN;
  const published = rows.filter((r) => r.state === "published").length;

  const publish = async () => {
    if (!standInId || ready.length === 0 || publishing) return;
    if (!ownerOk) {
      toast(t("admin.upload.errors.ownerRequired"), "error");
      return;
    }
    setPublishing(true);
    dispatch({ type: "publishing", rowIds: ready.map((r) => r.id) });
    let created = 0;
    let failed = 0;
    for (const part of chunk(ready, ADMIN_UPLOAD_BATCH_MAX)) {
      try {
        const body: AdminPublishInput = {
          ownerFullName: owner.trim(),
          items: part.map((r) => toPublishItem(r, reference)),
        };
        const result = await clientApi(`/v1/admin/stand-ins/${standInId}/listings`, {
          method: "POST",
          body,
          schema: adminPublishResultSchema,
        });
        dispatch({ type: "results", result });
        created += result.createdCount;
        failed += result.failedCount;
      } catch (error) {
        dispatch({ type: "publishFailed", rowIds: part.map((r) => r.id), message: adminErrorText(error, t) });
        failed += part.length;
      }
    }
    setPublishing(false);
    void client.invalidateQueries({ queryKey: adminKeys.standIns });
    void client.invalidateQueries({ queryKey: adminKeys.uploadsAll });
    void client.invalidateQueries({ queryKey: adminKeys.dashboard });
    if (created > 0) toast(t("admin.upload.published", { count: created }));
    if (failed > 0) toast(t("admin.upload.publishFailed", { count: failed }), "error");
  };

  const canDrop = Boolean(standInId);
  return (
    <section aria-labelledby="upload-step-2" className="mt-xl">
      <h2 id="upload-step-2" className="mb-md text-heading font-bold text-text-1">
        {t("admin.upload.step2")}
      </h2>

      {/* Photos dropped here (not on a row) make one new item together. */}
      <fieldset
        onDragOver={(e) => {
          if (!canDrop || !Array.from(e.dataTransfer.types).includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addAsRows(imageFilesOf(Array.from(e.dataTransfer.files)));
        }}
        className={cn(
          "m-0 flex min-w-0 flex-col items-center gap-sm rounded-window border-2 border-dashed p-xl text-center",
          dragging ? "border-primary bg-pressed" : "border-text-4 bg-surface",
          !canDrop && "opacity-60",
        )}
      >
        <legend className="sr-only">{t("admin.upload.drop")}</legend>
        <UploadCloud size={28} aria-hidden className="text-text-3" />
        <p className="text-body font-semibold text-text-1">{t("admin.upload.drop")}</p>
        <p className="text-body-sm text-text-3">
          {canDrop ? t("admin.upload.dropHint") : t("admin.upload.needWho")}
        </p>
        <button
          type="button"
          disabled={!canDrop}
          onClick={() => input.current?.click()}
          className={quietButton}
        >
          {t("admin.upload.pickFiles")}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          hidden
          onChange={(e) => {
            addAsRows(imageFilesOf(Array.from(e.target.files ?? [])));
            e.target.value = "";
          }}
        />
      </fieldset>

      {rows.length > 0 ? (
        <>
          <ul className="mt-lg flex flex-col gap-md">
            {rows.map((row) => (
              <UploadRowCard
                key={row.id}
                row={row}
                reference={reference}
                lang={lang}
                options={options}
                onEdit={(patch) => dispatch({ type: "edit", rowId: row.id, patch, reference })}
                onAddFiles={(list) => addToRow(row.id, list)}
                onRemovePhoto={(photoId) => removePhoto(row.id, photoId)}
                onRetryPhoto={(photoId) => retryPhoto(row.id, photoId)}
                onRemove={() => {
                  for (const photo of row.photos) {
                    URL.revokeObjectURL(photo.previewUrl);
                    files.current.delete(photo.id);
                  }
                  dispatch({ type: "removeRow", rowId: row.id });
                }}
              />
            ))}
          </ul>

          <div className="sticky bottom-0 z-10 mt-lg flex flex-wrap items-center justify-between gap-md rounded-window border border-border bg-background p-md shadow-lg">
            <p className="text-body-sm text-text-2">
              {t("admin.upload.summary", { ready: ready.length, total: rows.length - published })}
              {!ownerOk ? <span className="text-warning"> {t("admin.upload.ownerNeeded")}</span> : null}
            </p>
            <div className="flex flex-wrap gap-sm">
              {published > 0 ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "clearPublished" })}
                  className={quietButton}
                >
                  {t("admin.upload.clearPublished")}
                </button>
              ) : null}
              <button
                type="button"
                disabled={publishing || ready.length === 0 || !ownerOk}
                onClick={() => void publish()}
                className={primaryButton}
              >
                {publishing ? <Loader2 size={16} aria-hidden className="me-sm animate-spin" /> : null}
                {publishing
                  ? t("admin.upload.publishing")
                  : t("admin.upload.publish", { count: ready.length })}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
