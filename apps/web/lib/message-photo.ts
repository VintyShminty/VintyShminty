"use client";

import { type UploadResponse, uploadResponseSchema } from "@vinty/shared";
import { clientApi } from "@/lib/api-client";

/** A chat photo is at most 1600 px on its long side, saved as JPEG at 80 percent (a phone photo can be 10 MB). */
const LONG_SIDE = 1600;
const QUALITY = 0.8;

export type PreparedPhoto = { blob: Blob; width: number; height: number };

/** Shrinks the picture and saves it as JPEG. Throws when the browser cannot read the file. */
export async function prepareMessagePhoto(file: Blob): Promise<PreparedPhoto> {
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

/**
 * Asks the server for a signed address (POST /v1/uploads, purpose message_photo) and sends the file straight to
 * storage with the headers the server named. `key` of the answer is what the message carries.
 */
export async function uploadMessagePhoto(photo: PreparedPhoto): Promise<UploadResponse> {
  const upload = await clientApi("/v1/uploads", {
    method: "POST",
    body: {
      purpose: "message_photo",
      contentType: "image/jpeg",
      byteSize: photo.blob.size,
      width: photo.width,
      height: photo.height,
    },
    schema: uploadResponseSchema,
  });
  const put = await fetch(upload.uploadUrl, { method: "PUT", headers: upload.headers, body: photo.blob });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return upload;
}
