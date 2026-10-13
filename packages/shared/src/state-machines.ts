import type { ActorRole, OfferEvent, OfferStatus, OrderEvent, OrderStatus } from "./enums.js";

/**
 * Order state machine. Pure functions only, no database access.
 * Real payments and shipping later replace only the callers of "pay", "ship" and "deliver".
 * The states and transitions stay the same.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>>> = {
  pending_payment: { pay: "paid", cancel: "cancelled" },
  paid: { ship: "shipped", cancel: "cancelled" },
  shipped: {
    deliver: "delivered",
    confirm_received: "completed",
    open_dispute: "disputed",
  },
  delivered: {
    confirm_received: "completed",
    auto_complete: "completed",
    open_dispute: "disputed",
  },
  completed: {},
  cancelled: {},
  disputed: { refund: "refunded", release: "completed" },
  refunded: {},
};

/** Who is allowed to fire each order event. */
export const ORDER_EVENT_ACTORS: Readonly<Record<OrderEvent, readonly ActorRole[]>> = {
  /** Not a transition. Written once to the timeline when the order is first placed. */
  create: ["buyer"],
  pay: ["buyer", "system"],
  ship: ["seller", "system"],
  deliver: ["system", "buyer"],
  confirm_received: ["buyer"],
  auto_complete: ["system"],
  cancel: ["buyer", "seller", "system", "admin"],
  open_dispute: ["buyer"],
  refund: ["admin"],
  release: ["admin"],
};

export const FINAL_ORDER_STATUSES: readonly OrderStatus[] = ["completed", "cancelled", "refunded"];

/** The status an order reaches when the event happens, or null when the event is not allowed. */
export function nextOrderStatus(status: OrderStatus, event: OrderEvent): OrderStatus | null {
  return ORDER_TRANSITIONS[status][event] ?? null;
}

export function canTransition(status: OrderStatus, event: OrderEvent): boolean {
  return nextOrderStatus(status, event) !== null;
}

/** Same as canTransition but also checks that this kind of actor may fire the event. */
export function canActorTransition(status: OrderStatus, event: OrderEvent, actor: ActorRole): boolean {
  return canTransition(status, event) && ORDER_EVENT_ACTORS[event].includes(actor);
}

export function allowedOrderEvents(status: OrderStatus, actor?: ActorRole): OrderEvent[] {
  return (Object.keys(ORDER_TRANSITIONS[status]) as OrderEvent[]).filter(
    (event) => actor === undefined || ORDER_EVENT_ACTORS[event].includes(actor),
  );
}

export function isFinalOrderStatus(status: OrderStatus): boolean {
  return FINAL_ORDER_STATUSES.includes(status);
}

/** Order statuses where the listing stays reserved for the buyer. */
export const LISTING_HELD_ORDER_STATUSES: readonly OrderStatus[] = ["pending_payment"];

/** Offer state machine. Only a pending offer can change. */
export const OFFER_TRANSITIONS: Readonly<Record<OfferStatus, Partial<Record<OfferEvent, OfferStatus>>>> = {
  pending: {
    accept: "accepted",
    decline: "declined",
    counter: "countered",
    withdraw: "withdrawn",
    expire: "expired",
  },
  accepted: { expire: "expired" },
  declined: {},
  countered: {},
  withdrawn: {},
  expired: {},
};

/** Who may fire each offer event, relative to the person who made the offer. */
export const OFFER_EVENT_ACTORS: Readonly<
  Record<OfferEvent, readonly ("offerer" | "recipient" | "system")[]>
> = {
  accept: ["recipient"],
  decline: ["recipient"],
  counter: ["recipient"],
  withdraw: ["offerer"],
  expire: ["system"],
};

export function nextOfferStatus(status: OfferStatus, event: OfferEvent): OfferStatus | null {
  return OFFER_TRANSITIONS[status][event] ?? null;
}

export function canOfferTransition(status: OfferStatus, event: OfferEvent): boolean {
  return nextOfferStatus(status, event) !== null;
}

export function canOfferActorTransition(
  status: OfferStatus,
  event: OfferEvent,
  actor: "offerer" | "recipient" | "system",
): boolean {
  return canOfferTransition(status, event) && OFFER_EVENT_ACTORS[event].includes(actor);
}

/** The buyer can report a problem for this long after delivery. */
export const DISPUTE_WINDOW_HOURS = 48;

/** True while a delivered order can still be disputed. An order that has no delivery time yet is always inside it. */
export function isWithinDisputeWindow(deliveredAt: Date | null, now: Date): boolean {
  if (!deliveredAt) return true;
  return now.getTime() - deliveredAt.getTime() <= DISPUTE_WINDOW_HOURS * 3_600_000;
}

/**
 * Who may cancel at which step, on top of the transition table. A seller has nothing to cancel while the buyer is
 * still paying, so only the buyer (or the system, when the hold runs out) can end an unpaid order. After payment
 * both people can cancel until the parcel is shipped.
 */
export function canActorCancel(status: OrderStatus, actor: ActorRole): boolean {
  if (!canActorTransition(status, "cancel", actor)) return false;
  if (status === "pending_payment") return actor !== "seller";
  return true;
}

/** The cancel reason an actor leaves behind. The system picks its own reason (hold expired, no shipment). */
export function cancelReasonFor(actor: ActorRole): "buyer_cancelled" | "seller_cancelled" | "other" {
  return actor === "buyer" ? "buyer_cancelled" : actor === "seller" ? "seller_cancelled" : "other";
}

/**
 * The buttons a person can use on an order right now, for the app to show or hide. `review` and the rest of the
 * list are decided by the server from the same rules.
 */
export type OrderAction = "pay" | "cancel" | "ship" | "confirm_received" | "open_dispute";

export function orderActionsFor(
  status: OrderStatus,
  role: "buyer" | "seller",
  deliveredAt: Date | null,
  now: Date,
): OrderAction[] {
  const actions: OrderAction[] = [];
  if (role === "buyer") {
    if (canActorTransition(status, "pay", "buyer")) actions.push("pay");
    if (canActorCancel(status, "buyer")) actions.push("cancel");
    if (canActorTransition(status, "confirm_received", "buyer")) actions.push("confirm_received");
    if (canActorTransition(status, "open_dispute", "buyer") && isWithinDisputeWindow(deliveredAt, now)) {
      actions.push("open_dispute");
    }
  } else {
    if (canActorTransition(status, "ship", "seller")) actions.push("ship");
    if (canActorCancel(status, "seller")) actions.push("cancel");
  }
  return actions;
}
