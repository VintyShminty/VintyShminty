"use client";

import { ADMIN_UPLOAD_STATUS_FILTERS } from "@vinty/shared";
import { Download, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/admin/toast";
import { inputClass, LoadFailed, Loading, primaryButton, quietButton } from "@/components/admin/ui";
import { formatIls } from "@/lib/admin-format";
import { fileNameFromDisposition } from "@/lib/admin-upload";
import {
  type UploadFilters,
  uploadFilterParams,
  useStandIns,
  useUploadedItems,
} from "@/lib/admin-upload-queries";
import { ApiClientError, errorFromResponse } from "@/lib/api-error";
import { formatDate } from "@/lib/time";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

const head = "whitespace-nowrap px-sm py-sm text-start font-semibold";
const cell = "px-sm py-sm text-start align-top text-text-1";

/** Every uploaded item with its private owner name, filters, and the Excel download (the same filters apply to the file). */
export function UploadedItems({ lang }: { lang: "en" | "he" }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const standIns = useStandIns();
  const [standInId, setStandInId] = useState("");
  const [ownerText, setOwnerText] = useState("");
  const [status, setStatus] = useState("all");
  const owner = useDebounced(ownerText.trim(), 300);
  const filters: UploadFilters = { standInId, owner, status };
  const query = useUploadedItems(filters);
  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const params = uploadFilterParams(filters);
      const res = await fetch(`/v1/admin/uploads/export.xlsx?${params}`, { credentials: "include" });
      if (!res.ok) throw await errorFromResponse(res);
      const blob = await res.blob();
      const name = fileNameFromDisposition(res.headers.get("Content-Disposition"), "yadii-uploads.xlsx");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast(t("admin.upload.items.downloaded", { name }));
    } catch (error) {
      toast(
        error instanceof ApiClientError && error.status === 403
          ? t("admin.errors.notAllowed")
          : t("admin.upload.items.downloadFailed"),
        "error",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section aria-labelledby="upload-items">
      <div className="mb-md flex flex-wrap items-end justify-between gap-md">
        <h2 id="upload-items" className="text-heading font-bold text-text-1">
          {t("admin.upload.items.title")}
        </h2>
        <button
          type="button"
          onClick={() => void download()}
          disabled={downloading}
          className={cn(primaryButton, "gap-sm")}
        >
          <Download size={16} aria-hidden />
          {t("admin.upload.items.download")}
        </button>
      </div>

      <div className="mb-lg grid gap-md sm:grid-cols-3">
        <label className="flex flex-col gap-xs">
          <span className="text-card-meta font-semibold text-text-3">{t("admin.upload.items.username")}</span>
          <select value={standInId} onChange={(e) => setStandInId(e.target.value)} className={inputClass}>
            <option value="">{t("admin.upload.items.allUsernames")}</option>
            {standIns.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.username}
              </option>
            ))}
          </select>
        </label>
        <label className="relative flex flex-col gap-xs">
          <span className="text-card-meta font-semibold text-text-3">{t("admin.upload.items.owner")}</span>
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute start-md top-[34px] text-text-3"
          />
          <input
            type="search"
            value={ownerText}
            onChange={(e) => setOwnerText(e.target.value)}
            dir="auto"
            className={cn(inputClass, "ps-[38px]")}
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-card-meta font-semibold text-text-3">{t("admin.upload.items.status")}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            {ADMIN_UPLOAD_STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {t(`admin.upload.items.statuses.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {query.data === undefined ? (
        query.isError ? (
          <LoadFailed onRetry={() => void query.refetch()} />
        ) : (
          <Loading />
        )
      ) : rows.length === 0 ? (
        <p className="py-2xl text-center text-body-sm text-text-3">{t("admin.upload.items.empty")}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-window border border-border">
            <table className="w-full min-w-[1000px] border-collapse text-body-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-text-3">
                  {[
                    "uploaded",
                    "owner",
                    "username",
                    "item",
                    "category",
                    "brand",
                    "size",
                    "price",
                    "status",
                    "soldOn",
                    "saleTotal",
                  ].map((key) => (
                    <th key={key} scope="col" className={head}>
                      {t(`admin.upload.items.col.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.listingId} className="border-b border-border last:border-b-0">
                    <td className={cn(cell, "whitespace-nowrap")}>
                      {formatDate(row.uploadedAt, i18n.language)}
                    </td>
                    <td className={cell} dir="auto">
                      {row.ownerFullName}
                    </td>
                    <td className={cell} dir="ltr">
                      {row.username}
                    </td>
                    <td className={cn(cell, "max-w-56")}>
                      <Link
                        href={`/${lang}/item/${row.listingId}`}
                        target="_blank"
                        dir="auto"
                        className="font-semibold underline"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className={cn(cell, "max-w-56 text-text-3")} dir="auto">
                      {row.categoryPath?.[lang] ?? ""}
                    </td>
                    <td className={cell} dir="auto">
                      {row.brand ?? ""}
                    </td>
                    <td className={cell}>{row.size ?? ""}</td>
                    <td className={cn(cell, "whitespace-nowrap tabular-nums")}>
                      {row.priceMinor === null ? "" : formatIls(row.priceMinor, i18n.language)}
                    </td>
                    <td className={cell}>{t(`admin.upload.items.statuses.${row.status}`)}</td>
                    <td className={cn(cell, "whitespace-nowrap")}>
                      {row.soldAt ? formatDate(row.soldAt, i18n.language) : ""}
                    </td>
                    <td className={cn(cell, "whitespace-nowrap tabular-nums")}>
                      {row.saleTotalMinor === null ? "" : formatIls(row.saleTotalMinor, i18n.language)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    </section>
  );
}
