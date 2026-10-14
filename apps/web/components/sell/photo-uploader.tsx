"use client";

import { movePhoto } from "@vinty/shared";
import { Camera, ChevronLeft, ChevronRight, Plus, RotateCcw, X } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { prepareListingPhoto, uploadListingPhoto } from "@/lib/listing-photo-upload";
import { newPhotoId, type SellPhoto } from "@/lib/sell-state";
import { cn } from "@/lib/utils";

type SetPhotos = Dispatch<SetStateAction<SellPhoto[]>>;

/** The full size viewer: the browser's modal dialog with the picture, arrows and a close button. */
function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: SellPhoto[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const open = index !== null;
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  const photo = index === null ? null : photos[index];
  return (
    <dialog
      ref={dialog}
      aria-label={t("web.sell.photos.viewerLabel")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (index === null) return;
        const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
        const next = rtl ? "ArrowLeft" : "ArrowRight";
        const prev = rtl ? "ArrowRight" : "ArrowLeft";
        if (e.key === next && index < photos.length - 1) onIndex(index + 1);
        if (e.key === prev && index > 0) onIndex(index - 1);
      }}
      className="m-auto h-[min(90dvh,900px)] w-[min(94vw,900px)] rounded-window border-0 bg-background p-0 backdrop:bg-backdrop open:flex"
    >
      {photo ? (
        <div className="relative flex h-full w-full items-center justify-center bg-surface">
          {/* biome-ignore lint/performance/noImgElement: a local or stored listing photo, no image optimisation on purpose */}
          <img src={photo.url} alt="" className="max-h-full max-w-full object-contain" />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("sell.photos.viewerClose")}
            className="absolute end-sm top-sm flex h-10 w-10 items-center justify-center rounded-full bg-window hover:bg-pressed"
          >
            <X size={20} aria-hidden />
          </button>
          {index !== null && index > 0 ? (
            <button
              type="button"
              onClick={() => onIndex(index - 1)}
              aria-label={t("web.sell.photos.previous")}
              className="absolute start-sm flex h-10 w-10 items-center justify-center rounded-full bg-window hover:bg-pressed"
            >
              <ChevronLeft size={22} aria-hidden className="rtl:-scale-x-100" />
            </button>
          ) : null}
          {index !== null && index < photos.length - 1 ? (
            <button
              type="button"
              onClick={() => onIndex(index + 1)}
              aria-label={t("web.sell.photos.next")}
              className="absolute end-sm flex h-10 w-10 items-center justify-center rounded-full bg-window hover:bg-pressed"
            >
              <ChevronRight size={22} aria-hidden className="rtl:-scale-x-100" />
            </button>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * The photo area of the sell form: a drop area (click to choose files, or drop files onto it), then square tiles with
 * a remove cross, a Cover tag on the first photo, upload progress and a retry state. Drag a tile to reorder (the first
 * place is the cover), or use the move earlier and later buttons. A click on the picture opens it full size.
 */
export function PhotoUploader({
  photos,
  setPhotos,
  maxPhotos,
  error,
  onAdded,
  onChanged,
}: {
  photos: SellPhoto[];
  setPhotos: SetPhotos;
  maxPhotos: number;
  error?: string;
  /** Called when new photos were added (the form clears the photos error). */
  onAdded: () => void;
  /** Called on any change of the list (the form remembers it is unsaved). */
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const files = useRef(new Map<string, File>());
  const [viewing, setViewing] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | "area" | null>(null);
  const [announce, setAnnounce] = useState("");
  const remaining = maxPhotos - photos.length;

  const update = (id: string, patch: Partial<SellPhoto>) =>
    setPhotos((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  /** Shrinks then uploads one photo, keeping its tile up to date. */
  const send = async (id: string, file: File) => {
    try {
      const prepared = await prepareListingPhoto(file);
      update(id, { url: URL.createObjectURL(prepared.blob), width: prepared.width, height: prepared.height });
      const upload = await uploadListingPhoto(prepared, (progress) => update(id, { progress }));
      update(id, { key: upload.key, state: "done", progress: 1 });
      files.current.delete(id);
    } catch {
      update(id, { state: "failed" });
    }
  };

  const add = (list: FileList | File[]) => {
    const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
    const take = images.slice(0, Math.max(0, remaining));
    if (take.length === 0) return;
    const tiles: SellPhoto[] = take.map((file) => {
      const id = newPhotoId();
      files.current.set(id, file);
      return { id, url: URL.createObjectURL(file), width: 1, height: 1, state: "uploading", progress: 0 };
    });
    setPhotos((current) => [...current, ...tiles]);
    onAdded();
    onChanged();
    for (const tile of tiles) {
      const file = files.current.get(tile.id);
      if (file) void send(tile.id, file);
    }
  };

  const retry = (photo: SellPhoto) => {
    const file = files.current.get(photo.id);
    if (!file) return;
    update(photo.id, { state: "uploading", progress: 0 });
    void send(photo.id, file);
  };

  const remove = (id: string) => {
    files.current.delete(id);
    setPhotos((list) => list.filter((p) => p.id !== id));
    onChanged();
  };

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= photos.length) return;
    setPhotos((list) => movePhoto(list, from, to));
    onChanged();
    setAnnounce(t("web.sell.photos.moved", { n: to + 1, total: photos.length }));
  };

  const onDropFiles = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setOver(null);
    add(event.dataTransfer.files);
  };

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      multiple
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        if (e.target.files) add(e.target.files);
        e.target.value = "";
      }}
    />
  );
  const failed = photos.some((p) => p.state === "failed");

  return (
    <div className="flex flex-col gap-sm">
      {fileInput}
      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setOver("area");
            }
          }}
          onDragLeave={() => setOver(null)}
          onDrop={onDropFiles}
          aria-describedby={hintId}
          className={cn(
            "flex h-[156px] flex-col items-center justify-center gap-md rounded-window border-[1.5px] border-dashed bg-surface hover:bg-pressed",
            over === "area" ? "border-primary bg-pressed" : error ? "border-error" : "border-text-4",
          )}
        >
          <Camera size={28} aria-hidden className="text-text-3" />
          <span className="inline-flex h-10 items-center gap-xs rounded-control border border-primary px-lg text-body-sm font-semibold text-primary">
            <Plus size={16} aria-hidden />
            {t("sell.photos.upload")}
          </span>
          <span className="text-card-desc text-text-3">{t("web.sell.photos.dropHint")}</span>
        </button>
      ) : (
        <ul
          className="grid grid-cols-3 gap-sm sm:grid-cols-4"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDrop={onDropFiles}
        >
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              draggable={photo.state !== "uploading"}
              onDragStart={(e) => {
                setDragFrom(index);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", photo.id);
              }}
              onDragOver={(e) => {
                if (dragFrom !== null) {
                  e.preventDefault();
                  setOver(index);
                }
              }}
              onDrop={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                e.stopPropagation();
                move(dragFrom, index);
                setDragFrom(null);
                setOver(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setOver(null);
              }}
              className={cn(
                "group relative aspect-square min-w-0 overflow-hidden rounded-control border bg-pressed",
                photo.state === "failed" ? "border-error" : "border-border-subtle",
                over === index && dragFrom !== index && "outline outline-2 outline-primary",
                dragFrom === index && "opacity-50",
              )}
            >
              <button
                type="button"
                onClick={() => (photo.state === "failed" ? retry(photo) : setViewing(index))}
                aria-label={
                  photo.state === "failed"
                    ? t("sell.photos.retry")
                    : t("sell.photos.tileLabel", { n: index + 1, total: photos.length })
                }
                className="absolute inset-0"
              >
                {/* biome-ignore lint/performance/noImgElement: a local or stored listing photo, no image optimisation on purpose */}
                <img
                  src={photo.url}
                  alt=""
                  draggable={false}
                  className={cn("h-full w-full object-cover", photo.state !== "done" && "opacity-50")}
                />
                {photo.state === "failed" ? (
                  <span className="absolute inset-0 grid place-items-center">
                    <RotateCcw size={24} aria-hidden className="text-error" />
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => remove(photo.id)}
                aria-label={t("sell.photos.remove")}
                className="absolute end-xs top-xs flex h-6 w-6 items-center justify-center rounded-full bg-window hover:bg-pressed"
              >
                <X size={14} aria-hidden />
              </button>
              {index === 0 ? (
                <span className="pointer-events-none absolute bottom-xs start-xs rounded-full bg-window px-[6px] py-[2px] text-badge font-bold">
                  {t("sell.photos.main")}
                </span>
              ) : null}
              {photo.state === "uploading" ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-[6px]">
                  <div
                    role="progressbar"
                    aria-label={t("web.sell.photos.uploading")}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(photo.progress * 100)}
                    className="h-1 overflow-hidden rounded-full bg-window"
                  >
                    <div
                      className="h-1 bg-primary"
                      style={{ width: `${Math.round(photo.progress * 100)}%` }}
                    />
                  </div>
                </div>
              ) : null}
              <div className="absolute bottom-xs end-xs flex gap-xs opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                {index > 0 ? (
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    aria-label={t("web.sell.photos.moveEarlier", { n: index + 1 })}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-window hover:bg-pressed"
                  >
                    <ChevronLeft size={14} aria-hidden className="rtl:-scale-x-100" />
                  </button>
                ) : null}
                {index < photos.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    aria-label={t("web.sell.photos.moveLater", { n: index + 1 })}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-window hover:bg-pressed"
                  >
                    <ChevronRight size={14} aria-hidden className="rtl:-scale-x-100" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {remaining > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => input.current?.click()}
                aria-label={t("sell.photos.add")}
                className="flex aspect-square w-full items-center justify-center rounded-control border-[1.5px] border-dashed border-text-4 bg-surface hover:bg-pressed"
              >
                <Plus size={24} aria-hidden className="text-primary" />
              </button>
            </li>
          ) : null}
        </ul>
      )}
      <p
        id={hintId}
        role={error || failed ? "alert" : undefined}
        className={cn("text-card-desc", failed || error ? "text-error" : "text-text-3")}
      >
        {photos.length === 0
          ? (error ?? t("sell.photos.hint", { max: maxPhotos }))
          : failed
            ? t("web.sell.photos.failed")
            : (error ?? t("web.sell.photos.count", { count: photos.length, max: maxPhotos }))}
      </p>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <PhotoViewer photos={photos} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
    </div>
  );
}
