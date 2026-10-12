import { describe, expect, it } from "vitest";
import { OFFER_EVENTS, OFFER_STATUSES, ORDER_EVENTS, ORDER_STATUSES } from "./enums.js";
import {
  allowedOrderEvents,
  canActorTransition,
  canOfferActorTransition,
  canOfferTransition,
  canTransition,
  isFinalOrderStatus,
  nextOfferStatus,
  nextOrderStatus,
  ORDER_TRANSITIONS,
} from "./state-machines.js";

describe("order state machine", () => {
  it("follows the happy path pay, ship, confirm", () => {
    let status = nextOrderStatus("pending_payment", "pay");
    expect(status).toBe("paid");
    status = nextOrderStatus(status as "paid", "ship");
    expect(status).toBe("shipped");
    status = nextOrderStatus(status as "shipped", "confirm_received");
    expect(status).toBe("completed");
  });

  it("allows a delivered step before completion", () => {
    expect(nextOrderStatus("shipped", "deliver")).toBe("delivered");
    expect(nextOrderStatus("delivered", "confirm_received")).toBe("completed");
    expect(nextOrderStatus("delivered", "auto_complete")).toBe("completed");
  });

  it("allows cancelling only before shipping", () => {
    expect(canTransition("pending_payment", "cancel")).toBe(true);
    expect(canTransition("paid", "cancel")).toBe(true);
    expect(canTransition("shipped", "cancel")).toBe(false);
    expect(canTransition("completed", "cancel")).toBe(false);
  });

  it("does not allow skipping steps", () => {
    expect(canTransition("pending_payment", "ship")).toBe(false);
    expect(canTransition("paid", "confirm_received")).toBe(false);
    expect(canTransition("paid", "pay")).toBe(false);
  });

  it("handles disputes", () => {
    expect(nextOrderStatus("shipped", "open_dispute")).toBe("disputed");
    expect(nextOrderStatus("disputed", "refund")).toBe("refunded");
    expect(nextOrderStatus("disputed", "release")).toBe("completed");
  });

  it("has no way out of final states", () => {
    for (const status of ORDER_STATUSES.filter(isFinalOrderStatus)) {
      expect(allowedOrderEvents(status)).toEqual([]);
    }
  });

  it("only mentions known events and statuses", () => {
    for (const [from, events] of Object.entries(ORDER_TRANSITIONS)) {
      expect(ORDER_STATUSES).toContain(from);
      for (const [event, to] of Object.entries(events)) {
        expect(ORDER_EVENTS).toContain(event);
        expect(ORDER_STATUSES).toContain(to);
      }
    }
  });

  it("checks who may fire an event", () => {
    expect(canActorTransition("paid", "ship", "seller")).toBe(true);
    expect(canActorTransition("paid", "ship", "buyer")).toBe(false);
    expect(canActorTransition("shipped", "confirm_received", "buyer")).toBe(true);
    expect(canActorTransition("shipped", "confirm_received", "seller")).toBe(false);
    expect(allowedOrderEvents("paid", "seller")).toEqual(["ship", "cancel"]);
  });
});

describe("offer state machine", () => {
  it("lets a pending offer be accepted, declined, countered, withdrawn or expire", () => {
    expect(nextOfferStatus("pending", "accept")).toBe("accepted");
    expect(nextOfferStatus("pending", "decline")).toBe("declined");
    expect(nextOfferStatus("pending", "counter")).toBe("countered");
    expect(nextOfferStatus("pending", "withdraw")).toBe("withdrawn");
    expect(nextOfferStatus("pending", "expire")).toBe("expired");
  });

  it("lets an accepted offer lapse if the buyer never checks out", () => {
    expect(nextOfferStatus("accepted", "expire")).toBe("expired");
    expect(canOfferTransition("accepted", "decline")).toBe(false);
  });

  it("cannot change a settled offer", () => {
    for (const status of ["declined", "countered", "withdrawn", "expired"] as const) {
      for (const event of OFFER_EVENTS) {
        expect(canOfferTransition(status, event)).toBe(false);
      }
    }
  });

  it("only mentions known values", () => {
    for (const status of OFFER_STATUSES) {
      for (const event of OFFER_EVENTS) {
        const next = nextOfferStatus(status, event);
        if (next) expect(OFFER_STATUSES).toContain(next);
      }
    }
  });

  it("checks who may answer", () => {
    expect(canOfferActorTransition("pending", "accept", "recipient")).toBe(true);
    expect(canOfferActorTransition("pending", "accept", "offerer")).toBe(false);
    expect(canOfferActorTransition("pending", "withdraw", "offerer")).toBe(true);
    expect(canOfferActorTransition("pending", "expire", "system")).toBe(true);
  });
});
