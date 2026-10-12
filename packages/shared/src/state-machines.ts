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
