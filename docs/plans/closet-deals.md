# Plan: closet deals that people find and feel

Status: planned 2026-10-16, not built. Waiting for Eden's decisions (section 6). Live mockup (website look, clickable): https://claude.ai/artifact/EApCzYrtcGR3EYSGXqbkhd

## Why

> so buyers can add couple of listings into a bundle and gain some discount from the seller and possibly save on shipment as well.
> (Eden)

## What already exists (Milestone 5, website W5)

"Closet deal" is our name for a bundle (`docs/originality.md`, the spec's word is not used).

- **The seller's ladder.** Each seller has a discount ladder, by default 2 items 5 percent, 3 items 10 percent, 5 items 15 percent (`bundle_discount_tiers`, Settings, Closet deals).
- **The pick page.** A "Closet deal" button on the seller's profile opens a page of their items with tick boxes and a summary ("Add 1 more item to get 5% off") (`apps/web/components/bundle/bundle-view.tsx`, `apps/mobile/app/(app)/bundle/[sellerId].tsx`, `/v1/bundles`).
- **One order.** Continue to checkout turns the picks into one order with a "Closet deal (10%)" line. Postage is paid once: the biggest parcel in the order sets the price (`apps/server/src/lib/checkout.ts`).

## What is missing

1. **Nobody finds it.** The only way in is a quiet button on the seller's profile. The item page says nothing, although the Help page promises it does.
2. **The postage saving is invisible.** Three items from one seller cost one parcel instead of three, but nowhere says so.
3. **Adding is a separate trip.** You cannot add the item you are looking at, or one of the seller's other items, without going to the pick page.
4. **No sense of progress while browsing.** Once a deal is open, nothing shows it until you return to the pick page.

## 1. The item page tells you about the deal

Under Buy and Send your offer, for a seller whose ladder is on:

- A "Closet deal" box: the seller's ladder as small steps (2 items 5% off, 3 items 10% off, 5 items 15% off), one line "Postage is paid once for the whole parcel", and an "Add to closet deal" button.
- When the item is already in the deal: "In your closet deal", the count and the current percent, "View deal" and "Remove".
- Below the item, "More from {seller}" cards get a small add button in the corner, so the next item is one tap away.
- Not shown on your own items, for sellers who switched the ladder off, or for sold and reserved items.

## 2. A deal bar while you shop that seller

While a deal is open, a slim bar sits at the bottom of that seller's item pages, profile and pick page:

- The item photos, small and stacked, then "3 items, 10% off", then "You save ₪37" (discount plus postage).
- The next step, when there is one: "Add 2 more for 15% off".
- A "View deal" button that opens the pick page.
- It never covers the Buy button on a phone (the page gets bottom padding the bar's height).

## 3. The pick page shows every saving

The pick page (built) gains:

- A ladder bar with the steps marked, filling as you pick.
- In the summary: each item, "Closet deal (10%)", "Postage, one parcel" with the struck through sum of separate parcels ("₪18 instead of ₪46"), Coverage, total, and one green line "You save ₪37 with this closet deal".
- Items that sold while in the deal: greyed with "Sold, removed from your deal".

Checkout (built) gets the same "You save" line.

## 4. Postage saving, how it is counted

`separate = sum of each item's own parcel price`, `together = the parcel the order pays` (today the biggest one), `postage saved = separate - together`. Shown only when it is above 0. Nothing about the money the seller or we receive changes.

## 5. Server and files (expected)

- `GET /v1/users/:id/closet-deal` (or a field on the item page reply): the seller's ladder and whether it is on. The item page asks once.
- The bundle reply gains `postageSeparateMinor` and `postageTogetherMinor` (`apps/server/src/lib/bundles.ts`, `packages/shared`).
- `POST /v1/bundles` already opens a deal, `PUT` and `DELETE /v1/bundles/:id/items/:listingId` already add and remove. The item page and the cards call these.
- Website: the item page side panel, `components/bundle/`, a new deal bar component, `infinite-item-grid` card add button.
- App: the item page, the deal bar, the pick page summary.
- Wording in `packages/locales/en.json` and `he.json`. Help article "Closet deals" checked against what ships.
- `docs/design.md`: one new decision.

## 6. Decisions for Eden

1. **Postage for many items.** Today the biggest parcel sets the price, however many items. Keep that (simple, buyers save the most) or step up one parcel size every 4 items (closer to a real box)?
2. **Make an offer on the whole deal.** Let the buyer send one offer for the deal total, which the seller accepts, declines or counters like a normal offer. Now, in this round, or later?
3. **Where the deal shows.** Only on that seller's pages (recommended, quiet) or also as a small counter in the top bar everywhere?
4. **The ladder for new sellers.** Keep 5, 10, 15 percent on by default (recommended, deals exist from day one) or off until the seller turns it on?

## Not changing

- The order, fee and state machine rules (`packages/shared/src/state-machines.ts`). A deal still becomes one normal order.
- One seller per deal.
- Items are not held while they sit in a deal. Only checkout holds them, as today.
