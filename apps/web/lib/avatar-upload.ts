"use client";

import { type UploadResponse, uploadResponseSchema } from "@vinty/shared";
import { clientApi } from "@/lib/api-client";

/** The same size as the app: a square, 800 px at most, saved as JPEG at 80 percent (a phone photo can be 10 MB). */
const SIDE = 800;
const QUALITY = 0.8;

/** Crops the picture to a square from the middle, shrinks it and saves it as JPEG. Throws when the browser cannot read the file. */
export async function prepareAvatar(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(SIDE, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("Could not make a JPEG");
  return { blob, width: size, height: size };
}

/**
 * Prepares the picture, asks the server for a signed address (POST /v1/uploads, purpose avatar) and sends the file
 * straight to storage with the headers the server named. Returns the answer: `key` is what to save on the profile.
 * The browser sending to storage needs the bucket to allow our website's address (a CORS rule, see docs/going-online.md).
 */
export async function uploadAvatar(file: File): Promise<{ upload: UploadResponse; previewUrl: string }> {
  const { blob, width, height } = await prepareAvatar(file);
  const upload = await clientApi("/v1/uploads", {
    method: "POST",
    body: { purpose: "avatar", contentType: "image/jpeg", byteSize: blob.size, width, height },
    schema: uploadResponseSchema,
  });
  const put = await fetch(upload.uploadUrl, { method: "PUT", headers: upload.headers, body: blob });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return { upload, previewUrl: URL.createObjectURL(blob) };
}
