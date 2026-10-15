import en from "@vinty/locales/en.json";
import he from "@vinty/locales/he.json";
import { REVIEW_ACTIONS } from "@vinty/shared";
import { describe, expect, it } from "vitest";
import {
  CONFIRM_BODY,
  cleanNote,
  reviewActionsFor,
  sellerHref,
  URGENCY_CLASS,
  urgencyTone,
} from "../lib/admin-review";

const listing = {
  kind: "listing",
  id: "l1",
  title: "Dress",
  status: "active",
  photoUrl: null,
  priceMinor: 4500,
  currency: "ILS",
  seller: { id: "u1", username: "tamar" },
} as const;

describe("admin review buttons", () => {
  it("offers hide and remove only for a listing that still exists", () => {
    expect(reviewActionsFor({ status: "open", target: listing })).toEqual([
      "hide_listing",
      "remove_listing",
      "dismiss",
      "handled",
    ]);
    expect(reviewActionsFor({ status: "open", target: { kind: "user", id: "u1", username: "a" } })).toEqual([
      "dismiss",
      "handled",
    ]);
    expect(reviewActionsFor({ status: "open", target: null })).toEqual(["dismiss", "handled"]);
  });

  it("offers refund and release only for a disputed order", () => {
    const order = {
      kind: "order",
      id: "o1",
      listingId: "l1",
      status: "disputed",
      listingTitle: "Dress",
      photoUrl: null,
      totalMinor: 4500,
      currency: "ILS",
      buyer: { id: "u2", username: "noa" },
      seller: { id: "u1", username: "tamar" },
      problemNote: null,
    } as const;
    expect(reviewActionsFor({ status: "open", target: order })).toEqual([
      "refund_buyer",
      "release_seller",
      "dismiss",
      "handled",
    ]);
    expect(reviewActionsFor({ status: "open", target: { ...order, status: "refunded" } })).toEqual([
      "dismiss",
      "handled",
    ]);
    expect(reviewActionsFor({ status: "dismissed", target: order })).toEqual([]);
  });

  it("asks before refunding or releasing, with wording in both languages", () => {
    for (const key of [CONFIRM_BODY.refund_buyer, CONFIRM_BODY.release_seller]) {
      for (const lang of [en, he]) {
        const found = (key ?? "")
          .split(".")
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], lang);
        expect(found).toBeTruthy();
      }
    }
  });

  it("offers nothing once handled", () => {
    expect(reviewActionsFor({ status: "actioned", target: listing })).toEqual([]);
    expect(reviewActionsFor({ status: "dismissed", target: null })).toEqual([]);
  });
});

describe("admin review helpers", () => {
  it("gives an unsorted item its own look", () => {
    expect(urgencyTone(null)).toBe("none");
    expect(urgencyTone("high")).toBe("high");
    expect(URGENCY_CLASS.high).toContain("bg-error-tint");
  });

  it("drops an empty note and trims a real one", () => {
    expect(cleanNote("   ")).toBeUndefined();
    expect(cleanNote(" seen it ")).toBe("seen it");
  });

  it("links to the person's page", () => {
    expect(sellerHref("he", "u1")).toBe("/he/seller/u1");
  });

  it("has wording for every action in both languages", () => {
    for (const lang of [en, he]) {
      for (const a of REVIEW_ACTIONS) {
        expect((lang.admin.review.actions as Record<string, string>)[a]).toBeTruthy();
        expect((lang.admin.review.done as Record<string, string>)[a]).toBeTruthy();
      }
    }
  });
});
