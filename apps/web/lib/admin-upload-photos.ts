"use client";

import { type UploadResponse, uploadResponseSchema } from "@vinty/shared";
import { clientApi } from "@/lib/api-client";

/** Phone photos are 4 to 12 MB. Shrunk to 2000 px on the long side and saved as JPEG at 85 percent they stay sharp and upload fast. */
const LONG_SIDE = 2000;
const QUALITY = 0.85;

/** Shrinks a picture for upload. Throws when this browser cannot read the file (for example a HEIC photo in Chrome). */
export async function prepareListingPhoto(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("Could not make a JPEG");
  return { blob, width, height };
}

/** Sends the file straight to storage and reports how far it is (0 to 1). fetch cannot report that, so this uses XMLHttpRequest. */
export function putWithProgress(
  upload: Pick<UploadResponse, "uploadUrl" | "headers">,
  blob: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", upload.uploadUrl);
    for (const [name, value] of Object.entries(upload.headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${request.status})`));
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(blob);
  });
}

/**
 * Prepares one photo and uploads it into the stand-in's own listing photo folder (POST /v1/admin/stand-ins/:id/uploads),
 * so the server's "these photos are yours" check passes for that username.
 */
export async function uploadStandInPhoto(
  standInId: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<{ key: string; width: number; height: number }> {
  const { blob, width, height } = await prepareListingPhoto(file);
  const upload = await clientApi(`/v1/admin/stand-ins/${standInId}/uploads`, {
    method: "POST",
    body: { contentType: "image/jpeg", byteSize: blob.size },
    schema: uploadResponseSchema,
  });
  await putWithProgress(upload, blob, onProgress);
  return { key: upload.key, width, height };
}
