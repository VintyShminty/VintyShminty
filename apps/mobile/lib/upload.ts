import { type UploadResponse, uploadResponseSchema } from "@vinty/shared";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";

export type PickResult = { status: "picked"; uri: string } | { status: "cancelled" } | { status: "denied" };

/** Opens the photo library. The person crops to a square. */
export async function pickAvatar(): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: "denied" };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return { status: "cancelled" };
  return { status: "picked", uri: asset.uri };
}

/**
 * Shrinks the photo to 800 px (a phone photo can be 10 MB) and saves it as JPEG, then asks the server for a
 * signed address and sends the file straight to storage. Returns the key to save on the profile.
 */
export async function uploadAvatar(uri: string): Promise<UploadResponse> {
  const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 800 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const info = await FileSystem.getInfoAsync(small.uri);
  const byteSize = info.exists ? info.size : 0;
  const upload = await api<UploadResponse>("/v1/uploads", {
    method: "POST",
    body: {
      purpose: "avatar",
      contentType: "image/jpeg",
      byteSize,
      width: small.width,
      height: small.height,
    },
    schema: uploadResponseSchema,
  });
  // A native upload streams the file with the right headers. (fetch with a Blob body signs differently.)
  const put = await FileSystem.uploadAsync(upload.uploadUrl, small.uri, {
    httpMethod: "PUT",
    headers: upload.headers,
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  if (put.status < 200 || put.status >= 300) {
    throw new Error(`Upload failed (${put.status}) ${__DEV__ ? put.body : ""}`.trim());
  }
  return upload;
}
