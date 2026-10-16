"use client";

import {
  type RotatePhotoResponse,
  rotatePhotoResponseSchema,
  type UploadResponse,
  uploadResponseSchema,
} from "@vinty/shared";
import { clientApi } from "@/lib/api-client";

/** The same as the app: 1600 px on the longest side at most, saved as JPEG at 80 percent. */
const MAX_SIDE = 1600;
const QUALITY = 0.8;

export type PreparedPhoto = { blob: Blob; width: number; height: number };

/** Shrinks a picture from the computer and saves it as JPEG. Throws when the browser cannot read the file. */
export async function prepareListingPhoto(file: File): Promise<PreparedPhoto> {
  // imageOrientation "from-image" keeps phone photos the right way up.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_SIDE ? MAX_SIDE / longest : 1;
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

/** A PUT with progress (fetch cannot report how much was sent). */
function putWithProgress(
  url: string,
  headers: Record<string, string>,
  body: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${request.status})`));
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(body);
  });
}

/**
 * Asks the server for a signed address (POST /v1/uploads, purpose listing_photo) and sends the shrunk picture straight
 * to storage with the headers the server named, reporting progress from 0 to 1. `key` of the answer goes on the listing.
 */
export async function uploadListingPhoto(
  photo: PreparedPhoto,
  onProgress: (fraction: number) => void,
): Promise<UploadResponse> {
  const upload = await clientApi("/v1/uploads", {
    method: "POST",
    body: {
      purpose: "listing_photo",
      contentType: "image/jpeg",
      byteSize: Math.max(1, photo.blob.size),
      width: photo.width,
      height: photo.height,
    },
    schema: uploadResponseSchema,
  });
  await putWithProgress(upload.uploadUrl, upload.headers, photo.blob, onProgress);
  onProgress(1);
  return upload;
}

/** Turns a picture that is only in the browser a quarter turn, saved as JPEG like the shrunk copy. */
export async function rotateLocalPhoto(url: string): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.height;
  canvas.height = bitmap.width;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.translate(canvas.width, 0);
  context.rotate(Math.PI / 2);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("Could not make a JPEG");
  return { blob, width: canvas.width, height: canvas.height };
}

/** Asks the server to turn a photo that is already uploaded. The answer is a new key, the listing must use it. */
export function rotateUploadedPhoto(key: string): Promise<RotatePhotoResponse> {
  return clientApi("/v1/uploads/rotate", {
    method: "POST",
    body: { key, direction: "cw" },
    schema: rotatePhotoResponseSchema,
  });
}
