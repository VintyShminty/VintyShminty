"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  type AdminUploadsPage,
  adminUploadsPageSchema,
  type ReferenceData,
  referenceDataSchema,
  type StandIns,
  standInsSchema,
} from "@vinty/shared";
import { adminKeys } from "@/lib/admin-keys";
import { clientApi } from "@/lib/api-client";

/** The categories, sizes, conditions and colours, the same list the app's sell form uses. Changes rarely, so it is kept for an hour. */
export const useReferenceData = () =>
  useQuery<ReferenceData>({
    queryKey: ["reference"],
    queryFn: () => clientApi("/v1/reference", { schema: referenceDataSchema }),
    staleTime: 3_600_000,
  });

export const useStandIns = () =>
  useQuery<StandIns>({
    queryKey: adminKeys.standIns,
    queryFn: () => clientApi("/v1/admin/stand-ins", { schema: standInsSchema }),
  });

export type UploadFilters = { standInId: string; owner: string; status: string };

/** The filters as a query string, the same one for the list and for the Excel file. */
export function uploadFilterParams(filters: UploadFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.standInId) params.set("standInId", filters.standInId);
  if (filters.owner) params.set("owner", filters.owner);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  return params;
}

export function useUploadedItems(filters: UploadFilters) {
  return useInfiniteQuery<
    AdminUploadsPage,
    Error,
    { pages: AdminUploadsPage[] },
    readonly unknown[],
    string | null
  >({
    queryKey: adminKeys.uploads(filters.standInId, filters.owner, filters.status),
    initialPageParam: null,
    queryFn: ({ pageParam }) => {
      const params = uploadFilterParams(filters);
      params.set("limit", "50");
      if (pageParam) params.set("cursor", pageParam);
      return clientApi(`/v1/admin/uploads?${params}`, { schema: adminUploadsPageSchema });
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}
