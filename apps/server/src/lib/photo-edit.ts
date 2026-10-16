import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ApiError } from "./errors.js";
import { MAX_UPLOAD_BYTES, type Storage } from "./storage.js";

const unreadable = () =>
  ApiError.invalid("That photo could not be read", { key: "validation.listing.photos.invalid" });

/** Reads a stored listing photo, runs `edit` on it and saves the result under a new key in the same folder. */
async function editStoredPhoto(storage: Storage, key: string, edit: (original: Buffer) => Promise<Buffer>) {
  const original = await storage.read(key, MAX_UPLOAD_BYTES.listing_photo);
  if (!original) throw unreadable();
  let edited: Buffer;
  try {
    edited = await edit(original);
  } catch {
    throw unreadable();
  }
  // A stored file never changes (phones keep it for a year), so the edited picture gets a new key.
  const newKey = `${key.slice(0, key.lastIndexOf("/") + 1)}${randomUUID()}.jpg`;
  await storage.put(newKey, edited, "image/jpeg");
  return { key: newKey, publicUrl: storage.publicUrl(newKey) };
}

/** A quarter turn of a stored listing photo. */
export function rotateStoredPhoto(storage: Storage, key: string, direction: "cw" | "ccw") {
  return editStoredPhoto(storage, key, (original) =>
    // The first rotate() applies the camera's own orientation tag, the second is the quarter turn.
    sharp(original)
      .rotate()
      .rotate(direction === "cw" ? 90 : 270)
      .jpeg({ quality: 85 })
      .toBuffer(),
  );
}

/** Crops a stored listing photo to a rectangle given in fractions (0 to 1) of the photo as it is shown. */
export function cropStoredPhoto(
  storage: Storage,
  key: string,
  rect: { x: number; y: number; width: number; height: number },
) {
  return editStoredPhoto(storage, key, async (original) => {
    // Apply the camera's own orientation first, so the fractions mean what the seller saw.
    const upright = await sharp(original).rotate().toBuffer({ resolveWithObject: true });
    const { width: fullWidth, height: fullHeight } = upright.info;
    const left = Math.min(fullWidth - 1, Math.round(rect.x * fullWidth));
    const top = Math.min(fullHeight - 1, Math.round(rect.y * fullHeight));
    const width = Math.min(fullWidth - left, Math.max(1, Math.round(rect.width * fullWidth)));
    const height = Math.min(fullHeight - top, Math.max(1, Math.round(rect.height * fullHeight)));
    return sharp(upright.data).extract({ left, top, width, height }).jpeg({ quality: 85 }).toBuffer();
  });
}
