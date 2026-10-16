# Plan: bundles that people find and feel

Status: approved 2026-10-16, built on branch `feat/bundles` (D-049), waiting for review. Built: the rename to Bundle (app, website, English, Hebrew, Help), seller ladder with the default and an on switch (`bundles_on`, migration 0014, not yet run online) with Settings, Bundles on both, the item page box in three states, "+ Bundle" on a seller's other items, the bundle bar on that seller's item pages and profile, savings on the bundle page and checkout. Also added: `GET /v1/bundles/open` (looks for the open bundle without making one) and a "More from {seller}" row on the app item page (the website had it). Decisions in section 6. Live mockup (website look, clickable): https://claude.ai/artifact/EApCzYrtcGR3EYSGXqbkhd

## Why

> so buyers can add couple of listings into a bundle and gain some discount from the seller and possibly save on shipment as well.
> (Eden)

## What already exists (Milestone 5, website W5)

It shipped as "Closet deal". **Eden renamed it "Bundle" (2026-10-16):** the word is common, only the phrase "Bundle discounts" is banned (`docs/originality.md`), so we never write "bundle discount". Every screen, Help article and setting moves to Bundle, and the voice guide's avoid list drops "bundle".

- **The seller's ladder.** Each seller has a discount ladder, by default 2 items 5 percent, 3 items 10 percent, 5 items 15 percent (`bundle_discount_tiers`, Settings, Closet deals).
- **The pick page.** A "Closet deal" button on the seller's profile opens a page of their items with tick boxes and a summary ("Add 1 more item to get 5% off") (`apps/web/components/bundle/bundle-view.tsx`, `apps/mobile/app/(app)/bundle/[sellerId].tsx`, `/v1/bundles`).
- **One order.** Continue to checkout turns the picks into one order with a "Closet deal (10%)" line. Postage is paid once: the biggest parcel in the order sets the price (`apps/server/src/lib/checkout.ts`).

## What is missing

1. **Nobody finds it.** The only way in is a quiet button on the seller's profile. The item page says nothing, although the Help page promises it does.
2. **The postage saving is invisible.** Three items from one seller cost one parcel instead of three, but nowhere says so.
3. **Adding is a separate trip.** You cannot add the item you are looking at, or one of the seller's other items, without going to the pick page.
4. **No sense of progress while browsing.** Once a bundle is open, nothing shows it until you return to the pick page.

## 1. The item page tells you about the bundle

Under Buy and Send your offer, then the seller's card, for a seller whose ladder is on, a "Bundle from {seller}" box in one of three states:

- **No bundle yet:** the seller's ladder as small steps (2 items 5% off, 3 items 10% off, 5 items 15% off), "Postage is paid once for the whole parcel", and "Add to bundle".
- **A bundle with other items, not this one:** "2 items in your bundle, 5% off. This one is not in it yet", the steps lit for the current count, "Add this item to get 10% off", and a separate "View bundle". (The first mockup lit the steps without saying the item was not in yet, and its one button added it, which looked like the count jumped from 2 to 3.)
- **This item is in:** "Your bundle", "This item is in your bundle. 3 items, 10% off", "View bundle" and "Remove".
- Below the item, "More from {seller}" cards get a small "+ Bundle" button in the corner ("In bundle" with a tick once added), so the next item is one tap away.
- Not shown on your own items, for sellers who switched the ladder off, or for sold and reserved items.

## 2. A bundle bar while you shop that seller

While a bundle is open, a slim bar sits at the bottom of that seller's item pages, profile and pick page:

- The item photos, small and stacked, then "3 items, 10% off", then "You save ₪37" (discount plus postage).
- The next step, when there is one: "Add 2 more for 15% off".
- A "View bundle" button that opens the bundle page.
- It never covers the Buy button on a phone (the page gets bottom padding the bar's height).

## 3. The bundle page shows every saving

The pick page (built) gains:

- A ladder bar with the steps marked, filling as you pick.
- In the summary: each item, "Bundle, 10% off", "Postage, one parcel" with the struck through sum of separate parcels ("₪18 instead of ₪46"), Coverage, total, and one green line "You save ₪37 with this bundle".
- Items that sold while in the bundle: greyed with "Sold, removed from your bundle".

Checkout (built) gets the same "You save" line.

## 4. Postage saving, how it is counted

`separate = sum of each item's own parcel price`, `together = the parcel the order pays` (today the biggest one), `postage saved = separate - together`. Shown only when it is above 0. Nothing about the money the seller or we receive changes.

## 5. Server and files (expected)

- `GET /v1/users/:id/bundle-ladder` (or a field on the item page reply): the seller's ladder and whether it is on. The item page asks once.
- The bundle reply gains `postageSeparateMinor` and `postageTogetherMinor` (`apps/server/src/lib/bundles.ts`, `packages/shared`).
- `POST /v1/bundles` already opens a bundle, `PUT` and `DELETE /v1/bundles/:id/items/:listingId` already add and remove. The item page and the cards call these.
- Website: the item page side panel, `components/bundle/`, a new bundle bar component, `infinite-item-grid` card add button.
- App: the item page, the bundle bar, the bundle page summary.
- Wording in `packages/locales/en.json` and `he.json`. Help article "Closet deals" renamed "Bundles" and checked against what ships. Settings, Closet deals becomes Bundles.
- `docs/design.md`: one new decision.

## 6. Decisions for Eden

Eden approved the mockup on 2026-10-16 and asked to build. The recommended option of each was taken (Eden can change them later):

- **1: keep the biggest parcel** for any number of items.
- **2: an offer on the whole bundle comes later**, not in this round.
- **3: the bundle bar shows only on that seller's pages.**
- **4: the ladder stays on by default** for new sellers.

The options as asked:


1. **Postage for many items.** Today the biggest parcel sets the price, however many items. Keep that (simple, buyers save the most) or step up one parcel size every 4 items (closer to a real box)?
2. **Make an offer on the whole bundle.** Let the buyer send one offer for the bundle total, which the seller accepts, declines or counters like a normal offer. Now, in this round, or later?
3. **Where the bundle bar shows.** Only on that seller's pages (recommended, quiet) or also as a small counter in the top bar everywhere?
4. **The ladder for new sellers.** Keep 5, 10, 15 percent on by default (recommended, bundles exist from day one) or off until the seller turns it on?

## Not changing

- The order, fee and state machine rules (`packages/shared/src/state-machines.ts`). A bundle still becomes one normal order.
- One seller per bundle.
- Items are not held while they sit in a bundle. Only checkout holds them, as today.
