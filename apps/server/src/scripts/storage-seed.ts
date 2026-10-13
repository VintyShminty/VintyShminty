import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createDb, listingPhotos, messages } from "@vinty/db";
import { isNotNull } from "drizzle-orm";
import { parseEnv } from "../env.js";

/**
 * Development only. Uploads the sample photos in packages/db/seed-assets to the dev bucket under the keys
 * the sample listings use (seed/listings/<n>/<file>.jpg), so the sample data shows real pictures.
 */
const env = parseEnv();
if (env.NODE_ENV !== "development") {
  console.error(`Refusing to run: NODE_ENV is "${env.NODE_ENV}", it must be "development".`);
  process.exit(1);
}
const assets = fileURLToPath(new URL("../../../../packages/db/seed-assets/", import.meta.url));
const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  requestChecksumCalculation: "WHEN_REQUIRED",
});
const database = createDb(env.DATABASE_URL);

try {
  await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET })).catch(() => {
    throw new Error(`Bucket "${env.S3_BUCKET}" not found at ${env.S3_ENDPOINT}. Run pnpm db:up first.`);
  });
  const rows = await database.db.select({ key: listingPhotos.objectKey }).from(listingPhotos);
  // Sample photo messages (seed/messages/<n>/<file>.jpg) use the same files.
  const messageRows = await database.db
    .select({ key: messages.attachmentKey })
    .from(messages)
    .where(isNotNull(messages.attachmentKey));
  const keys = [
    ...new Set([...rows.map((r) => r.key), ...messageRows.flatMap((r) => (r.key ? [r.key] : []))]),
  ];
  const cache = new Map<string, Buffer>();
  let uploaded = 0;
  for (const key of keys) {
    const file = basename(key);
    let body = cache.get(file);
    if (!body) {
      body = readFileSync(`${assets}${file}`);
      cache.set(file, body);
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    uploaded++;
  }
  console.log(`Uploaded ${uploaded} sample photos (listings and chats) to ${env.S3_PUBLIC_URL}`);
} finally {
  await database.close();
}
