import { describe, expect, it } from "vitest";
import {
  EMPTY_PHOTO_SUGGESTION,
  EMPTY_TEXT_SUGGESTION,
  mergeGuesses,
  PHOTO_ASSIST_MAX_PHOTOS,
  photoAssistStatusSchema,
  photoCheckSchema,
  photoSuggestionHasContent,
  photoSuggestionSchema,
  suggestRequestSchema,
  textSuggestRequestSchema,
} from "./photo-assist.js";

const id = "0b5f3c9e-6d2a-4f6e-9b1c-3a7d5e8f1a2b";

describe("photo helper schemas", () => {
  it("asks for 1 to 4 photo keys and a language", () => {
    expect(suggestRequestSchema.safeParse({ photoKeys: ["a"], language: "he" }).success).toBe(true);
    expect(suggestRequestSchema.safeParse({ photoKeys: [], language: "en" }).success).toBe(false);
    const tooMany = Array.from({ length: PHOTO_ASSIST_MAX_PHOTOS + 1 }, (_, i) => `k${i}`);
    expect(suggestRequestSchema.safeParse({ photoKeys: tooMany, language: "en" }).success).toBe(false);
    expect(suggestRequestSchema.safeParse({ photoKeys: ["a"], language: "fr" }).success).toBe(false);
  });

  it("accepts the empty suggestion, at most 3 categories and at most 2 colours", () => {
    const four = Array.from({ length: 4 }, () => ({ id, confidence: 0.5 }));
    expect(photoSuggestionSchema.safeParse({ ...EMPTY_PHOTO_SUGGESTION, categories: four }).success).toBe(
      false,
    );
    expect(photoSuggestionSchema.safeParse(EMPTY_PHOTO_SUGGESTION).success).toBe(true);
    expect(
      photoSuggestionSchema.safeParse({ ...EMPTY_PHOTO_SUGGESTION, colourIds: [id, id, id] }).success,
    ).toBe(false);
  });

  it("knows when a suggestion has something to show", () => {
    expect(photoSuggestionHasContent(EMPTY_PHOTO_SUGGESTION)).toBe(false);
    expect(photoSuggestionHasContent({ ...EMPTY_PHOTO_SUGGESTION, title: "Blue dress" })).toBe(false);
    expect(photoSuggestionHasContent({ ...EMPTY_PHOTO_SUGGESTION, brand: { id: null, name: "Zara" } })).toBe(
      true,
    );
    expect(
      photoSuggestionHasContent({ ...EMPTY_PHOTO_SUGGESTION, categories: [{ id, confidence: 0.5 }] }),
    ).toBe(true);
  });

  it("reads the status flag", () => {
    expect(photoAssistStatusSchema.parse({ photoAssist: false })).toEqual({ photoAssist: false });
  });

  it("reads a status from an older server without textAssist", () => {
    expect(photoAssistStatusSchema.parse({ photoAssist: true })).toEqual({ photoAssist: true });
    expect(photoAssistStatusSchema.parse({ photoAssist: true, textAssist: true }).textAssist).toBe(true);
  });

  it("asks for a little text before reading words", () => {
    expect(textSuggestRequestSchema.safeParse({ title: "Nike", language: "he" }).success).toBe(true);
    expect(
      textSuggestRequestSchema.safeParse({ title: " a ", description: "", language: "en" }).success,
    ).toBe(false);
  });

  it("only accepts known photo tip kinds", () => {
    expect(photoCheckSchema.safeParse({ photoTips: [{ key: "k", kinds: ["dark"] }] }).success).toBe(true);
    expect(photoCheckSchema.safeParse({ photoTips: [{ key: "k", kinds: ["blurry"] }] }).success).toBe(false);
    expect(photoCheckSchema.safeParse({ photoTips: [{ key: "k", kinds: [] }] }).success).toBe(false);
  });
});

describe("mergeGuesses", () => {
  const a = "0b5f3c9e-6d2a-4f6e-9b1c-3a7d5e8f1a2a";
  const b = "0b5f3c9e-6d2a-4f6e-9b1c-3a7d5e8f1a2b";
  const c = "0b5f3c9e-6d2a-4f6e-9b1c-3a7d5e8f1a2c";
  const d = "0b5f3c9e-6d2a-4f6e-9b1c-3a7d5e8f1a2d";
  const cat = (id: string) => ({ id, confidence: 0.5 });

  it("is null with nothing, and passes either side through alone", () => {
    expect(mergeGuesses(null, null)).toBeNull();
    const photoOnly = mergeGuesses({ ...EMPTY_PHOTO_SUGGESTION, brand: { id: null, name: "Zara" } }, null);
    expect(photoOnly?.brandSource).toBe("tag");
    expect(photoOnly?.conditionId).toBeNull();
    const textOnly = mergeGuesses(null, { ...EMPTY_TEXT_SUGGESTION, conditionId: a });
    expect(textOnly?.conditionId).toBe(a);
    expect(textOnly?.photoTips).toEqual([]);
  });

  it("puts a category both agree on first, then the words, then the photos, at most 3", () => {
    const merged = mergeGuesses(
      { ...EMPTY_PHOTO_SUGGESTION, categories: [cat(a), cat(b)] },
      { ...EMPTY_TEXT_SUGGESTION, categories: [cat(c), cat(b), cat(d)] },
    );
    expect(merged?.categories.map((x) => x.id)).toEqual([b, c, d]);
  });

  it("takes the brand from the words and the colours from the photos", () => {
    const merged = mergeGuesses(
      { ...EMPTY_PHOTO_SUGGESTION, brand: { id: null, name: "ZARA BASIC" }, colourIds: [a] },
      { ...EMPTY_TEXT_SUGGESTION, brand: { id: b, name: "Nike" }, colourIds: [c] },
    );
    expect(merged?.brand).toEqual({ id: b, name: "Nike" });
    expect(merged?.brandSource).toBe("text");
    expect(merged?.colourIds).toEqual([a]);
    expect(
      mergeGuesses(EMPTY_PHOTO_SUGGESTION, { ...EMPTY_TEXT_SUGGESTION, colourIds: [c] })?.colourIds,
    ).toEqual([c]);
  });
});
