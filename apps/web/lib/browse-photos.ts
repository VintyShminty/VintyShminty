import p01_dress from "@vinty/design/browse/01-dress.jpg";
import p05_jeans from "@vinty/design/browse/05-jeans.jpg";
import p06_jeans from "@vinty/design/browse/06-jeans.jpg";
import p08_sneakers from "@vinty/design/browse/08-sneakers.jpg";
import p09_sneakers from "@vinty/design/browse/09-sneakers.jpg";
import p14_handbag from "@vinty/design/browse/14-handbag.jpg";
import p15_handbag from "@vinty/design/browse/15-handbag.jpg";
import p16_sweater from "@vinty/design/browse/16-sweater.jpg";
import p18_sweater from "@vinty/design/browse/18-sweater.jpg";
import p19_t_shirt from "@vinty/design/browse/19-t-shirt.jpg";
import p20_t_shirt from "@vinty/design/browse/20-t-shirt.jpg";
import p22_coat from "@vinty/design/browse/22-coat.jpg";
import p24_coat from "@vinty/design/browse/24-coat.jpg";
import p26_boots from "@vinty/design/browse/26-boots.jpg";
import p28_skirt from "@vinty/design/browse/28-skirt.jpg";
import p31_shirt from "@vinty/design/browse/31-shirt.jpg";
import p32_kids_clothes from "@vinty/design/browse/32-kids-clothes.jpg";
import p33_watch from "@vinty/design/browse/33-watch.jpg";
import p37_headphones from "@vinty/design/browse/37-headphones.jpg";
import p39_books from "@vinty/design/browse/39-books.jpg";
import p41_vase from "@vinty/design/browse/41-vase.jpg";
import p45_camera from "@vinty/design/browse/45-camera.jpg";
import p47_hoodie from "@vinty/design/browse/47-hoodie.jpg";
import type { StaticImageData } from "next/image";

/** The Browse tile photos as static images, by the file name the shared tile list uses (`tile.photo`). */
const PHOTOS: Record<string, StaticImageData> = {
  "01-dress.jpg": p01_dress,
  "05-jeans.jpg": p05_jeans,
  "06-jeans.jpg": p06_jeans,
  "08-sneakers.jpg": p08_sneakers,
  "09-sneakers.jpg": p09_sneakers,
  "18-sweater.jpg": p18_sweater,
  "20-t-shirt.jpg": p20_t_shirt,
  "24-coat.jpg": p24_coat,
  "14-handbag.jpg": p14_handbag,
  "15-handbag.jpg": p15_handbag,
  "16-sweater.jpg": p16_sweater,
  "19-t-shirt.jpg": p19_t_shirt,
  "22-coat.jpg": p22_coat,
  "26-boots.jpg": p26_boots,
  "28-skirt.jpg": p28_skirt,
  "31-shirt.jpg": p31_shirt,
  "32-kids-clothes.jpg": p32_kids_clothes,
  "33-watch.jpg": p33_watch,
  "37-headphones.jpg": p37_headphones,
  "39-books.jpg": p39_books,
  "41-vase.jpg": p41_vase,
  "45-camera.jpg": p45_camera,
  "47-hoodie.jpg": p47_hoodie,
};

export function tilePhoto(file: string): StaticImageData | undefined {
  return PHOTOS[file];
}
