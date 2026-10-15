import en from "@vinty/locales/en.json";
import he from "@vinty/locales/he.json";
import type { PhotoSuggestion, ReferenceData } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import {
  chunk,
  fileNameFromDisposition,
  imageFilesOf,
  leafOptions,
  newRow,
  rowIsReady,
  rowProblems,
  searchLeaves,
  sizeOptionsFor,
  toPublishItem,
  type UploadPhoto,
  type UploadRow,
  uploadReducer,
  wantsSuggestion,
} from "../lib/admin-upload";

const rules = (over: Record<string, string> = {}) => ({
  brand: "optional",
  size: "required",
  condition: "required",
  colour: "required",
  material: "hidden",
  pattern: "hidden",
  ...over,
});
const dress = {
  id: "c-dress",
  slug: "women-dresses",
  path: "women/dresses",
  name: { en: "Dresses", he: "שמלות" },
  icon: null,
  isLeaf: true,
  rules: rules(),
  sizeGroupIds: ["g-clothes"],
  defaultParcelSizeId: "p-small",
  children: [],
};
const bag = {
  ...dress,
  id: "c-bag",
  name: { en: "Bags", he: "תיקים" },
  rules: rules({ size: "hidden" }),
  sizeGroupIds: [],
};
const reference = {
  categories: [
    {
      ...dress,
      id: "c-women",
      name: { en: "Women", he: "נשים" },
      isLeaf: false,
      sizeGroupIds: [],
      children: [dress, bag],
    },
  ],
  sizeGroups: [
    {
      id: "g-clothes",
      slug: "clothes",
      name: { en: "Clothes", he: "בגדים" },
      kind: "clothing",
      sizes: [
        { id: "s-m", slug: "m", label: "M", name: { en: "M", he: "M" } },
        { id: "s-l", slug: "l", label: "L", name: { en: "L", he: "L" } },
      ],
    },
    {
      id: "g-shoes",
      slug: "shoes",
      name: { en: "Shoes", he: "נעליים" },
      kind: "shoes",
      sizes: [{ id: "s-40", slug: "40", label: "40", name: { en: "40", he: "40" } }],
    },
  ],
  conditions: [
    { id: "k-good", slug: "good", name: { en: "Good", he: "טוב" }, description: { en: "", he: "" }, rank: 1 },
  ],
  colours: [{ id: "col-red", slug: "red", name: { en: "Red", he: "אדום" }, swatchHex: "x" }],
  materials: [],
  patterns: [],
  parcelSizes: [{ id: "p-small", slug: "small", name: { en: "Small", he: "קטן" } }],
  settings: { listing_max_photos: 5, listing_min_price_minor: 100 },
} as unknown as ReferenceData;

const done = (n: number): UploadPhoto => ({
  id: `p${n}`,
  name: `${n}.jpg`,
  previewUrl: "blob:x",
  status: "done",
  progress: 1,
  key: `listings/u/${n}.jpg`,
  width: 800,
  height: 1000,
});
const filled = (over: Partial<UploadRow> = {}): UploadRow => ({
  ...newRow([done(1)]),
  title: "Linen dress",
  categoryId: "c-dress",
  sizeId: "s-m",
  conditionId: "k-good",
  colourIds: ["col-red"],
  priceText: "45",
  ...over,
});

describe("upload rows: what makes one complete", () => {
  it("is complete with every required row filled", () => {
    expect(rowProblems(filled(), reference).any).toBe(false);
    expect(rowIsReady(filled(), reference)).toBe(true);
  });

  it("names what is missing, from the shared listing rules", () => {
    const problems = rowProblems(filled({ title: "", priceText: "", sizeId: null }), reference);
    expect(Object.keys(problems.fields).sort()).toEqual(["priceMinor", "sizeId", "title"]);
    expect(problems.fields.title).toBe("validation.listing.title.required");
  });

  it("waits for photos that are still uploading and flags failed ones", () => {
    const uploading = filled({ photos: [{ ...done(1), status: "uploading" }] });
    expect(rowProblems(uploading, reference).photos).toBe("uploading");
    const failed = filled({ photos: [done(1), { ...done(2), status: "error" }] });
    expect(rowProblems(failed, reference).photos).toBe("failed");
    expect(rowIsReady(failed, reference)).toBe(false);
  });

  it("does not ask for what the category hides", () => {
    const row = filled({ categoryId: "c-bag", sizeId: null });
    expect(rowProblems(row, reference).fields.sizeId).toBeUndefined();
  });

  it("counts a price that is not a number as missing, and a price below the minimum", () => {
    expect(rowProblems(filled({ priceText: "abc" }), reference).fields.priceMinor).toBeDefined();
    expect(rowProblems(filled({ priceText: "0.5" }), reference).fields.priceMinor).toBe(
      "validation.listing.price.tooLow",
    );
  });

  it("flags a different owner name that is too short", () => {
    expect(rowProblems(filled({ ownerOverride: "A" }), reference).owner).toBe(true);
    expect(rowProblems(filled({ ownerOverride: "Dana Levi" }), reference).owner).toBe(false);
  });

  it("is not ready once published or while publishing", () => {
    expect(rowIsReady(filled({ state: "published" }), reference)).toBe(false);
    expect(rowIsReady(filled({ state: "publishing" }), reference)).toBe(false);
  });
});

describe("upload rows: what is sent", () => {
  it("builds the item the server wants", () => {
    const item = toPublishItem(filled({ brandText: "Zara", ownerOverride: " Dana Levi " }), reference);
    expect(item).toMatchObject({
      title: "Linen dress",
      categoryId: "c-dress",
      brandId: null,
      brandName: "Zara",
      sizeId: "s-m",
      priceMinor: 4500,
      parcelSizeId: "p-small",
      ownerFullName: "Dana Levi",
      colourIds: ["col-red"],
    });
    expect(item.photos).toEqual([
      { key: "listings/u/1.jpg", width: 800, height: 1000, contentType: "image/jpeg" },
    ]);
  });

  it("sends a listed brand by id and no typed name", () => {
    const item = toPublishItem(filled({ brandId: "b-1", brandText: "Zara" }), reference);
    expect(item.brandId).toBe("b-1");
    expect(item.brandName).toBeNull();
  });

  it("splits a pile into chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 50)).toEqual([]);
  });
});

describe("categories and sizes", () => {
  it("lists leaf categories with their path and finds them in either language", () => {
    const options = leafOptions(reference, "en");
    expect(options.map((o) => o.path)).toEqual(["Women > Dresses", "Women > Bags"]);
    expect(searchLeaves(options, "dress").map((o) => o.id)).toEqual(["c-dress"]);
    expect(searchLeaves(options, "תיקים").map((o) => o.id)).toEqual(["c-bag"]);
    expect(searchLeaves(options, "women bag").map((o) => o.id)).toEqual(["c-bag"]);
    expect(leafOptions(reference, "he")[0]?.path).toBe("נשים > שמלות");
  });

  it("offers only the sizes of the category's groups", () => {
    expect(sizeOptionsFor(reference, dress as never).map((s) => s.label)).toEqual(["M", "L"]);
    expect(sizeOptionsFor(reference, bag as never)).toEqual([]);
    expect(sizeOptionsFor(reference, null)).toEqual([]);
  });

  it("clears a size the new category does not accept", () => {
    const row = filled();
    const [next] = uploadReducer([row], {
      type: "edit",
      rowId: row.id,
      patch: { categoryId: "c-bag" },
      reference,
    });
    expect(next?.sizeId).toBeNull();
    const [same] = uploadReducer([row], {
      type: "edit",
      rowId: row.id,
      patch: { title: "Other" },
      reference,
    });
    expect(same?.sizeId).toBe("s-m");
  });
});

describe("the AI suggestion", () => {
  const suggestion: PhotoSuggestion = {
    categories: [
      { id: "c-dress", confidence: 0.9 },
      { id: "c-bag", confidence: 0.2 },
    ],
    brand: { id: "b-1", name: "Zara" },
    colourIds: ["col-red"],
    materialId: null,
    title: null,
    description: null,
    photoTips: [],
  };

  it("fills empty fields and marks them as suggestions", () => {
    const row = newRow([done(1)]);
    const [next] = uploadReducer([row], { type: "suggested", rowId: row.id, suggestion, reference });
    expect(next).toMatchObject({
      categoryId: "c-dress",
      brandId: "b-1",
      brandText: "Zara",
      colourIds: ["col-red"],
      suggested: { category: true, brand: true, colours: true },
      suggestion: { state: "done" },
    });
  });

  it("never overwrites what was typed", () => {
    const row = { ...newRow([done(1)]), categoryId: "c-bag", brandText: "Mine", colourIds: ["x"] };
    const [next] = uploadReducer([row], { type: "suggested", rowId: row.id, suggestion, reference });
    expect(next).toMatchObject({ categoryId: "c-bag", brandText: "Mine", colourIds: ["x"] });
    expect(next?.suggested).toEqual({ category: false, brand: false, colours: false });
  });

  it("takes the mark away when the field is edited", () => {
    const row = newRow([done(1)]);
    const [suggested] = uploadReducer([row], { type: "suggested", rowId: row.id, suggestion, reference });
    const [edited] = uploadReducer([suggested as UploadRow], {
      type: "edit",
      rowId: row.id,
      patch: { categoryId: "c-bag" },
      reference,
    });
    expect(edited?.suggested.category).toBe(false);
    expect(edited?.suggested.brand).toBe(true);
  });

  it("an empty answer is 'none' and never asked twice", () => {
    const row = newRow([done(1)]);
    const empty = {
      categories: [],
      brand: null,
      colourIds: [],
      materialId: null,
      title: null,
      description: null,
      photoTips: [],
    };
    const [next] = uploadReducer([row], { type: "suggested", rowId: row.id, suggestion: empty, reference });
    expect(next?.suggestion.state).toBe("none");
    expect(wantsSuggestion(next as UploadRow)).toBe(false);
    expect(wantsSuggestion(row)).toBe(true);
    expect(wantsSuggestion({ ...row, photos: [{ ...done(1), status: "uploading" }] })).toBe(false);
  });
});

describe("the table", () => {
  it("removing the last photo removes the row, removing another keeps it", () => {
    const row = newRow([done(1), done(2)]);
    const one = uploadReducer([row], { type: "removePhoto", rowId: row.id, photoId: "p1" });
    expect(one[0]?.photos).toHaveLength(1);
    expect(uploadReducer(one, { type: "removePhoto", rowId: row.id, photoId: "p2" })).toEqual([]);
  });

  it("marks published rows, keeps failed ones with the reason, and clears the published", () => {
    const a = filled();
    const b = filled();
    const rows = uploadReducer([a, b], {
      type: "results",
      result: {
        batchId: "b",
        username: "u",
        createdCount: 1,
        failedCount: 1,
        results: [
          { index: 0, clientId: a.id, ok: true, listingId: "l-1", error: null, fields: null },
          { index: 1, clientId: b.id, ok: false, listingId: null, error: "Nope", fields: { title: "x" } },
        ],
      },
    });
    expect(rows[0]).toMatchObject({ state: "published", listingId: "l-1" });
    expect(rows[1]).toMatchObject({ state: "failed", error: "Nope", failedFields: { title: "x" } });
    expect(uploadReducer(rows, { type: "clearPublished" })).toHaveLength(1);
    // Editing a failed row lets it be published again.
    const again = uploadReducer(rows, { type: "edit", rowId: b.id, patch: { title: "New" }, reference });
    expect(again[1]).toMatchObject({ state: "draft", error: null });
  });
});

describe("files", () => {
  it("keeps pictures only", () => {
    const files = [
      new File([""], "a.jpg", { type: "image/jpeg" }),
      new File([""], "b.txt", { type: "text/plain" }),
      new File([""], "c.HEIC", { type: "" }),
    ];
    expect(imageFilesOf(files).map((f) => f.name)).toEqual(["a.jpg", "c.HEIC"]);
  });

  it("reads the file name of the download", () => {
    expect(fileNameFromDisposition('attachment; filename="yadii-uploads-2026-10-14.xlsx"', "x.xlsx")).toBe(
      "yadii-uploads-2026-10-14.xlsx",
    );
    expect(fileNameFromDisposition(null, "x.xlsx")).toBe("x.xlsx");
  });
});

describe("listing upload wording", () => {
  const leaves = (node: unknown, path = ""): [string, string][] =>
    node && typeof node === "object"
      ? Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
      : [[path, String(node)]];
  // Hebrew has one more plural form ("two"), so plural suffixes are compared by their base name.
  const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, "");

  it("has the same keys in both languages", () => {
    const names = (lang: unknown) =>
      new Set(leaves((lang as { admin: { upload: unknown } }).admin.upload).map(([key]) => base(key)));
    expect(names(he)).toEqual(names(en));
  });

  it("writes no em dashes, en dashes or semicolons", () => {
    for (const [, text] of [...leaves(en.admin.upload), ...leaves(he.admin.upload)]) {
      expect(text).not.toMatch(/[—–;]/);
    }
  });

  it("has a name for the page and the AI line", () => {
    expect(en.admin.nav.upload).toBeTruthy();
    expect(he.admin.nav.upload).toBeTruthy();
    expect(en.admin.aiActions.admin_upload_photo_check).toBe("Photo helper (listing upload)");
    expect(he.admin.aiActions.admin_upload_photo_check).toBeTruthy();
  });
});
