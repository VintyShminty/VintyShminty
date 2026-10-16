import {
  type RotatePhotoResponse,
  rotatePhotoResponseSchema,
  type UploadResponse,
  uploadResponseSchema,
} from "@vinty/shared";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";

/** Longest side of a listing photo after shrinking. Sharp on a phone, a fraction of the original size. */
const MAX_SIDE = 1600;

export type PickedPhoto = { uri: string; width: number; height: number };
export type PickPhotosResult =
  | { status: "picked"; photos: PickedPhoto[] }
  | { status: "cancelled" }
  | { status: "denied" };

/** Opens the photo library (several at once) or the camera. */
export async function pickListingPhotos(
  source: "library" | "camera",
  limit: number,
): Promise<PickPhotosResult> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: "denied" };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          selectionLimit: Math.max(1, limit),
          orderedSelection: true,
          quality: 1,
        });
  if (result.canceled || !result.assets?.length) return { status: "cancelled" };
  return {
    status: "picked",
    photos: result.assets.slice(0, limit).map((a) => ({ uri: a.uri, width: a.width, height: a.height })),
  };
}

/** Shrinks to at most 1600 px on the longest side and saves as JPEG at 80 percent. */
export async function shrinkPhoto(photo: PickedPhoto): Promise<PickedPhoto> {
  const landscape = photo.width >= photo.height;
  const longest = Math.max(photo.width, photo.height);
  const actions =
    longest > MAX_SIDE ? [{ resize: landscape ? { width: MAX_SIDE } : { height: MAX_SIDE } }] : [];
  const small = await ImageManipulator.manipulateAsync(photo.uri, actions, {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: small.uri, width: small.width, height: small.height };
}

/**
 * Asks the server for a signed address and sends the file straight to storage, reporting progress from 0 to 1.
 * Returns the key the listing refers to.
 */
export async function uploadListingPhoto(
  photo: PickedPhoto,
  onProgress: (fraction: number) => void,
  /** Chat photos use the same flow with their own folder. */
  purpose: "listing_photo" | "message_photo" = "listing_photo",
): Promise<UploadResponse> {
  const info = await FileSystem.getInfoAsync(photo.uri);
  const byteSize = info.exists ? info.size : 1;
  const upload = await api<UploadResponse>("/v1/uploads", {
    method: "POST",
    body: {
      purpose,
      contentType: "image/jpeg",
      byteSize: Math.max(1, byteSize),
      width: photo.width,
      height: photo.height,
    },
    schema: uploadResponseSchema,
  });
  const task = FileSystem.createUploadTask(
    upload.uploadUrl,
    photo.uri,
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
  return upload;
}

/** Turns a photo that is only on the phone a quarter turn, saved as JPEG like the shrunk copy. */
export async function rotateLocalPhoto(photo: PickedPhoto): Promise<PickedPhoto> {
  const turned = await ImageManipulator.manipulateAsync(photo.uri, [{ rotate: 90 }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: turned.uri, width: turned.width, height: turned.height };
}

/** Asks the server to turn a photo that is already uploaded. The answer is a new key, the listing must use it. */
export function rotateUploadedPhoto(key: string): Promise<RotatePhotoResponse> {
  return api<RotatePhotoResponse>("/v1/uploads/rotate", {
    method: "POST",
    body: { key, direction: "cw" },
    schema: rotatePhotoResponseSchema,
  });
}
