import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Pixel size of each sample JPEG in packages/db/seed-assets (all 600 px wide). Photo credits are in CREDITS.md. */
export const photoSizes: Record<string, [number, number]> = {
  "01-dress": [600, 721],
  "02-dress": [600, 903],
  "03-dress": [600, 800],
  "04-jeans": [600, 900],
  "05-jeans": [600, 900],
  "06-jeans": [600, 900],
  "07-sneakers": [600, 750],
  "08-sneakers": [600, 900],
  "09-sneakers": [600, 750],
  "10-jacket": [600, 800],
  "11-jacket": [600, 945],
  "12-jacket": [600, 916],
  "13-handbag": [600, 752],
  "14-handbag": [600, 800],
  "15-handbag": [600, 800],
  "16-sweater": [600, 750],
  "17-sweater": [600, 861],
  "18-sweater": [600, 900],
  "19-t-shirt": [600, 900],
  "20-t-shirt": [600, 1067],
  "21-t-shirt": [600, 840],
  "22-coat": [600, 900],
  "23-coat": [600, 900],
  "24-coat": [600, 900],
  "25-boots": [600, 750],
  "26-boots": [600, 840],
  "27-boots": [600, 800],
  "28-skirt": [600, 900],
  "29-skirt": [600, 900],
  "30-skirt": [600, 900],
  "31-kids-clothes": [600, 800],
  "32-kids-clothes": [600, 1160],
  "33-watch": [600, 899],
  "34-watch": [600, 750],
  "35-sunglasses": [600, 917],
  "36-sunglasses": [600, 900],
  "37-headphones": [600, 899],
  "38-headphones": [600, 800],
  "39-books": [600, 900],
  "40-books": [600, 899],
  "41-vase": [600, 900],
  "42-vase": [600, 900],
  "43-lamp": [600, 800],
  "44-lamp": [600, 900],
  "45-camera": [600, 900],
  "46-camera": [600, 750],
  "47-hoodie": [600, 884],
  "48-hoodie": [600, 900],
};

export const seedAssetsDir = fileURLToPath(new URL("../../../seed-assets/", import.meta.url));

export function assertAssetsExist(): void {
  const missing = Object.keys(photoSizes).filter((name) => !existsSync(`${seedAssetsDir}${name}.jpg`));
  if (missing.length > 0)
    throw new Error(`Missing sample photos in packages/db/seed-assets: ${missing.join(", ")}`);
}
