import { randomUUID } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
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

/**
 * Stored photo keys are random and never overwritten, so a file at a key never changes. That makes it safe to tell
 * phones and the CDN to keep it for a year.
 */
export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

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
  /** The stored file's bytes, or null when it is not there or is bigger than `maxBytes`. */
  read(key: string, maxBytes: number): Promise<Buffer | null>;
  /** Stores a file (used for the small card copies) with the one year cache header. */
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Adds the one year cache header to a file that is already stored. Best effort, never throws. */
  markImmutable(key: string, contentType: string): Promise<void>;
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
        CacheControl: IMMUTABLE_CACHE,
      });
      const uploadUrl = await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds,
        // Only the content type is signed. Phones upload without a Content-Length (streamed), so the size
        // limit is checked afterwards with size() when the key is saved.
        // The cache header is signed too, the app sends back every header listed below.
        signableHeaders: new Set(["content-type", "cache-control"]),
      });
      return {
        key,
        uploadUrl,
        headers: { "Content-Type": contentType, "Cache-Control": IMMUTABLE_CACHE },
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
    async read(key, maxBytes) {
      try {
        const object = await client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
        if ((object.ContentLength ?? 0) > maxBytes || !object.Body) return null;
        return Buffer.from(await object.Body.transformToByteArray());
      } catch {
        return null;
      }
    },
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: IMMUTABLE_CACHE,
        }),
      );
    },
    async markImmutable(key, contentType) {
      try {
        await client.send(
          new CopyObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
            CopySource: `${env.S3_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`,
            MetadataDirective: "REPLACE",
            ContentType: contentType,
            CacheControl: IMMUTABLE_CACHE,
          }),
        );
      } catch {
        // Only a cache hint. The photo works without it.
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    },
  };
}
