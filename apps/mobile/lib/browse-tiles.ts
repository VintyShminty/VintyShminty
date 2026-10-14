import {
  BROWSE_MORE_TILES,
  BROWSE_TILES,
  findBrowseTile,
  groupOfSlug,
  type BrowseTile as SharedTile,
  TILE_GROUPS,
  type TileGroup,
  tileCategoryIds,
  tileGroups,
} from "@vinty/shared";
import type { ImageSourcePropType } from "react-native";

// The tile data (keys, categories, order) lives in packages/shared/src/browse-tiles.ts, shared with the website.
// The app only adds the pictures: the photo files are in packages/design/browse and ship inside the app,
// so they always show, online or not. Metro needs every require() written out.
const PHOTOS: Record<string, ImageSourcePropType> = {
  "01-dress.jpg": require("@vinty/design/browse/01-dress.jpg"),
  "05-jeans.jpg": require("@vinty/design/browse/05-jeans.jpg"),
  "06-jeans.jpg": require("@vinty/design/browse/06-jeans.jpg"),
  "08-sneakers.jpg": require("@vinty/design/browse/08-sneakers.jpg"),
  "14-handbag.jpg": require("@vinty/design/browse/14-handbag.jpg"),
  "15-handbag.jpg": require("@vinty/design/browse/15-handbag.jpg"),
  "16-sweater.jpg": require("@vinty/design/browse/16-sweater.jpg"),
  "19-t-shirt.jpg": require("@vinty/design/browse/19-t-shirt.jpg"),
  "22-coat.jpg": require("@vinty/design/browse/22-coat.jpg"),
  "26-boots.jpg": require("@vinty/design/browse/26-boots.jpg"),
  "28-skirt.jpg": require("@vinty/design/browse/28-skirt.jpg"),
  "31-shirt.jpg": require("@vinty/design/browse/31-shirt.jpg"),
  "32-kids-clothes.jpg": require("@vinty/design/browse/32-kids-clothes.jpg"),
  "33-watch.jpg": require("@vinty/design/browse/33-watch.jpg"),
  "37-headphones.jpg": require("@vinty/design/browse/37-headphones.jpg"),
  "39-books.jpg": require("@vinty/design/browse/39-books.jpg"),
  "41-vase.jpg": require("@vinty/design/browse/41-vase.jpg"),
  "45-camera.jpg": require("@vinty/design/browse/45-camera.jpg"),
  "47-hoodie.jpg": require("@vinty/design/browse/47-hoodie.jpg"),
};

export type BrowseTile = Omit<SharedTile, "photo"> & { photo: ImageSourcePropType };

const withPhoto = (tile: SharedTile): BrowseTile => ({
  ...tile,
  photo: PHOTOS[tile.photo] as ImageSourcePropType,
});

export const TILES: BrowseTile[] = BROWSE_TILES.map(withPhoto);
/** Behind the "More" tile. */
export const MORE_TILES: BrowseTile[] = BROWSE_MORE_TILES.map(withPhoto);

export const findTile = (key: string | undefined) => [...TILES, ...MORE_TILES].find((t) => t.key === key);

export type { TileGroup };
export { findBrowseTile, groupOfSlug, TILE_GROUPS, tileCategoryIds, tileGroups };
