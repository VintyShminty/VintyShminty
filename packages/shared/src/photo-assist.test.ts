import { describe, expect, it } from "vitest";
import {
  EMPTY_PHOTO_SUGGESTION,
  PHOTO_ASSIST_MAX_PHOTOS,
  photoAssistStatusSchema,
  photoSuggestionHasContent,
  photoSuggestionSchema,
  suggestRequestSchema,
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

  it("accepts the empty suggestion and nothing with more than 2 colours", () => {
    expect(photoSuggestionSchema.safeParse(EMPTY_PHOTO_SUGGESTION).success).toBe(true);
    expect(
      photoSuggestionSchema.safeParse({ ...EMPTY_PHOTO_SUGGESTION, colourIds: [id, id, id] }).success,
    ).toBe(false);
  });

  it("knows when a suggestion has something to show", () => {
    expect(photoSuggestionHasContent(EMPTY_PHOTO_SUGGESTION)).toBe(false);
    expect(photoSuggestionHasContent({ ...EMPTY_PHOTO_SUGGESTION, title: "Blue dress" })).toBe(true);
    // A brand we could not match is only text, the form cannot use it.
    expect(photoSuggestionHasContent({ ...EMPTY_PHOTO_SUGGESTION, brand: { id: null, name: "Zara" } })).toBe(
      false,
    );
  });

  it("reads the status flag", () => {
    expect(photoAssistStatusSchema.parse({ photoAssist: false })).toEqual({ photoAssist: false });
  });
});
