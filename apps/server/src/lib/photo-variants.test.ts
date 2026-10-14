import { isBlurhashValid } from "blurhash";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { fakeStorage } from "../test-helpers.js";
import { cardKeyFor, makePhotoVariants, storePhotoVariants } from "./photo-variants.js";
import type { Storage } from "./storage.js";

/** A noisy 1200 x 1600 JPEG, like a phone photo (noise keeps the file big, as a real photo is). */
async function samplePhoto(): Promise<Buffer> {
  return sharp({
    create: {
      width: 1200,
      height: 1600,
      channels: 3,
      background: "#808080",
      noise: { type: "gaussian", mean: 128, sigma: 40 },
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
}

describe("photo variants", () => {
  it("makes a card copy of about 480 px and a valid blurhash", async () => {
    const original = await samplePhoto();
    const made = await makePhotoVariants(original);
    const meta = await sharp(made.card).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(480);
    expect(meta.height).toBe(640);
    expect(made.card.length).toBeLessThan(original.length / 2);
    expect(isBlurhashValid(made.placeholder).result).toBe(true);
    expect(made.placeholder.length).toBeLessThanOrEqual(200);
  });

  it("never makes a photo bigger", async () => {
    const tiny = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#884422" } })
      .jpeg()
      .toBuffer();
    const made = await makePhotoVariants(tiny);
    expect((await sharp(made.card).metadata()).width).toBe(200);
  });

  it("gives the card copy a stable key", () => {
    expect(cardKeyFor("listings/u1/abc.jpg")).toBe("cards/listings/u1/abc.webp");
    expect(cardKeyFor("seed/listings/3/01-dress.jpg")).toBe("cards/seed/listings/3/01-dress.webp");
  });

  it("stores the copy, reports a missing original and an unreadable one", async () => {
    const puts: { key: string; type: string }[] = [];
    const marked: string[] = [];
    const storage = (bytes: Buffer | null): Storage => ({
      ...fakeStorage,
      read: async () => bytes,
      put: async (key, _body, type) => {
        puts.push({ key, type });
      },
      markImmutable: async (key) => {
        marked.push(key);
      },
    });

    const ok = await storePhotoVariants(storage(await samplePhoto()), "listings/u1/a.jpg");
    expect(ok).toMatchObject({ cardObjectKey: "cards/listings/u1/a.webp" });
    expect(puts).toEqual([{ key: "cards/listings/u1/a.webp", type: "image/webp" }]);
    expect(marked).toEqual(["listings/u1/a.jpg"]);

    expect(await storePhotoVariants(storage(null), "listings/u1/b.jpg")).toBeNull();
    expect(await storePhotoVariants(storage(Buffer.from("not an image")), "listings/u1/c.jpg")).toBe(
      "unreadable",
    );
    expect(puts).toHaveLength(1);
  });
});
