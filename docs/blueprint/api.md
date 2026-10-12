# API contract

The contract between the Fastify server (`apps/server`) and the Expo app (`apps/mobile`). Request and response shapes are zod schemas in `packages/shared/src/`, used by both sides, so a change to a shape is a compile error on whichever side forgot to update.

Status of the schemas: the ones for Milestones 1 and 2 already exist in the shared package and are named below. Later milestones list the shape in words and get their schema when the milestone starts.

## Conventions

**Base address.** `/v1` for everything we build. Better Auth keeps its own routes under `/api/auth`. Health stays at `/health` and `/health/db`.

**Format.** JSON in, JSON out, UTF-8. Dates are ISO 8601 strings with an offset. Money is `{ amountMinor, currency }` or a pair of fields `priceMinor` and `currency`, always integer minor units. Ids are UUID strings.

**Language.** The app sends `Accept-Language: he` or `en`. The server uses it for push text and for validation messages. Reference data always returns both languages in the form `{ en, he }` and the app chooses.

**Authentication.** Better Auth sessions. The mobile app sends `Authorization: Bearer <session token>` (Better Auth bearer plugin) and keeps the token in secure storage. Requests are one of:

| Label | Meaning |
|---|---|
| Public | No session needed |
| Optional | Works without a session, returns more (for example `viewer` fields) with one |
| Required | A valid session. Otherwise `401 unauthenticated` |
| Owner | Required, and the resource must belong to the caller. Otherwise `404` (we do not reveal that it exists) |
| Party | Required, and the caller must be the buyer or the seller of that order, offer or conversation |
| Moderator | Required, with role `moderator` or `admin` |

**Blocked people.** If either side has blocked the other, messaging, offers and buying return `403 blocked`, and the blocked person's listings are left out of the blocker's feed and search.

**Pagination.** Cursor based, never page numbers. Request: `?cursor=<opaque text>&limit=<1 to 50, default 20>`. Response: `{ "items": [...], "nextCursor": "<opaque text>" | null }`. The cursor is base64url JSON of the sort keys (for example bump time and id) and must be passed back unchanged. Search also returns `total` (a number) and `totalCapped` (true when there are more than 500, which the app shows as "500+"). Schemas: `paginationQuerySchema`, `pageSchema(item)`.

**Errors.** One shape for every failure, schema `errorResponseSchema`:

```json
{ "error": { "code": "validation_failed", "message": "Title is too short", "fields": { "title": "Use at least 3 characters" } } }
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `validation_failed` | Body, query or params do not match the schema. `fields` lists the problems |
| 401 | `unauthenticated` | No or expired session |
| 403 | `forbidden` | Signed in but not allowed |
| 403 | `blocked` | One side blocked the other |
| 404 | `not_found` | Missing, or not yours |
| 409 | `conflict` | Duplicate (username taken, already favourited), or a stale write |
| 409 | `listing_unavailable` | The listing is sold, reserved for someone else, hidden or removed |
| 409 | `invalid_transition` | The order or offer cannot make that move from its current status |
| 429 | `offer_limit_reached` | Daily offer limit used up. Body has `resetsAt` |
| 429 | `rate_limited` | Too many requests. `Retry-After` header in seconds |
| 500 | `internal_error` | A bug. The response carries a request id and nothing else |

**Idempotency.** `POST /v1/orders`, `POST /v1/orders/:id/pay`, withdrawals and message sends accept an `Idempotency-Key` header (messages use `clientMessageId` in the body). Repeating a request with the same key within 24 hours returns the first result instead of doing it twice.

**Uploads.** The app never sends files through the API. It asks for a presigned address, then uploads straight to the S3 compatible bucket (Cloudflare R2 in production, MinIO or a local folder in development), then refers to the file by its key. See `POST /v1/uploads`.

**Rate limits.** Enforced with `@fastify/rate-limit`, keyed by user id when signed in and by IP otherwise. Responses carry `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

| Group | Limit |
|---|---|
| Everything by default | 300 per minute |
| Sign up, sign in, password reset (`/api/auth`) | 10 per minute per IP, and 5 per hour per email for reset |
| Search and suggestions | 120 per minute |
| Writes (create, update, delete) | 60 per minute |
| Uploads (presign) | 30 per minute |
| Messages | 60 per minute per user, and 20 per minute per conversation |
| Offers | 10 per rolling 24 hours per buyer (a business rule from `platform_settings.offer_daily_limit`, not just a rate limit) |
| Reports | 10 per hour |

## Milestone 1: Accounts

Goal: a person can create an account, sign in on the phone, finish their profile and set up their settings.

### Better Auth routes (`/api/auth/*`, handled by the library)

Configuration: Drizzle adapter on Postgres with `usePlural: true` and `generateId: "uuid"`, plugins `username`, `bearer`, `admin`, social providers Google and Apple (the app sends the provider's ID token), email and password with email verification, rate limit as above. Face ID unlock is a phone feature that unlocks the stored session token and needs no route.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/sign-up/email` | Public | Create an account with email, password and name |
| POST | `/api/auth/sign-in/email` | Public | Sign in with email and password. Returns the session token |
| POST | `/api/auth/sign-in/social` | Public | Sign in with Google or Apple using the provider's ID token |
| POST | `/api/auth/sign-out` | Required | End this session |
| GET | `/api/auth/get-session` | Optional | Current session and user |
| POST | `/api/auth/send-verification-email` | Required | Resend the verification email |
| GET | `/api/auth/verify-email` | Public | Link target from the email |
| POST | `/api/auth/request-password-reset` | Public | Email a reset link |
| POST | `/api/auth/reset-password` | Public | Set a new password with the token |
| POST | `/api/auth/change-password` | Required | Change password, can revoke other sessions |
| POST | `/api/auth/change-email` | Required | Start an email change |
| GET | `/api/auth/list-sessions` | Required | Devices signed in (Settings, Security) |
| POST | `/api/auth/revoke-session` | Required | Sign one device out |
| POST | `/api/auth/revoke-other-sessions` | Required | Sign all other devices out |
| POST | `/api/auth/link-social` | Required | Add Google or Apple to an existing account |
| POST | `/api/auth/delete-user` | Required | Close the account (see below) |
| GET | `/api/auth/is-username-available` | Public | Username plugin. Used live while typing the username |

### Our routes

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/v1/reference` | Public | none | `referenceDataSchema` | Categories tree with attribute rules, size groups, conditions, colours, materials, patterns, parcel sizes, currencies, fee rules and a few settings. Returns an `ETag` and `Cache-Control: max-age=3600`. The app caches it and sends `If-None-Match` |
| GET | `/v1/brands` | Public | `?q=<text>&cursor&limit` | page of `brandSchema` | Prefix search for the brand picker. Empty `q` returns the most popular |
| GET | `/v1/me` | Required | none | `meSchema` | The signed in person with profile. `needsOnboarding` is true until a username is chosen |
| PATCH | `/v1/me/profile` | Required | `updateProfileInputSchema` | `meSchema` | Username (checked for uniqueness), bio, city, country, avatar key from an upload |
| GET | `/v1/me/settings` | Required | none | `userSettingsSchema` | |
| PATCH | `/v1/me/settings` | Required | `updateUserSettingsInputSchema` | `userSettingsSchema` | Language, push master switch and daily limit, email, personalisation, last seen, ship from options |
| GET | `/v1/me/notification-preferences` | Required | none | list of `notificationPreferenceSchema` with defaults filled in | |
| PUT | `/v1/me/notification-preferences` | Required | `updateNotificationPreferencesInputSchema` | same list | |
| GET | `/v1/me/addresses` | Required | none | list of `addressSchema` | |
| POST | `/v1/me/addresses` | Required | `addressInputSchema` | `addressSchema` | The first address becomes the default |
| PATCH | `/v1/me/addresses/:id` | Owner | `addressInputSchema` partial | `addressSchema` | Setting `isDefault` unsets the old default |
| DELETE | `/v1/me/addresses/:id` | Owner | none | 204 | |
| POST | `/v1/me/push-tokens` | Required | `pushTokenInputSchema` | 204 | Registers or refreshes the phone. Idempotent on the token |
| DELETE | `/v1/me/push-tokens/:token` | Required | none | 204 | Called on sign out |
| POST | `/v1/uploads` | Required | `uploadRequestSchema` | `uploadResponseSchema` | Presigned PUT address. Checks type and size. Purpose `avatar`, `listing_photo` or `message_photo` decides the folder |
| GET | `/v1/users/:id` | Optional | none | `publicProfileSchema` | Seller profile header. `viewer` shows whether the caller follows or blocked them |
| PUT | `/v1/users/:id/follow` | Required | none | 204 | Idempotent. Cannot follow yourself |
| DELETE | `/v1/users/:id/follow` | Required | none | 204 | |
| GET | `/v1/users/:id/followers` | Public | page query | `followListSchema` | The numbers on a profile are links to these |
| GET | `/v1/users/:id/following` | Public | page query | `followListSchema` | |
| PUT | `/v1/users/:id/block` | Required | none | 204 | Also removes the follow in both directions |
| DELETE | `/v1/users/:id/block` | Required | none | 204 | |
| GET | `/v1/me/blocks` | Required | page query | `followListSchema` | Settings, blocked members |
| DELETE | `/v1/me` | Required | `{ "password"?: string }` | 204 | Closes the account: sets `profiles.deleted_at`, clears personal fields, hides listings, keeps orders and reviews under an anonymous name. Blocked while an order is open |

## Milestone 2: Selling

Goal: a seller can photograph, describe, price and publish an item, and manage their listings.

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/v1/listings` | Required | `createListingInputSchema` | `listingDetailSchema` | With `publish: false` saves a draft (the Save in the "Save changes before closing?" dialog). With `publish: true` the server also checks `publishableListingSchema` and the category rules (a required Brand or Size must be present) and sets status `active` |
| GET | `/v1/me/listings` | Required | `myListingsQuerySchema` (`status`, cursor, limit) | `myListingsPageSchema` | Own page: Active and Sold chips, price, views and favourites. Drafts included |
| GET | `/v1/me/listings/:id` | Owner | none | `listingDetailSchema` | Own view of any status, used by the edit screen |
| PATCH | `/v1/listings/:id` | Owner | `listingDraftInputSchema` | `listingDetailSchema` | Edits any field. Lowering the price sets `previousPriceMinor`, writes `listing_price_history` and later notifies people who favourited it. Sold and removed listings cannot be edited |
| PUT | `/v1/listings/:id/photos` | Owner | `{ photos: listingPhotoInput[] }` in display order | `listingDetailSchema` | Replaces the photo list. Position 0 is the cover. Removed keys are deleted from storage by a background job |
| POST | `/v1/listings/:id/publish` | Owner | none | `listingDetailSchema` | Publishes a draft |
| PATCH | `/v1/listings/:id/status` | Owner | `updateListingStatusInputSchema` | `listingDetailSchema` | `hidden` pauses, `active` shows again. Not allowed while reserved or sold |
| DELETE | `/v1/listings/:id` | Owner | none | 204 | Drafts are deleted for real. A listing that was ever active is only allowed to be deleted if it has no orders, otherwise it must be hidden |
| PUT | `/v1/me/holiday-mode` | Required | `{ enabled: boolean, endsAt?: datetime }` | `{ enabled, startedAt, endsAt }` | While on, listings are left out of feed and search. Turns itself off at `endsAt` |
| GET | `/v1/me/listing-defaults` | Required | none | `{ addressId, parcelSizeId? , shipFromHome, shipFromDropoff }` | Pre-fills the sell form |

## Milestone 3: Discovery

Goal: find things. Feed, search, categories, the item page, people, brands and favourites.

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/v1/feed` | Optional | `?categoryId&cursor&limit` | page of `listingCardSchema` | Home. Personalised when signed in (favourites, followed sellers, sizes, brands), newest first otherwise. The chips (All, Women, Men, Trending, Designer, Kids) pass a `categoryId` or `trending=true` |
| GET | `/v1/listings` | Optional | `searchFiltersSchema` plus page query | page of `listingCardSchema` plus `total`, `totalCapped` | Search and catalog. `q` is the text. Filters: `categoryId` (whole subtree), `brandIds`, `sizeIds`, `conditionIds`, `colourIds`, `materialIds`, `patternIds`, `priceMinMinor`, `priceMaxMinor`, `sellerId`, `sort` (relevance, newest, price_asc, price_desc). Excludes holiday mode sellers and blocked people |
| GET | `/v1/listings/count` | Optional | same filters | `{ total, totalCapped }` | Powers the Show results button count without loading cards |
| GET | `/v1/search/suggestions` | Optional | `?q=<text>` | `{ suggestions: [{ text, categoryId?, categoryName? }] }` | Autosuggest while typing: popular queries and brand and category matches, up to 10 |
| GET | `/v1/listings/:id` | Optional | none | `listingDetailSchema` | Item page. `viewer` tells the app which buttons to show. Counts a view (deduplicated per viewer per day). Sold and reserved listings still open |
| GET | `/v1/listings/:id/similar` | Optional | page query | page of `listingCardSchema` | More like this |
| GET | `/v1/users/:id/listings` | Public | `?status=active\|sold` plus page query and filters | page of `listingCardSchema` | Profile, Listings tab (the Filter link uses `searchFiltersSchema`) |
| GET | `/v1/users/:id/reviews` | Public | `?source=all\|member\|automatic` plus page query | `{ summary, items }` | Reviews tab with the member and automatic scores. Item schema in M5 |
| GET | `/v1/users` | Public | `?q=<text>` plus page query | page of `userSummarySchema` | Members search tab. Prefix match on username |
| PUT | `/v1/listings/:id/favourite` | Required | none | `{ favouriteCount }` | Idempotent. Notifies the seller (grouped) |
| DELETE | `/v1/listings/:id/favourite` | Required | none | `{ favouriteCount }` | |
| GET | `/v1/me/favourites` | Required | `?q=<text>` plus page query | page of `listingCardSchema` | Includes sold items with status `sold` so the card shows the green band |
| GET | `/v1/me/saved-searches` | Required | page query | list of `{ id, queryText, filters, notifyOnNew, createdAt }` | |
| POST | `/v1/me/saved-searches` | Required | `{ queryText?, filters, notifyOnNew? }` | the saved search | The bookmark next to the search field |
| PATCH | `/v1/me/saved-searches/:id` | Owner | `{ notifyOnNew }` | the saved search | |
| DELETE | `/v1/me/saved-searches/:id` | Owner | none | 204 | |
| GET | `/v1/me/recent-searches` | Required | none | list of `{ id, queryText, filters, resultCount, createdAt }` (10 newest) | |
| POST | `/v1/me/recent-searches` | Required | `{ queryText, filters, resultCount? }` | 204 | Written when a search is submitted. Duplicates move to the top |
| DELETE | `/v1/me/recent-searches` | Required | none | 204 | Clear all |
| POST | `/v1/reports` | Required | `{ targetType, targetId, reason, details? }` | 204 | Item "..." menu Report, profile report. Rate limited |
| PUT | `/v1/me/personalisation/sizes` | Required | `{ sizeIds: uuid[] }` | `{ sizeIds }` | Replaces the list. Brands are M6 |

## Milestone 4: Messaging

Goal: ask the seller, chat, and see what happened in one thread.

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/v1/conversations` | Required | `?archived=true` plus page query | page of conversation rows | Inbox, Messages tab: other person, item thumbnail and title, last message preview, unread flag, time |
| POST | `/v1/conversations` | Required | `{ listingId, body? }` | the conversation | Ask seller. Returns the existing chat for this listing and buyer if there is one. Cannot message yourself or a blocker |
| GET | `/v1/conversations/:id` | Party | none | conversation with listing strip data (photo, title, price, buyer price), the other person's intro card data (city, last seen), `order` summary if any | |
| GET | `/v1/conversations/:id/messages` | Party | page query, newest first | page of messages | Text, photos, offer bubbles (with the offer's current status) and system dividers, in one list |
| POST | `/v1/conversations/:id/messages` | Party | `{ clientMessageId, kind: "text" or "photo", body?, attachmentKey?, width?, height? }` | the message | Also broadcast over Socket.IO. The REST route is the fallback when the socket is down |
| POST | `/v1/conversations/:id/read` | Party | none | 204 | Moves the read marker to now |
| PUT | `/v1/conversations/:id/archive` | Party | `{ archived: boolean }` | 204 | |
| PUT | `/v1/conversations/:id/mute` | Party | `{ muted: boolean }` | 204 | |
| GET | `/v1/me/unread` | Required | none | `{ messages: number, notifications: number }` | The red dot on the Inbox tab |
| GET | `/v1/me/notifications` | Required | page query | page of `{ id, type, data, listingId, orderId, conversationId, actor, readAt, createdAt }` | Inbox, Notifications tab. The app writes the sentence from `type` and `data` |
| POST | `/v1/me/notifications/read` | Required | `{ ids?: uuid[] }` (none means all) | 204 | |

## Milestone 5: Orders

Goal: offers, simulated checkout, the order life, reviews, balance.

> **Simulated in version 1.** Three steps pretend to be real: **pay**, **ship** and **deliver**. `POST /v1/orders/:id/pay` always succeeds, asks for no card and moves no money. `POST /v1/orders/:id/ship` is the seller tapping Mark as shipped and creates a fake tracking code. A pretend delivery follows when the buyer taps I received it, or after a short delay in development. Withdrawals write a pretend balance row. Every one of these writes `payment_provider = 'simulated'` or `shipping_provider = 'simulated'` so nothing can mistake them for real. Replacing them later changes only these handlers.

### Offers

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/v1/offers/quota` | Required | none | `{ limit, remaining, resetsAt }` | The "N offers left for today" line |
| POST | `/v1/conversations/:id/offers` | Party | `{ amountMinor }` | the offer | Buyer sends an offer. Must be above 0 and below the listing price. Counts toward the daily limit (`429 offer_limit_reached`). Only one pending offer per conversation. Writes an offer bubble |
| POST | `/v1/offers/:id/accept` | Party (the recipient) | none | the offer plus `reservedUntil` | Reserves the listing for the buyer, who then goes to checkout at this price |
| POST | `/v1/offers/:id/decline` | Party (the recipient) | none | the offer | |
| POST | `/v1/offers/:id/counter` | Party (the recipient) | `{ amountMinor }` | the new offer | The old offer becomes `countered`. The new one is a pending offer from the other side |
| POST | `/v1/offers/:id/withdraw` | Party (the sender) | none | the offer | |

### Bundles

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/v1/bundles` | Required | `{ sellerId }` | the open bundle | Create bundle on a profile. Returns the existing open bundle for this seller |
| PUT | `/v1/bundles/:id/items/:listingId` | Owner | none | bundle with running subtotal, discount and the next tier prompt | Add. Listing must belong to the bundle's seller and be active |
| DELETE | `/v1/bundles/:id/items/:listingId` | Owner | none | bundle | Remove |
| GET | `/v1/bundles/:id` | Owner | none | bundle with totals | "Add 2 items to get 5% off" comes from the tiers |

### Checkout and orders

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/v1/checkout/quote` | Required | `{ listingId } or { bundleId } or { offerId }`, `deliveryMethod?` | `{ items, itemsSubtotalMinor, bundleDiscountMinor, buyerProtectionFeeMinor, shippingMinor, totalMinor, currency, deliveryOptions }` | The numbers for the Price breakdown sheet and the Checkout total. Uses `calculateOrderTotals` and the active fee rule. Does not reserve anything |
| POST | `/v1/orders` | Required | `{ listingId } or { bundleId } or { offerId }`, `deliveryMethod`, `addressId`, `Idempotency-Key` header | the order (status `pending_payment`) | Locks the listing row, reserves it for 30 minutes, snapshots the totals. `409 listing_unavailable` if someone else got there first |
| GET | `/v1/orders` | Required | `?role=bought\|sold&status=all\|in_progress\|cancelled\|completed` plus page query | page of order rows | My orders. In progress means pending_payment, paid, shipped, delivered, disputed. Cancelled means cancelled and refunded |
| GET | `/v1/orders/:id` | Party | none | the order with items, totals, timeline (`order_events`), payment and shipment | |
| POST | `/v1/orders/:id/pay` | Party (buyer) | `Idempotency-Key` header | the order (status `paid`) | **SIMULATED.** Always succeeds. Creates a `payments` row with provider `simulated`. Marks the listings sold, adds a pending balance credit for the seller |
| POST | `/v1/orders/:id/ship` | Party (seller) | none | the order (status `shipped`) | **SIMULATED.** Mark as shipped. Creates a `shipments` row with provider `simulated` and a fake tracking code |
| POST | `/v1/orders/:id/confirm-received` | Party (buyer) | none | the order (status `completed`) | I received it. Records a delivered step first if there was none. Releases the seller's credit to available, leaves the automatic review, prompts both sides for feedback |
| POST | `/v1/orders/:id/cancel` | Party | `{ reason? }` | the order (status `cancelled`) | Allowed before shipping only. After payment it refunds the simulated payment and voids the credit. The listing becomes active again |
| POST | `/v1/orders/:id/dispute` | Party (buyer) | `{ details }` | the order (status `disputed`) | Within 2 days of delivery |
| POST | `/v1/admin/orders/:id/refund` | Moderator | `{ note? }` | the order | Resolves a dispute for the buyer |
| POST | `/v1/admin/orders/:id/release` | Moderator | `{ note? }` | the order | Resolves a dispute for the seller |

Background jobs (not routes): expire pending offers, release reservations after 30 minutes, cancel paid orders that were not shipped in 5 days, auto complete delivered orders after 48 hours, expire accepted offers after 24 hours.

### Reviews and balance

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/v1/orders/:id/reviews` | Party | `{ rating: 1 to 5, comment? up to 400 }` | the review | Leave feedback. A buyer's review replaces the automatic one |
| PUT | `/v1/reviews/:id/reply` | Owner (the reviewed person) | `{ body }` | the review | The Reply button |
| GET | `/v1/me/balance` | Required | none | `{ pending, available, currency }` | Sums of ledger rows |
| GET | `/v1/me/balance/entries` | Required | page query | page of ledger rows grouped by month | The Balance list |
| POST | `/v1/me/balance/withdrawals` | Required | `{ amountMinor }`, `Idempotency-Key` header | the ledger row | **SIMULATED.** Writes a negative available row. No bank is contacted |

## Milestone 6: Extras

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/v1/bump-plans` | Required | none | list of plans | Free in version 1 |
| POST | `/v1/listings/:id/bump` | Owner | `{ planId }` | the bump | Free. Sets `bumped_at` and `bumped_until`. In version 1 the price is 0 and the response says `payment: "free"` |
| GET | `/v1/me/bumps` | Required | page query | page of bumps with the listing | Promotional tools |
| GET | `/v1/me/badges` | Required | none | `{ earned, total, items }` | The Badges you earned card |
| PUT | `/v1/me/personalisation/brands` | Required | `{ brandIds }` | `{ brandIds }` | Follow brands |
| GET | `/v1/me/referral` | Required | none | `{ inviteCode, link, referrals, vouchers }` | Invite friends |
| POST | `/v1/referrals/redeem` | Required | `{ code }` | 204 | At sign up or first launch. Rejects your own code |
| GET | `/v1/me/vouchers` | Required | none | list | Applied at checkout in version 2 |
| GET | `/v1/me/bundle-discounts` | Required | none | list of tiers | Profile tab, Bundle discounts |
| PUT | `/v1/me/bundle-discounts` | Required | `{ tiers: [{ minItems, percentOff }] }` | list of tiers | |
| GET | `/v1/help/topics` | Public | none | static topics | Help Centre content can start as a bundled screen |
| GET | `/v1/listings/search-by-photo` | Required | multipart image | page of `listingCardSchema` | Deferred (open decision). Not in version 1 |

## Socket.IO

Real time messaging and live badges. Every event also exists as a REST read, so a missed event is repaired by refetching, and the app works with the socket down.

**Connection.** `io(BASE, { auth: { token: <session token> }, transports: ["websocket"] })`. The server checks the token against Better Auth during the handshake and rejects with `unauthenticated`. On connect the server puts the socket in the room `user:<userId>`.

**Rooms.**

| Room | Members | Used for |
|---|---|---|
| `user:<userId>` | All of one person's connected devices | Personal events: new messages anywhere, order updates, notifications, unread counts |
| `conversation:<conversationId>` | The two people, while they have the thread open | Typing indicators and read receipts |

**Client to server** (each has an acknowledgement callback `{ ok: true, ... }` or `{ ok: false, code, message }`):

| Event | Payload | Ack | Notes |
|---|---|---|---|
| `conversation:join` | `{ conversationId }` | `{ ok }` | Only parties may join. Called when a thread opens |
| `conversation:leave` | `{ conversationId }` | `{ ok }` | |
| `message:send` | `{ conversationId, clientMessageId, kind: "text" or "photo", body?, attachmentKey?, width?, height? }` | `{ ok, message }` | Same rules as the REST send. `clientMessageId` makes a retry safe |
| `conversation:read` | `{ conversationId }` | `{ ok }` | Moves the read marker |
| `typing` | `{ conversationId, isTyping: boolean }` | none | Not stored. Throttled to one per 2 seconds |

**Server to client:**

| Event | Room | Payload | Meaning |
|---|---|---|---|
| `message:new` | `user:<recipient>` and `conversation:<id>` | `{ conversationId, message }` | A message arrived, including system dividers and offer bubbles |
| `message:updated` | `conversation:<id>` | `{ conversationId, messageId, offer? }` | An offer bubble changed status (accepted, declined, countered, expired) |
| `conversation:updated` | `user:<userId>` | `{ conversationId, lastMessagePreview, lastMessageAt, unread }` | Reorders the inbox |
| `order:updated` | `user:<buyer>` and `user:<seller>` | `{ orderId, status, conversationId }` | Order moved. The app refetches the order |
| `notification:new` | `user:<userId>` | `{ notification }` | Prepends to the Notifications tab |
| `unread:count` | `user:<userId>` | `{ messages, notifications }` | The Inbox tab dot |
| `typing` | `conversation:<id>` | `{ conversationId, userId, isTyping }` | Other person is typing |
| `listing:updated` | `user:<userId>` | `{ listingId, status, priceMinor }` | A favourited or open listing changed price or sold |

Messages are written to Postgres first and broadcast after the transaction commits. If the recipient has no connected socket, a push is sent (see below) unless the thread is muted.

## Push notifications

Sent through the Expo push service to the tokens in `push_tokens`, respecting `user_settings.push_enabled`, the per type switches in `notification_preferences` and `push_daily_limit` (counted from `notifications.pushed_at`). Every push also creates a `notifications` row, which is what the Inbox shows. High priority types ignore the daily limit.

Payload: `{ title, body, data: { type, listingId?, orderId?, conversationId?, userId? } }`. The title and body are written server side in the person's language (`user_settings.language`). Tapping opens the screen named by `data`.

| Type | Group in settings | Opens | Sent when |
|---|---|---|---|
| `new_message` | High priority, New messages | The conversation | A message arrives and the recipient has no socket open on it |
| `new_offer` | High priority | The conversation | A buyer offers |
| `offer_accepted`, `offer_declined`, `offer_countered` | High priority | The conversation | The other side answered |
| `offer_expired` | Other | The conversation | An offer expired |
| `review_received` | High priority, New feedback | The reviews tab or the feedback form | Someone reviewed you |
| `favourite_price_drop` | High priority, Reduced items | The item | A favourited item got cheaper |
| `listing_favourited` | Other, Favourited items | The item | Someone hearted your item (grouped) |
| `favourite_sold` | Other, A favourite item is sold | The item | A favourite sold |
| `new_follower` | Other, New followers | The profile | Someone followed you |
| `followed_seller_new_item` | Other, New items | The item | A followed seller or brand listed something |
| `saved_search_match` | Other, New items | The search | A new listing matches a saved search |
| `order_paid` | High priority | The order thread | Your item sold (the seller) |
| `order_shipped`, `order_delivered` | High priority | The order thread | The buyer's order moved |
| `order_completed`, `balance_released` | Other | The order thread or Balance | The sale completed and the credit is available |
| `order_cancelled` | High priority | The order thread | The order was cancelled |
| `review_reminder` | Other | The feedback form | Two days after completion if no feedback yet |
| `referral_rewarded` | Other | Invite friends | A friend's first order completed |
| `listing_removed` | High priority | The item | A moderator removed your listing |
| `bump_ended` | Other | Own profile | A bump finished |
| `platform_message` | Other | An in-app page | A message from us, shown in the Inbox as the official row |

## Health

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health` | Public | `healthResponseSchema` |
| GET | `/health/db` | Public | `healthDbResponseSchema` |
