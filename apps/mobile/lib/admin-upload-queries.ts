import { queryOptions } from "@tanstack/react-query";
import {
  type AdminPublishInput,
  adminPublishResultSchema,
  photoSuggestionSchema,
  standInsSchema,
  type UploadResponse,
  uploadResponseSchema,
} from "@vinty/shared";
import * as FileSystem from "expo-file-system/legacy";
import { api } from "@/lib/api";
import { type PickedPhoto, shrinkPhoto } from "@/lib/listing-photos";

// The batch upload talks to the admin routes. The server checks the admin role on every one of them.

export const standInsQuery = () =>
  queryOptions({
    queryKey: ["admin", "stand-ins"],
    queryFn: () => api("/v1/admin/stand-ins", { schema: standInsSchema }),
  });

/**
 * Shrinks one photo, asks for a signed address in the stand-in's own photo folder and sends it straight to storage
 * (the same steps as the website). Returns what the listing refers to.
 */
export async function uploadStandInPhoto(
  standInId: string,
  picked: PickedPhoto,
  onProgress: (fraction: number) => void,
): Promise<{ key: string; width: number; height: number }> {
  const small = await shrinkPhoto(picked);
  const info = await FileSystem.getInfoAsync(small.uri);
  const byteSize = info.exists ? info.size : 1;
  const upload = await api<UploadResponse>(`/v1/admin/stand-ins/${standInId}/uploads`, {
    method: "POST",
    body: { contentType: "image/jpeg", byteSize: Math.max(1, byteSize) },
    schema: uploadResponseSchema,
  });
  const task = FileSystem.createUploadTask(
    upload.uploadUrl,
    small.uri,
    {
      httpMethod: "PUT",
      headers: upload.headers,
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesExpectedToSend > 0) onProgress(totalBytesSent / totalBytesExpectedToSend);
    },
  );
  const put = await task.uploadAsync();
  if (!put || put.status < 200 || put.status >= 300) {
    throw new Error(`Upload failed (${put?.status ?? "no answer"})`);
  }
  onProgress(1);
  return { key: upload.key, width: small.width, height: small.height };
}

export const suggestForItem = (standInId: string, photoKeys: string[], language: "en" | "he") =>
  api(`/v1/admin/stand-ins/${standInId}/suggest`, {
    method: "POST",
    body: { photoKeys, language },
    schema: photoSuggestionSchema,
  });

export const publishItems = (standInId: string, body: AdminPublishInput) =>
  api(`/v1/admin/stand-ins/${standInId}/listings`, {
    method: "POST",
    body,
    schema: adminPublishResultSchema,
  });
