import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../env.js";

export const UPLOAD_PURPOSES = ["listing_photo", "avatar", "message_photo"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

/** Largest file per purpose, in bytes. */
export const MAX_UPLOAD_BYTES: Record<UploadPurpose, number> = {
  avatar: 5_000_000,
  listing_photo: 15_000_000,
  message_photo: 10_000_000,
};

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export type PresignedUpload = {
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: Date;
};

/** What the server needs from object storage. MinIO in development, Cloudflare R2 online (same S3 protocol). */
export interface Storage {
  presignUpload(input: {
    userId: string;
    purpose: UploadPurpose;
    contentType: string;
    byteSize: number;
  }): Promise<PresignedUpload>;
  /** Address the app loads a stored file from. */
  publicUrl(key: string): string;
  /** Size in bytes of a stored file, or null when it is not there. */
  size(key: string): Promise<number | null>;
  /** Best effort. A failure is logged by the caller, never shown to the user. */
  remove(key: string): Promise<void>;
}

const FOLDER: Record<UploadPurpose, string> = {
  avatar: "avatars",
  listing_photo: "listings",
  message_photo: "messages",
};

/** Folder rule: avatars/<userId>/<random>.jpg. Only the owner's folder is accepted back as an avatar key. */
export function keyBelongsToUser(key: string, purpose: UploadPurpose, userId: string): boolean {
  return key.startsWith(`${FOLDER[purpose]}/${userId}/`) && !key.includes("..");
}

export function createStorage(env: Env): Storage {
  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    // R2 and MinIO do not support the newer checksum headers that the SDK adds by default.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const base = env.S3_PUBLIC_URL.replace(/\/$/, "");
  const expiresInSeconds = 300;

  return {
    async presignUpload({ userId, purpose, contentType }) {
      const key = `${FOLDER[purpose]}/${userId}/${randomUUID()}.${EXTENSION[contentType] ?? "jpg"}`;
      const command = new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        ContentType: contentType,
      });
      const uploadUrl = await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds,
        // Only the content type is signed. Phones upload without a Content-Length (streamed), so the size
        // limit is checked afterwards with size() when the key is saved.
        signableHeaders: new Set(["content-type"]),
      });
      return {
        key,
        uploadUrl,
        headers: { "Content-Type": contentType },
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      };
    },
    publicUrl: (key) => `${base}/${key}`,
    async size(key) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
        return head.ContentLength ?? null;
      } catch {
        return null;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    },
  };
}
