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
| Offers | 15 per rolling 24 hours per buyer (a business rule from `platform_settings.offer_daily_limit`, not just a rate limit) |
| Reports | 10 per hour |

## Milestone 1: Accounts

Goal: a person can create an account, sign in on the phone, finish their profile and set up their settings.

### Better Auth routes (`/api/auth/*`, handled by the library)

Configuration: Drizzle adapter on Postgres with `usePlural: true` and `generateId: "uuid"`, plugins `username`, `bearer`, `admin`, `emailOTP` and `expo`, social providers Google and Apple (switched on when their credentials are in the environment, the app sends the provider's ID token), email and password. Password reset, email confirmation and email change use a 6 digit code sent by email (valid 10 minutes, 5 tries, 5 code emails per hour per address) instead of a link, so they work on the phone without deep links. Rate limit as above. The app keeps the session in secure storage and sends it to `/v1` as the session cookie or as `Authorization: Bearer`. Face ID unlock is a phone feature that unlocks the stored session token and needs no route.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/sign-up/email` | Public | Create an account with email and password. No username is needed: the server makes one from the email (D-020, lowercase local part, digits added if taken). A `username` in the body is still accepted and checked. `name` is optional and starts as the username |
| POST | `/api/auth/sign-in/email` | Public | Sign in with email and password. Returns the session token |
| POST | `/api/auth/sign-in/social` | Public | Sign in with Google or Apple. The phone sends Apple's ID token. With `{provider, callbackURL}` and no token it answers `{url, redirect: true}`, the address at Google or Apple. The website calls it through its own address (the forward in `apps/web/proxy.ts` adds the header `x-vinty-web-origin`, honoured only for an address in `WEB_ORIGINS`), then Better Auth's `oAuthProxy` sends the person back to `<website>/api/auth/callback/<provider>/oauth-proxy` after the server's own callback, and that call sets the session cookie on the website's address |
| GET, POST | `/api/auth/callback/:provider` | Public | Where Google (GET) and Apple (POST, `application/x-www-form-urlencoded`, `response_mode=form_post`) send the person back. Always the server's address, the redirect address registered with them |
| GET | `/v1/auth/providers` | Public | `{apple, google, appleWeb}`: which buttons to show. `apple` and `google` are for the phone, `appleWeb` (Services ID `APPLE_CLIENT_ID` plus Apple's key values or `APPLE_CLIENT_SECRET`) is for the website. Cached 60 seconds |
| POST | `/api/auth/sign-out` | Required | End this session |
| GET | `/v1/auth/error` | Public | Friendly page (English and Hebrew, button back to the app) shown in the browser sheet when a Google or Apple login is refused. Better Auth redirects here through `onAPIError.errorURL` with `?error=<code>`. Known codes get a fixed message, anything else the generic one, the query is never printed. Its own tight Content Security Policy (style hash only), `Cache-Control: no-store` |
| GET | `/api/auth/get-session` | Optional | Current session and user |
| POST | `/api/auth/email-otp/send-verification-otp` | Public | Send the email confirmation code (also sent at sign up) |
| POST | `/api/auth/email-otp/verify-email` | Public | Confirm the email with the code |
| POST | `/api/auth/email-otp/request-password-reset` | Public | Email a password reset code |
| POST | `/api/auth/email-otp/reset-password` | Public | Set a new password with email, code and password |
| POST | `/api/auth/change-password` | Required | Change password, can revoke other sessions |
| POST | `/api/auth/email-otp/request-email-change` | Required | Send a code to the new address |
| POST | `/api/auth/email-otp/change-email` | Required | Confirm the new address with the code |
| GET | `/api/auth/list-sessions` | Required | Devices signed in (Settings, Security) |
| POST | `/api/auth/revoke-session` | Required | Sign one device out |
| POST | `/api/auth/revoke-other-sessions` | Required | Sign all other devices out |
| POST | `/api/auth/link-social` | Required | Add Google or Apple to an existing account |
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
| POST | `/v1/uploads` | Required | `uploadRequestSchema` | `uploadResponseSchema` | Presigned PUT address. Checks type and the declared size. The signature covers the content type only (phones stream the file without a length), so the size is checked again with a HEAD request when the key is saved on the profile. Purpose `avatar`, `listing_photo` or `message_photo` decides the folder. The response `headers` (content type and `Cache-Control: public, max-age=31536000, immutable`) must be sent with the PUT, file keys never change content |
| GET | `/v1/users/:id` | Optional | none | `publicProfileSchema` | Seller profile header. `viewer` shows whether the caller follows or blocked them |
| PUT | `/v1/users/:id/follow` | Required | none | 204 | Idempotent. Cannot follow yourself |
| DELETE | `/v1/users/:id/follow` | Required | none | 204 | |
| GET | `/v1/users/:id/followers` | Public | page query | `followListSchema` | The numbers on a profile are links to these |
| GET | `/v1/users/:id/following` | Public | page query | `followListSchema` | |
| PUT | `/v1/users/:id/block` | Required | none | 204 | Also removes the follow in both directions |
| DELETE | `/v1/users/:id/block` | Required | none | 204 | |
| GET | `/v1/me/blocks` | Required | page query | `followListSchema` | Settings, blocked members |
| DELETE | `/v1/me` | Required | `{ "password"?: string }` | 204 | Closes the account (Better Auth's own `delete-user` is not used because it deletes the row): sets `profiles.deleted_at`, clears personal fields, hides listings, keeps orders and reviews under an anonymous name. Blocked while an order is open |

Milestone 1 also ships three read only endpoints that belong to Milestone 3 on paper, because the Profile tab needs them: `GET /v1/users/:id`, `GET /v1/users/:id/listings` and `GET /v1/users/:id/reviews`. Their final shapes are `publicProfileSchema`, a page of `listingCardSchema` and `reviewsPageSchema`.

## Milestone 2: Selling

Goal: a seller can photograph, describe, price and publish an item, and manage their listings. Built in Milestone 2 (`apps/server/src/routes/listings.ts` and `reference.ts`, tests in `listings.test.ts`).

The selling rules live once in `packages/shared/src/listing-rules.ts` (`validateListing`) and run on both sides: the app shows inline errors with them, the server enforces them. A category's rules (brand, size, condition, colour, material, pattern: required, optional or hidden) come from the reference data. Values for rows the category hides are dropped on save. A brand that is not on the list is sent as `brandName` (2 to 60 characters, trimmed, spaces collapsed, control characters removed) with `brandId` empty. It saves into `listings.brand_name` with `brand_id` null, counts as a brand for the required rule, and the listing's `brand` comes back as `{ id: null, name }`. The app also posts it to `/v1/brand-requests` quietly so the team can add popular ones. Every rule message is a translation key under `validation.listing`, returned in `error.fields` keyed by the request field (`title`, `photos`, `categoryId`, `brandId`, `sizeId`, `conditionId`, `colourIds`, `materialId`, `patternId`, `priceMinor`, `parcelSizeId`).

Rules: title 3 to 80 characters (a draft may be empty), description up to 2,000, 1 to `listing_max_photos` (20) photos, a leaf category, a size from the category's size groups, up to 2 colours, a price from `listing_min_price_minor` (₪1) to ₪50,000 in agorot, a parcel size. Photos must be files the seller uploaded (key under `listings/<their id>/`, present in storage, at most 15 MB) or already on that listing.

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/v1/reference` | Public | none | `referenceDataSchema` | Built in Milestone 2 (listed under Milestone 1 above). `version` is a fingerprint of the content and doubles as the `ETag`. `If-None-Match` with the same value answers 304. `Cache-Control: public, max-age=3600`. Settings exposed: `default_currency`, `listing_max_photos`, `listing_min_price_minor`, `single_market` |
| GET | `/v1/brands` | Public | `?q&cursor&limit` | page of `brandSchema` | Built in Milestone 2. Empty `q` lists the most popular. Otherwise names that start with `q` first, then names with a word that starts with it. 120 a minute |
| POST | `/v1/brand-requests` | Required | `brandRequestInputSchema` (`{ name }`) | 204 | Request a brand that is not on the list. Stored in `brand_requests`, once per person and name. 10 an hour |
| GET | `/v1/pricing/preview` | Public | `pricePreviewQuerySchema` (`?priceMinor&currency=ILS`) | `pricePreviewSchema` | What the buyer pays for an item price under the active fee rule (5 percent): `{ priceMinor, currency, buyerProtectionFeeMinor, buyerPriceMinor }`. The sell form's live "Buyer pays" line. 120 a minute |
| POST | `/v1/listings` | Required | `createListingInputSchema` | 201 `listingDetailSchema` | `publish: false` saves a draft (the Save draft button and the Save in "Save changes before closing?"). `publish: true` runs the full rules and sets status `active` |
| GET | `/v1/me/listings` | Required | `myListingsQuerySchema` (`status`: draft, active, reserved, sold or hidden, cursor, limit) | `myListingsPageSchema` | Own page, newest change first. No `status` means everything except removed. `counts` gives the number in each state for the chips |
| GET | `/v1/me/listings/:id` | Owner | none | `listingDetailSchema` | Own view of any state. Feeds the own item page and the edit form |
| PATCH | `/v1/listings/:id` | Owner | `listingDraftInputSchema` | `listingDetailSchema` | Edits any field, `photos` replaces the photo list. A draft may stay unfinished, a live listing must stay complete. Changing the price of a live listing writes `listing_price_history`. Lowering it sets `previousPriceMinor` (the Price drop badge), raising it clears it. Sold listings cannot be edited (409) |
| PUT | `/v1/listings/:id/photos` | Owner | `{ photos: listingPhotoInput[] }` in display order | `listingDetailSchema` | Replaces the photo list. Position 0 is the cover. Files the seller uploaded and no longer uses are deleted from storage right after (best effort) |
| POST | `/v1/listings/:id/publish` | Owner | none | `listingDetailSchema` | Publishes a draft after the full rules. Anything but a draft answers 409 `invalid_transition` |
| PATCH | `/v1/listings/:id/status` | Owner | `updateListingStatusInputSchema` (`active`, `hidden`, `reserved`, `sold`) | `listingDetailSchema` | By hand: active to hidden, reserved or sold. Hidden to active. Reserved to active or sold. Anything else is 409 `invalid_transition`. A hand reservation holds the item for nobody in particular |
| DELETE | `/v1/listings/:id` | Owner | none | 204 | Deletes the listing, its photos and its storage files. A listing that is part of an order cannot be deleted (409), hide it instead |

**Card photos.** When a listing's photos are saved the server makes a small copy of each new photo (about 480 px wide, WebP, `cards/<key>.webp`) and a blurhash for `placeholder`, both fail-soft. In feed, search, own-list and buzz responses `cover.url` points at the small copy when it exists (`cover.key` stays the original's), while `GET /v1/listings/:id` returns `photos` with full-size urls. `GET /v1/jobs/photos` (also part of `/v1/jobs/all`, so the daily cron) makes missing copies for older photos in an 8 second slice per run.

### AI photo helper, text helper and search in plain words (D-028, D-036, D-037)

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/v1/sell/assist` | Public | none | `photoAssistStatusSchema` (`{ photoAssist, textAssist, searchAssist }`) | Whether each helper is on: the reader has a key (`ANTHROPIC_API_KEY`) and the master `ai` switch is on (see the AI cost meter). The app only asks the helpers when its flag is true, so they switch on and off without a new app build. If the switch lookup fails both answer false. `textAssist` and `searchAssist` are optional in the schema because older servers do not send them. `Cache-Control: public, max-age=60` |
| POST | `/v1/listings/suggest` | Required | `suggestRequestSchema` (`{ photoKeys: 1 to 4 keys, language: en or he }`) | `photoSuggestionSchema` | Reads photos the seller already uploaded (keys under `listings/<their id>/`, anything else is 400) with Claude Haiku (`PHOTO_READER_MODEL`, default `claude-haiku-5-5`) and suggests only `categories` (up to 3 real leaf categories, most likely first, each `{ id, confidence }` with confidence 0 to 1), `brand` (`{ id, name }`, `id` null when the tag text matches no brand we know) up to 2 `colourIds` and `photoTips` (D-036, see below). `materialId`, `title` and `description` are retired: they stay in the schema and are always `null`, because TestFlight build 3 requires the keys when it parses the answer. `language` is still accepted and ignored. Every id is checked against our lists and anything unknown is dropped. Always 200: with no key, no readable photo, a timeout (15 seconds) or any model error the body is the empty suggestion. 20 reads an hour per person (429 with `Retry-After`). `photoTips` is a list of `{ key, kinds }` for photos with a clear problem: `kinds` are `contact` (a phone number, email, social handle or messaging QR code is visible), `cut_off` (a meaningful part of the item is outside the frame, close-up detail shots are fine) or `dark` (too dark to see colour or details), in that order. The model flags photos by number and the server maps them back to the keys that were really sent (a photo that could not be read is skipped without shifting the others), dropping unknown numbers and kinds. It is `[]` in the empty suggestion. Usage tokens are logged, never photos or the key. Every read goes through the AI cost meter (see Admin panel): a switched off or over the cap AI answers with the empty suggestion |
| POST | `/v1/listings/photo-check` | Required | `photoCheckRequestSchema` (`{ photoKeys: 1 to 4 keys }`) | `photoCheckSchema` (`{ photoTips }`) | For photos added after the first read: tips only, no guesses, no catalog. Same ownership rule as suggest (keys under `listings/<their id>/`, anything else is 400). Always 200 with `{ photoTips: [] }` when the helper is off, refused by the AI meter, slow (10 seconds) or failed. 20 checks an hour per person (429 with `Retry-After`). Metered under the AI action `photo_tips` |
| POST | `/v1/listings/suggest-text` | Required | `textSuggestRequestSchema` (`{ title, description, language }`, at least 3 letters between title and description, otherwise 400) | `textSuggestionSchema` | Reads the title and description the seller typed (Hebrew, English or mixed) with Claude Haiku and suggests up to 3 `categories`, a `brand` (only one the seller named, a nickname like MK may be expanded, `id` null when unknown), a `conditionId` (only when the words say something about condition) and `colourIds` the words name. Codes are checked against our lists like the photo helper and unknown ones are dropped. The text goes to the model as data between markers and is never logged. Always 200 with the empty suggestion when the helper is off, refused by the AI meter, slow (10 seconds) or failed. 40 reads an hour per person (429 with `Retry-After`). Metered under the AI action `text_suggest` |
| POST | `/v1/search/understand` | Optional | `searchUnderstandRequestSchema` (`{ text: 1 to 100 characters, language }`) | `searchUnderstandingSchema` | Search in plain words (D-037): Claude Haiku turns a sentence such as "red summer dress under 100" into filters: `categoryId` (any category, a group such as Dresses included), `brandIds` with `brands` (`{ id, name }`, same order), `sizeIds`, `colourIds`, `conditionIds`, `materialIds`, `patternIds`, `priceMinMinor` and `priceMaxMinor` (the model answers whole shekels, the server multiplies by 100, drops negatives and swaps a reversed range), `sort` (only price_asc, price_desc or newest) and `q`, the few leftover words worth matching as text. `understood` is true when at least one filter or sort came out. The words go to the model as data between markers and are never logged. Open to signed out visitors. Always 200 with `EMPTY_SEARCH_UNDERSTANDING` when the helper is off, refused by the AI meter, slow (8 seconds), failed, over its limit, or when `searchNeedsUnderstanding(text)` is false (fewer than 3 words and no digit, no AI call then). Answers are remembered in memory per server copy (500 phrases, 24 hours, keyed by reference data version and the lower cased, space collapsed text) and a remembered phrase costs nothing and does not count toward the limit. Failures are not remembered. 20 new phrases an hour per person (signed in) or per address (signed out), over that the answer is the empty one, not 429, so the search falls back to the exact words. Also 30 requests a minute per address. Metered under the AI action `search_understand` |

The model is shown our leaf categories, colours and materials as text with short codes (C12, K3, M2) in a cached system block, and answers in a JSON schema. Brand matching ignores case, accents and punctuation and also tries the first words of a longer tag ("ZARA BASIC" finds Zara). The model is asked for its 3 most likely leaf categories, thinking about the exact type (boots, sneakers, sandals), the gender and the age group. The app never fills a field from this: it lists the guesses first inside its pickers (D-028).

Owner routes answer 404 for someone else's listing, so they cannot tell it exists. Writes are limited to 60 a minute.

Moved out of Milestone 2 (built in Milestone 9 as `PUT /v1/me/away-mode`): `PUT /v1/me/holiday-mode` goes to Milestone 6 (holiday mode is in Settings, not the sell flow). `GET /v1/me/listing-defaults` waits for shipping addresses (Milestone 5), until then the form starts with the Small parcel and the category's recommended size.

## Milestone 3: Discovery

Goal: find things. Feed, search, categories, the item page, people, brands and favourites.

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/v1/feed` | Optional | `?mood&categoryId&cursor&limit` | `homeFeedPageSchema`: page of cards with a `reason`, plus `feedId` | Home. Ranked by the learning feed of Milestone 7 (see below), the general score for visitors. Home's mood chips pass `mood`: `for_you` (the normal feed), `new_today` (listed in the last 24 hours), `under_50` (price below 5000 minor units, shekel listings only), `your_sizes` (one of the viewer's My sizes, empty when none or signed out), `near_you` (the listing's city equals the viewer's profile city, trimmed and case blind, empty without a city or signed out). A category passes `categoryId`, Trending `trending=true` |
| GET | `/v1/listings` | Optional | `searchFiltersSchema` plus page query | page of `listingCardSchema` plus `total`, `totalCapped` | Search and catalog. `q` is the text. Filters: `categoryId` (whole subtree), `categoryIds` (several categories at once, each with its subtree, used by the Browse tiles, up to 40), `brandIds`, `sizeIds`, `conditionIds`, `colourIds`, `materialIds`, `patternIds`, `priceMinMinor`, `priceMaxMinor`, `sellerId`, `sort` (relevance, newest, price_asc, price_desc). Excludes holiday mode sellers and blocked people |
| GET | `/v1/listings/count` | Optional | same filters | `{ total, totalCapped }` | Powers the Show results button count without loading cards |
| GET | `/v1/search/suggestions` | Optional | `?q=<text>` | `{ suggestions: [{ text, categoryId?, categoryName? }] }` | Autosuggest while typing: popular queries and brand and category matches, up to 10 |
| GET | `/v1/listings/:id` | Optional | none | `listingDetailSchema` | Item page. `viewer` tells the app which buttons to show. Counts a view (deduplicated per viewer per day). Sold and reserved listings still open |
| GET | `/v1/listings/:id/similar` | Optional | page query | page of `listingCardSchema` | More like this |
| GET | `/v1/users/:id/listings` | Public | `?status=active\|sold` plus page query and filters | page of `listingCardSchema` | Profile, Listings tab (the Filter link uses `searchFiltersSchema`) |
| GET | `/v1/users/:id/reviews` | Public | `?source=all\|member\|automatic` plus page query | `{ summary, items }` | Reviews tab with the member and automatic scores. The app asks for `source=member` and reads `summary.automatic.count` for the "smooth sales" line (Milestone 6). Item schema in M5 |
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
| POST | `/v1/reports` | Required | `{ targetType, targetId, reason, details? }` | 204 | Item "..." menu Report, profile report. Rate limited. After it is stored a model sorts it in the background (D-038, see Admin panel) |
| PUT | `/v1/me/personalisation/sizes` | Required | `{ sizeIds: uuid[] }` | `{ sizeIds }` | Replaces the list. Brands are M6 |

### Milestone 3 notes (as built)

Routes: `apps/server/src/routes/discovery.ts` (feed, search, suggestions, item page, similar, members), `engagement.ts` (favourites, saved and recent searches, reports, sizes), `users.ts` (profile Listings tab). Shared schemas in `packages/shared/src/discovery.ts`, the query logic in `apps/server/src/lib/discovery.ts`. Tests: `discovery.test.ts`, `engagement.test.ts`.

- **Query strings.** Id lists (`brandIds`, `sizeIds`, `conditionIds`, `colourIds`, `materialIds`, `patternIds`) go as `brandIds=a,b` or as repeated keys. Schema: `searchQuerySchema` (filters plus page query), `searchFiltersQuerySchema` (filters only). The same filters as JSON (`searchFiltersSchema`) are what saved and recent searches store.
- **Cards.** Feed, search, similar and favourites cards carry `seller` (a `userSummarySchema`), `sizeLabel`, `conditionSlug` and, for a signed in viewer, `isFavourited`. The profile Listings tab omits `seller`. Pages are `feedPageSchema` (items and `nextCursor`), search adds `total` and `totalCapped` (`searchPageSchema`). Cursors are opaque, pass them back unchanged. A cursor that cannot be read starts again from the top.
- **Who is visible.** Feed and search show `active` and `reserved` listings (the card status says which). Sellers on holiday mode, closed accounts and blocked people (either direction) are left out. A profile Listings tab (`/v1/users/:id/listings`) still shows a holiday seller's items. `/v1/listings?sellerId=` does not.
- **Feed order.** Newest first (`bumped_at`). Signed in with Settings, Privacy, personalised feed on, every match makes an item look 6 hours newer: +4 a seller the person follows, +3 a category they favourited, +2 a brand they favourited or follow, +2 one of their personalisation sizes. Your own items are not in your feed. `trending=true` orders by hearts times 5 plus views, then newest. `categoryId` takes the whole subtree (Designer is a top level category, so it is a `categoryId` chip).
- **Search.** Every word of `q` must match, as the start of a word in the title, brand or description (Postgres full text, `simple` configuration) or as a piece anywhere in the title or brand (plain substring). No stemming, so Hebrew quality is still the deferred open decision 4. Relevance puts title hits and text rank first, then newest. Without `q` relevance is newest. `total` counts up to 500 (`totalCapped` true means more). `/v1/listings/count` takes the same filters without the page query.
- **Suggestions.** Up to 10 of: searches that at least 3 different people made, brands, categories (matched in both languages). Each has `kind` (`query`, `brand`, `category`), plus `categoryId` and `categoryName` or `brandId`.
- **Item page.** `listingDetailSchema` gained `sellerOnHoliday`. `viewer` has `isOwner`, `isFavourited`, `canBuy` and `canOffer` (true for an active item that is not yours and whose seller is not on holiday, `canBuy` is also true for the person a reserved item is held for). Buying and offers themselves arrive in Milestone 5. `conversationId` stays null until Milestone 4. Drafts and hidden listings answer 404 to everyone but the owner, removed ones to everyone, and a blocked pair sees 404. A view counts once per viewer per day (`listing_views`), the owner's own views are not counted.
- **Similar.** Items from the same category group (the parent's subtree), ordered newest with +3 for the same category, +2 the same brand and +1 a price within 40 percent.
- **Favourites.** PUT is idempotent and returns the count. Your own item is `403 forbidden`, a draft, hidden or unknown listing is 404, a new heart on a sold item is `409 listing_unavailable`. DELETE is idempotent, 404 only for an unknown listing. The seller gets one `listing_favourited` notification per item, grouped: more hearts while it is unread raise `data.count`. `favourite_sold` is written by the Milestone 5 order flow (see the Milestone 5 notes). `favourite_price_drop` belongs to the price edit flow and is not written yet.
- **Lists.** Saved searches and recent searches answer `{ items }` (no cursor, 50 and 10 at most). Saving the same search twice returns the existing one (200 instead of 201), a 51st is `409 conflict`, a search with no words and no filter is 400. `notifyOnNew` alerts are sent by Milestone 4 notifications.
- **Reports.** 204 and one open report per person and target (sending it again changes nothing). You cannot report your own listing or yourself (400), a message only from inside its conversation, a review only by the person it is about. 10 an hour.
- **Personalisation sizes.** `GET` was added next to `PUT /v1/me/personalisation/sizes`, both answer `{ sizeIds }`. Unknown sizes are 400.
- **Not built.** `GET /v1/users/:id` follow and block routes from Milestone 1 do not exist yet, so the follow boost uses the `follows` table as the seed fills it.

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

### Milestone 4 notes (as built)

Routes: `apps/server/src/routes/messages.ts` (inbox, chats, messages), `routes/notifications.ts` (unread, notifications, push tokens). Socket: `plugins/messaging.ts`. Shared rules for REST and socket: `lib/messaging.ts` (sending, reading, unread). Notifications and push policy: `lib/notify.ts`. Pusher: `lib/push.ts`. Shared schemas and socket event types: `packages/shared/src/messaging.ts`. Tests: `routes/messages.test.ts`, `routes/notifications.test.ts`, `push.test.ts`, `realtime.test.ts`.

- **Inbox rows.** `conversationRowSchema` adds `lastMessageKind` (`text`, `photo`, `offer`, `system`) and `role` (`buyer` or `seller`). `lastMessagePreview` is only filled for text, the app draws "Photo", offers and dividers from the kind. A chat with no message yet is left out of the inbox, so tapping Ask seller and leaving leaves no empty row. Archived and not archived are per person (`archived=true` lists the archive).
- **Create.** `POST /v1/conversations` answers 201 for a new chat and 200 for the existing one, with `conversationDetailSchema` either way. An optional `body` sends the first message (with an optional `clientMessageId`). Yourself is `403 forbidden`, a block either way is `403 blocked`, a draft, hidden, removed or unknown listing is 404, a new chat about a sold item is `409 listing_unavailable` (old chats stay open).
- **Detail.** `conversationDetailSchema` is the row plus `listing.buyerPriceMinor`, the other person's `city`, `countryCode` and `lastSeenAt` (null when they hide it), `order` (newest order from this chat, null for now) and `blocked` (a block exists either way: the thread opens but sending is `403 blocked`) and `otherLastReadAt` (when the other person last read the thread, the app shows "Seen").
- **Messages.** Page size default 30. Cursors are opaque and carry microsecond times, so nothing is skipped or repeated. Offer bubbles come with `offer` (current status) so the app already copes with the seeded ones. Sending: `201` for a new message, `200` with the stored message for a repeated `clientMessageId`. Text is trimmed, 1 to 4000 characters. A photo needs a key from `POST /v1/uploads` with purpose `message_photo` (folder `messages/<userId>/`), it must exist in storage and be at most 10 MB. Sending counts as reading, and a new message moves an archived chat back to the inbox for both people.
- **Limits.** 60 messages a minute per person and 20 a minute per person per chat, shared by REST and socket (`429 rate_limited` with a `Retry-After` header in seconds). A repeat of a stored `clientMessageId` is answered before the limit and the block check.
- **Unread.** A chat is unread when the other person (or the system) wrote after your read marker. `GET /v1/me/unread` `messages` counts unread chats and leaves out muted and archived ones. `notifications` counts unread rows of the Notifications tab.
- **Notifications tab.** `new_message` rows exist (one per chat while unread, `data.count` grows) because the daily push limit counts `pushed_at`, but they are hidden from `GET /v1/me/notifications` and from the red dot: messages already live in the Messages tab. This differs from "every push creates a row the Inbox shows". A muted chat creates no row and no push. `POST /v1/me/notifications/read` with ids only touches your own rows.
- **Push tokens.** `POST /v1/me/push-tokens` takes the phone over if another person registered it before and clears an earlier revoke. `DELETE /v1/me/push-tokens/:token` (URL-encode the token, it contains brackets) is idempotent.
- **Push rules (`lib/notify.ts`).** In order: master switch `push_enabled`, the per type push preference (default on), the daily limit (a rolling 24 hours of `notifications.pushed_at`, high priority types in `HIGH_PRIORITY_NOTIFICATION_TYPES` ignore it but still count), at least one live token. For messages, also: the chat is not muted and the recipient has no device with the thread open (joined its socket room). Text is written in `user_settings.language`. Expo answers `DeviceNotRegistered` revoke the token. `PUSH_TRANSPORT=log` (default) writes the push to the server log instead of sending it. Only `new_message` is wired to push so far, other types plug in through `notifyUser`. The favourite notification now goes through `notifyUser` (grouped per item, socket `notification:new`, no push text yet).
- **Socket.** See the Socket.IO section. Additions to it: `conversation:read` server event (`{ conversationId, userId, readAt }`, to the thread room, the read receipt), `lastMessageKind` in `conversation:updated`, and the server sends `unread:count` right after connecting. `message:new` also goes to the sender's own rooms (other phones, and the sending phone: match by message id or `clientMessageId`). Handshake errors arrive as `connect_error` with message `unauthenticated`. The session is checked once at connect. `message:updated`, `order:updated` and `listing:updated` are emitted from Milestone 5 on (see its notes).
- **Listing detail.** `viewer.conversationId` is now filled for a buyer who already has a chat about the item.

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

### Milestone 5 notes (as built)

Routes: `routes/offers.ts`, `routes/orders.ts` (checkout, orders, support, development helpers), `routes/bundles.ts`, `routes/reviews.ts` (reviews and balance), `routes/addresses.ts`. Rules live in `lib/offers.ts`, `lib/checkout.ts`, `lib/orders.ts` (every order move goes through `transitionOrder`), `lib/bundles.ts`, `lib/reviews.ts`, `lib/wallet.ts`, `lib/thread.ts` (dividers and bubbles in the chat, broadcasts), `lib/event-notify.ts` (push sentences), `lib/order-jobs.ts` (background jobs). Shared schemas: `packages/shared/src/orders.ts` (offers, bundles, checkout, orders, balance), `reviews.ts`, `messaging.ts` (socket event types). State machine helpers added in `state-machines.ts`: `canActorCancel`, `cancelReasonFor`, `isWithinDisputeWindow`, `orderActionsFor`. Tests: `routes/offers.test.ts`, `routes/orders.test.ts`, `routes/reviews.test.ts`, `order-realtime.test.ts`.

**Offers**
- Quota: only offers a person sends as the buyer count (their own counters to a seller's counter count too, a seller's counters do not). `GET /v1/offers/quota` is `offerQuotaSchema`, `resetsAt` is when the oldest offer in the 24 hours frees a slot (now plus 24 hours when none were sent). `429 offer_limit_reached` carries `error.resetsAt` and a `Retry-After` header.
- `POST /v1/conversations/:id/offers` is only for the buyer of that chat (the seller gets `403 forbidden`, a stranger 404). Amount must be above 0 and below the listing price (`400 validation_failed`, `fields.amountMinor` is `validation.offer.positive` or `validation.offer.belowPrice`). The item must be `active`, otherwise `409 listing_unavailable`. A second pending offer in the chat is `409 conflict`. Answer `201` with `offerSchema`.
- Accept, decline, counter, withdraw answer with `offerSchema`. Counter answers `201` with the new offer (the one waiting for the other person), the old one is `countered` and the new one has `parentOfferId`. The wrong side is `403 forbidden`, a finished offer `409 invalid_transition`, a stranger 404. An unanswered offer past `expiresAt` is turned into `expired` on the spot and the call is `409 invalid_transition`.
- Accept reserves the listing for the buyer for `accepted_offer_hold_hours` (24): `listing.status = reserved`, `reservedForUserId`, `reservedUntil`. The offer's `expiresAt` becomes the end of that hold and `reservedUntil` in the response says the same. A hold that runs out without an order expires the offer and puts the item back on sale.
- The thread gets an `offer` bubble for every new offer and a `system` divider for every answer (`offer_accepted`, `offer_declined`, `offer_countered`, `offer_withdrawn`, `offer_expired`) with `payload` `{ offerId, amountMinor, currency, title }`. `message:updated` carries the bubble's new `offer` (`messageOfferSchema`).

**Checkout and orders**
- `POST /v1/checkout/quote` answers `checkoutQuoteSchema`. Both delivery methods cost the biggest parcel's postage in version 1. `addressId` is required for `home`, optional for `pickup_point` (there is no pickup point picker yet, an address given is kept). The address routes of Milestone 1 (`/v1/me/addresses`) were missing and are built now, with a limit of 10.
- `POST /v1/orders` answers `orderDetailSchema`, `201` for a new order and `200` when the same `Idempotency-Key`, or the same buyer opening checkout again for the same items, finds the order that already waits. A different checkout for the same item cancels the old waiting one. The item is held for `checkout_hold_minutes` (30), `payByAt` says until when. A chat about the first item is created when there is none, so the order dividers have a thread. An offer must be `accepted` and not run out, and belong to the caller. A bundle must be the caller's and open.
- A seller does not see an order before it is paid: `GET /v1/orders/:id` is 404, the Sold tab leaves it out and so does `order` in the conversation detail.
- `orderDetailSchema` adds to the list row: both people, items, all money fields, `shippingAddress` (a copy from checkout), `payment` and `shipment` (with `simulated: true`), `timeline`, the milestone times, `actions` (what this person can do now: `pay`, `cancel`, `ship`, `confirm_received`, `open_dispute`), `canReview` and `reviews: { mine, theirs }`. `sellerEarningsMinor` is null for the buyer.
- `POST /orders/:id/pay` is idempotent by nature: paying a paid order answers `200` with it and charges nothing again (the `Idempotency-Key` header is accepted and not needed). Paying after the hold ran out cancels the order (`payment_expired`) and answers `409 invalid_transition`.
- Moves: only the buyer pays, confirms and disputes (the seller gets `403 forbidden`), only the seller ships. `confirm-received` on a shipped parcel records `deliver` first, then `confirm_received` (both in the timeline). Cancel is allowed to the buyer before shipping and to the seller after payment and before shipping (a seller has nothing to cancel before payment). Dispute is allowed from shipped or delivered, up to 48 hours after delivery. Support: `POST /v1/admin/orders/:id/refund` (disputed to refunded, item back on sale) and `/release` (disputed to completed, credit available, no automatic review). Both are for users with role `moderator` or `admin`, `403` for anyone else.
- When an order completes (`confirm_received`, `auto_complete`): the seller's pending credit becomes available, a 5 star automatic review is left for the seller (`review_auto_left` divider), the seller gets `order_completed` and `balance_released`, the buyer `order_completed`.
- Dividers in the thread (`system_event`): `order_paid`, `order_shipped`, `order_delivered`, `order_completed`, `order_cancelled`, `order_disputed`, `order_refunded`, `review_auto_left`, each with `orderId` and `payload` `{ orderNumber, title, itemCount }` (plus `reason` on cancelled, `details` on disputed). A buyer who confirms a parcel in transit sees only `order_completed`.

**Notifications** (all through `notifyUser`, so the push rules apply; the push sentence is written in `lib/event-notify.ts`; the Notifications tab writes its own from `type` and `data`)

| Type | To | `data` | Ids on the row |
|---|---|---|---|
| `new_offer` | seller | `offerId`, `amountMinor`, `currency`, `listingPriceMinor`, `title` | listing, conversation, actor (buyer) |
| `offer_accepted`, `offer_declined`, `offer_countered` | the person who made the offer | `offerId`, `amountMinor` (the new amount for a counter), `currency`, `listingPriceMinor`, `title` | listing, conversation, actor |
| `offer_expired` | both | same as above | listing, conversation |
| `order_paid` | seller | `orderNumber`, `title`, `itemCount`, `amountMinor` (their earnings), `currency` | order, listing, conversation, actor (buyer) |
| `order_shipped` | buyer | `orderNumber`, `title`, `itemCount`, `trackingCode` | order, listing, conversation |
| `order_delivered` | buyer | `orderNumber`, `title`, `itemCount` | order, listing, conversation |
| `order_completed` | seller and buyer | `orderNumber`, `title`, `itemCount`, `role` (`seller` or `buyer`, whose notification it is) | order, listing, conversation |
| `balance_released` | seller | `orderNumber`, `title`, `itemCount`, `amountMinor`, `currency` | order |
| `order_cancelled` | the other person (both when the system cancels) | `orderNumber`, `title`, `itemCount`, `reason` (an `order_cancel_reason`, or `refunded` after support refunded), `byRole` | order, listing, conversation |
| `review_received` | reviewed person | `orderId`, `rating`, `title`, `role` (the reviewer's role) | order, conversation, actor (reviewer) |
| `review_reminder` | each side without feedback, 2 days after completion (once) | `orderNumber`, `title`, `role` | order, conversation |
| `favourite_sold` | people who hearted a sold item | `title` | listing |

A dispute has no notification type of its own, the other person sees the `order_disputed` divider and the `order:updated` event. `favourite_price_drop` is not written yet.

**Socket.** Every offer and order event goes to the two people's `user:` rooms and the thread room and to nobody else. `message:new` (bubbles and dividers) and `message:updated` (bubble status) also go to both `user:` rooms, so a thread that is not open stays right. `order:updated` `{ orderId, status, conversationId }` goes to the buyer and, once the order is paid, the seller. `listing:updated` `{ listingId, status, priceMinor }` goes to the seller, whoever hearted the item and whoever chats about it, when it is reserved, sold or back on sale.

**Reviews and balance**
- `POST /v1/orders/:id/reviews` answers `201` with `reviewItemSchema`, which now also has `orderId` and `reviewerRole` (`GET /v1/users/:id/reviews` returns the same). Only for a completed order, once per person per order (`409 conflict`). A buyer's review turns the automatic one into a member review (same row, `isAutomatic` false, counters move from automatic to member). Comments are trimmed, up to 400 characters.
- `PUT /v1/reviews/:id/reply` is for the reviewed person (404 for anyone else), replaces an earlier reply, and `409 conflict` on an automatic review.
- `GET /v1/me/balance` is `balanceSchema`. `GET /v1/me/balance/entries` is a page of `balanceEntrySchema` newest first with `month` (`YYYY-MM`, UTC) for the grouping, `orderNumber`, `status` (`void` rows are cancelled sales). `POST /v1/me/balance/withdrawals` answers `201` (`200` for a repeated key), `400` with `fields.amountMinor = validation.withdrawal.tooMuch` when it is more than `available`. Concurrent withdrawals cannot overdraw.

**Bundles.** `POST /v1/bundles` answers `201` or `200` with `bundleSchema`. Items must be the seller's, `active` (or held for the buyer), adding twice changes nothing. The ladder is the seller's `bundle_discount_tiers` (set by the seller in Milestone 6, the sample sellers have the default 5, 10, 15 percent), `nextTier` is `{ addItems, percentOff }`. Items that were sold meanwhile stay in `items` with their status and do not count towards the totals. Checking out with `bundleId` applies the discount to the order, and paying marks the bundle `ordered`.

**Background jobs** (`lib/order-jobs.ts`, run every `JOBS_INTERVAL_SECONDS`, default 30, by `plugins/jobs.ts`): pending offers expire, accepted offers expire after the hold (unless an order uses them), unpaid checkouts cancel after the hold (`payment_expired`), held items without an order go back on sale, paid orders not shipped by `shipByAt` cancel (`shipping_timeout`), delivered orders complete at `autoCompleteAt` (`auto_complete`), review reminders. Every step locks its row, so running twice is safe.

**Pretend delivery in development.** Shipping an order starts a timer: after `SIMULATED_DELIVERY_SECONDS` (default 45 in development, off elsewhere, `0` turns it off) a job moves the order from `shipped` to `delivered` (buyer gets `order_delivered`, `autoCompleteAt` is 48 hours away). It only picks up parcels shipped in the last hour, so the older sample orders stay as they are. To not wait: `POST /v1/dev/orders/:id/deliver` (either person of the order, not registered when `NODE_ENV` is `production`). The buyer's "I received it" works on a shipped or a delivered order.

**Sample data.** `pnpm db:reset` gives `oliver.smith`, `tamar.avraham` and `noa_levi` offers in every state (pending, accepted and reserved, declined, countered, withdrawn, expired) as buyer and as seller, orders as buyer and seller in paid, shipped, delivered, completed and cancelled (plus `pending_payment` for oliver and a refunded one for tamar), member and automatic reviews with replies, and a balance with pending, available and a pretend withdrawal. Sample checkouts waiting for payment hold the item for 12 hours, sample delivered orders complete by themselves after 3 days.

## Milestone 6: Extras

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/v1/bump-plans` | Required | none | `{ items }` of plans (id, slug, name en/he, durationHours, priceMinor, currency), shortest first | Free in version 1. Built (Buzz) |
| POST | `/v1/listings/:id/bump` | Owner | `{ planId }` | the bump (`201`) | Free. Sets `bumped_at` and `bumped_until`. In version 1 the price is 0 and the response says `payment: "free"`. Built. Not the owner or not found is `404`, an item that is not `active` or is already buzzing is `409`, an unknown plan is `400` |
| GET | `/v1/me/bumps` | Required | page query | page of bumps with the listing and plan (`isActive`), newest first | Promotional tools. Built, shown as "Your buzzes" on the own profile |
| GET | `/v1/me/badges` | Required | none | `{ earned, total, items }` | The Badges you earned card |
| PUT | `/v1/me/personalisation/brands` | Required | `{ brandIds }` | `{ brandIds }` | Follow brands |
| GET | `/v1/me/referral` | Required | none | `referralSummarySchema`: `{ inviteCode, link, rewardMinor, minOrderMinor, currency, invitedBy, canRedeem, referrals, vouchers }` | Invite friends. Built in Milestone 9. Makes the person's code the first time (also for accounts older than the feature) |
| POST | `/v1/referrals/redeem` | Required | `{ code }` | 204 | Built in Milestone 9. Entered on the Invite friends screen (not at sign up, so Apple and Google sign in work the same). 404 unknown code, 400 `own_code`, 409 already invited, 403 account older than 7 days or with a completed purchase. 10 a minute |
| GET | `/v1/me/vouchers` | Required | none | list of `voucherSchema` | Built in Milestone 9. Shown, not applied at checkout (version 2). An active voucher past its date is shown as `expired` |
| GET | `/v1/me/bundle-discounts` | Required | none | list of tiers | Profile tab, Bundle discounts |
| PUT | `/v1/me/bundle-discounts` | Required | `{ tiers: [{ minItems, percentOff }] }` | list of tiers | |
| GET | `/v1/help/topics` | Public | none | static topics | **Not built, on purpose.** The Help Centre is bundled in the app (Settings, Help): the words are in the locale files under `help.*` and the list of articles is `apps/mobile/lib/help-topics.ts`. A server route can come later if the articles ever need to change without an app update |
| GET | `/v1/me/away-mode` | Required | none | `awayModeSchema`: `{ enabled, startedAt, endsAt }` | **Built (Milestone 9).** Away mode (holiday mode in the tables). A past `endsAt` reads as off |
| PUT | `/v1/me/away-mode` | Required | `awayModeInputSchema`: `{ enabled, endsAt? }` | `awayModeSchema` | **Built (Milestone 9).** Replaces `PUT /v1/me/holiday-mode`. `endsAt` is optional (no date means away until switched off), must be in the future and at most 90 days away (`AWAY_MAX_DAYS`), else `400` with field `endsAt` = `validation.away.past` or `validation.away.tooFar`. Switching on again keeps the first `startedAt`. `enabled: false` clears all three columns |
| GET | `/v1/listings/search-by-photo` | Required | multipart image | page of `listingCardSchema` | Deferred (open decision). Not in version 1 |

**Buzz (built, Milestone 9).** `POST /v1/listings/:id/bump` locks the item row, so two taps make one buzz, and writes a `bumps` row (`payment_provider` free, price 0). An item counts as buzzing only while `bumped_until` is in the future (the cards, discovery and the feed all compare it with the clock, so nothing waits for a job). The own card and the own item view also carry `bumpedUntil` for "Ends ...". The end step (`endFinishedBuzzes` in `lib/bumps.ts`) runs hourly in the in-process timers, in `/v1/jobs/all` and alone at `/v1/jobs/buzz-end`: it clears `bumped_until` and sends `bump_ended` once to the seller if the item is still for sale (clearing and reading is one statement, so running twice never tells twice). `bumped_at` keeps its value, so the item does not drop back down the feed. There is no daily cap while buzz is free (open decision 13 in `data-model.md`).

### Invite friends notes (as built, Milestone 9)

- **Codes.** 8 letters and digits without look-alikes (no 0, O, 1, I, L), unique in `profiles.invite_code`. Typed in any case, with spaces or dashes. The link is `BETTER_AUTH_URL/invite/<code>`, a public page in English and Hebrew with the code and a button back to the app (`lib/invite-page.ts`, same look and policy as `/v1/auth/error`). The real domain comes later.
- **Who can enter a code.** The account must be at most 7 days old and have no completed purchase, must not already be invited, and the code cannot be their own.
- **Reward.** When an order completes (`transitionOrder`, events `confirm_received`, `auto_complete`, `release`), if the buyer has a `pending` referral and the order's items total (after the closet deal) reaches `referral_min_order_minor`, the referral becomes `rewarded` and both people get a voucher of `referral_reward_minor` (50 shekels), valid 90 days, in the same transaction. An earlier order under the minimum does not use up the invite. Both get a `referral_rewarded` notification (`data.role` is `inviter` or `invitee`) and a push. No wallet entry is written, vouchers are not money.

**Away mode (Milestone 9).** `lib/away.ts` holds the rule once: a seller is away when `holiday_mode_enabled` is true and `holiday_ends_at` is empty or still in the future. Feed, search, the item page (`sellerOnHoliday`, `canBuy`, `canOffer`), checkout and the public profile all read it, so a past return date counts as back even before a job has run. The step `endExpiredAwayMode` (inside `runOrderJobs`, so it runs in the in-process timers and in `/v1/jobs/orders` and `/v1/jobs/all`, result field `awayEnded`) then switches the flag off for good. While away: chats still open and messages go through, but the item page hides Buy and Make an offer and checkout answers `409 listing_unavailable`. Offers that were already pending or accepted stay as they are: the seller can still answer them, and a buyer cannot pay until the seller is back, so an accepted offer's 24 hour hold may run out first.

## Milestone 7: A home feed that learns

Plan: `docs/plans/home-feed.md` (Eden's decisions are in its section 9). Schema: `user_events`, `user_affinities`, `feed_hidden`, `feed_snapshots` and the view `listing_popularity_7d` in `data-model.md`. Shared: `packages/shared/src/recommendations.ts` (weights, fading, price bands, variety) and `events.ts` (batch and hide schemas). Server: `lib/events.ts` (`recordEvents`), `lib/feed.ts` (piles, score, snapshot), `lib/feed-jobs.ts`, `routes/events.ts`, `routes/jobs.ts`. Tests: `lib/feed.test.ts`, `routes/events.test.ts`, `packages/shared/src/recommendations.test.ts`.

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/v1/feed` | Optional | `?mood&categoryId&trending&cursor&limit` | `homeFeedPageSchema` | See the notes. Each card has `reason` (`{ kind, name }` or null), the page has `feedId` (null for Trending) |
| POST | `/v1/events` | Required | `eventBatchSchema`: `{ events: [{ clientEventId, type, listingId?, categoryId?, surface?, position?, feedId?, occurredAt?, data? }] }`, 1 to 50 | `{ recorded, skipped }` | Only what the phone sees: `impression`, `listing_dwell`, `category_visit`. 200 actions per person per minute, over that is `429 rate_limited` with `Retry-After` |
| POST | `/v1/feed/hide` | Required | `hideInputSchema`: `{ scope: item\|seller\|brand\|category, targetId }` | `hiddenItemSchema`, 201 (200 if already hidden) | "Not interested". Also counts as weight -3 on that thing. Your own item or yourself is 404 |
| GET | `/v1/feed/hidden` | Required | none | `{ items: hiddenItemSchema[] }` | Settings list of hidden things, newest first, up to 200 |
| DELETE | `/v1/feed/hidden/:id` | Owner | none | 204 | Undo a hide |
| DELETE | `/v1/me/personalisation` | Required | none | 204 | Reset my recommendations: clears the taste profile, the action history and the saved feed lists. Hearts, sizes, followed brands and sellers, and hides stay |
| POST | `/v1/me/onboarding-picks` | Required | `onboardingPicksSchema`: `{ picks: ("women"\|"men"\|"kids")[] }` | 204 | The first question after sign up. An empty list is a skip. Counts as weight 3 per pick, once per pick |
| GET, POST | `/v1/jobs/feed-popularity` | Secret | none | `{ ok }` | Re-counts "popular this week". For a scheduler |
| GET, POST | `/v1/jobs/feed-cleanup` | Secret | none | `{ ok, events, impressions, snapshots, fadedAffinities, extraAffinities }` | The nightly cleanup. For a scheduler |

### Scheduler endpoints (Milestone 8)

Vercel does not keep a server running, so the timers in `plugins/jobs.ts` are off there and Vercel Cron calls these instead (`apps/server/vercel.json`). All of them are `GET` or `POST`, need `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends exactly that when the project has a `CRON_SECRET` variable), answer 404 when `CRON_SECRET` is not set and 401 for a wrong or missing secret, and are safe to run twice (every step locks its row). Rate limit 30 a minute (10 for `all`).

| Method | Path | Does | Answer | Cron schedule (UTC) |
|---|---|---|---|---|
| GET, POST | `/v1/jobs/orders` | `runOrderJobs`: expire pending and accepted offers, cancel unpaid checkouts, release held items, cancel unshipped orders, pretend delivery (only when `SIMULATED_DELIVERY_SECONDS` is set), auto complete delivered orders, review reminders | `{ ok, offersExpired, acceptedOffersExpired, unpaidCancelled, reservationsReleased, unshippedCancelled, pretendDelivered, autoCompleted, reviewReminders }` | every minute |
| GET, POST | `/v1/jobs/feed-popularity` | Re-count "popular this week" | `{ ok }` | every 15 minutes |
| GET, POST | `/v1/jobs/feed-cleanup` | The nightly cleanup | `{ ok, ...counts }` | 03:00 every day |
| GET, POST | `/v1/jobs/all` | All three in one call, for a plan that only allows one cron run a day (Vercel Hobby) | `{ ok, orders, cleanup }` | not scheduled by default |

Per minute and per 15 minute crons need Vercel Pro (Hobby allows one run a day and a deploy with a faster cron fails). On Hobby replace the three crons with one `{ "path": "/v1/jobs/all", "schedule": "0 3 * * *" }`: offers and holds then expire up to a day late. Cron delivery is best effort, so a missed minute is simply caught by the next run.

### Milestone 7 notes (as built)

- **What the server records itself** (the app sends nothing for these), each with one `recordEvents()` call in the handler that already sees it: open an item (`GET /v1/listings/:id`, weight 1, or 2 as `listing_open_repeat` when the same person opened it on an earlier day), heart (+4) and remove heart (-4) in `engagement.ts`, save a search (3) and a submitted search (`POST /v1/me/recent-searches`, 1), the buyer's first message in a chat (5, `lib/messaging.ts`, so the socket counts too), make an offer (6, `lib/offers.ts`), buy (8, when the order is paid, `routes/orders.ts`). The server copies the item's features into the event, so the app cannot fake them. Nothing is recorded for your own listing, for a visitor, or when Settings, Privacy, personalised feed is off.
- **What the app sends** (`POST /v1/events`, weights in `EVENT_WEIGHTS`): `impression` when a card was half visible for a second (weight 0, with `surface`, `position` and the page's `feedId`), `listing_dwell` after 10 seconds on an item or 3 photos swiped (`data: { dwellMs, photosSwiped }`, weight 1, the server drops a dwell below both limits), `category_visit` with a `categoryId` (0.5). Every action carries a fresh `clientEventId` (a uuid), so a resent batch never counts twice. `occurredAt` is optional and ignored when it is in the future or older than a day. Send a batch every 15 seconds, at 20 waiting actions, when the app goes to the background and before sign out. After a failed send, try once more and drop it. Signed out: send nothing.
- **Personalisation off** (the existing Settings switch): `POST /v1/events` answers `{ recorded: 0 }`, the feed uses the general score only, and switching it off clears the learned taste (events, taste profile, saved lists), like Reset.
- **The feed.** The first page (no cursor) builds four piles (taste 300, new 150, popular 100, explore 50), scores them (`scoreCandidate` in `lib/feed.ts`), applies the variety rules (`VARIETY`: at most 2 per seller, 4 per brand and 6 per category on a page of 20, one bumped card in six, surprise cards at positions 5, 12 and 19) and saves up to 500 items for 2 hours (`feed_snapshots`). `feedId` names that list. Next pages (cursor) cut from the list, so a heart in the middle never repeats or skips a card, and items sold or hidden since are dropped. After the list the feed goes newest first, without repeating anything. A new first page (pull to refresh) builds a new list. If the list is older than 2 hours or is not yours, the request is answered like a first page.
- **Moods and category chips** keep filtering: the same piles and ranking, only the matching items. `trending=true` keeps its own order (hearts times 5 plus views), with `reason: null` and `feedId: null`. Visitors get the general score (freshness, popularity, price drops, bumps, first chance) with a small shuffle that stays the same all day.
- **Card `reason`.** `kind` is one of `follows_seller`, `like_seller`, `like_brand`, `like_category`, `matches_size`, `new_in_category`, `new`, `popular`, `price_drop`, `explore`. `name` is `{ en, he }` for a seller (username), brand or category, else null. Null when no single reason was big enough. The app turns these into a sentence ("You like Zara", "New in Dresses", "Popular this week", "Something new for you") in the person's language.
- **Not interested** hides on the home feed only (search and profiles are unchanged). A hidden category hides its whole subtree. The hide survives Reset. Closing an account deletes all of this, hides included.
- **Differences from the plan.** What the person chose on purpose (a followed seller, a picked brand, a chosen size) counts in full from the first day, as the old feed did. Only the learned part of the score is multiplied by the confidence (30 points of recent activity). Chosen sizes only push matches up (decision 3), nothing is filtered. Onboarding picks write a `parent_category` line on the top level category (they give a small start, about 0.1 confidence for one pick). Buy is recorded when the order is paid, not at checkout. "Message a seller" is the buyer's first text or photo in a chat.
- **Scheduler.** `plugins/jobs.ts` runs the re-count every 15 minutes and the cleanup at 03:00 UTC on its own timers (off when `JOBS_INTERVAL_SECONDS=0`, or when `IN_PROCESS_JOBS` is false, which is the default on Vercel). The same work is reachable through `/v1/jobs/...`, see "Scheduler endpoints (Milestone 8)" below.
- **Sample data.** `pnpm db:reset` makes nine live dresses Zara and gives `noa_levi` clear taste: she hearted six Zara dresses, opened and came back to more, and searched Zara. Her home feed leans to Zara dresses. Everyone else starts with no taste.

## Admin panel (Phase 1, server only)

Every route under `/v1/admin/*` checks on the server that the caller is signed in and that `users.role` is `admin` in the database (401 without a session, 403 for anyone else, moderators included). Every change writes one row to `admin_actions` in the same transaction as the change (the log is only ever added to). Rate limit 120 a minute. Schemas are in `packages/shared/src/admin.ts`. Money from the AI meter is in micro dollars (millionths of a US dollar, 1000000 is $1), fixed costs are in minor units of their own currency, and the monthly total is in agorot.

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/v1/admin/dashboard` | none | `adminDashboardSchema` | `stats`: `totalUsers`, `newUsersLast7Days`, `activeListings`, `ordersLast30Days`, `aiSpendThisMonthUsdMicros` (month in UTC), `aiCallsToday`. `recentActions`: the last 20 audit rows with `adminUsername` (null when the system did it) |
| GET | `/v1/admin/users` | `?filter=all\|admins\|sellers\|buyers\|banned&q=&cursor=&limit=` | `adminUsersPageSchema` | Newest first, cursor paging. `q` matches username, name or email (a part of it, case ignored). `sellers` means has at least one listing that is not a draft, `buyers` means has at least one order as the buyer. Each item: `id`, `username`, `name`, `email`, `role`, `banned`, `createdAt`, `lastSignInAt` (newest session, or null), `listingCount` (not drafts), `isStandIn` |
| POST | `/v1/admin/users/:id/role` | `{ role: "user" \| "admin" }` | `{ id, role }` | Writes `user_role_changed` with `from` and `to`. 409 when you try to take your own admin access away, 404 for an unknown id |
| DELETE | `/v1/admin/users/:id` | none | 204 | Really deletes the person (`user_deleted`, keeping their username and email in the log). Their own rows go with them. 409 for yourself, and 409 when orders or wallet rows still point at them (ban them instead). 404 for an unknown id |
| GET | `/v1/admin/analytics` | none | `adminAnalyticsSchema` | `weeks`: the last 8 weeks, oldest first, Monday (UTC) `weekStart` with `signups`, `newListings` (not drafts) and `orders`. `aiThisMonth`: per `action` the `calls`, `inputTokens`, `outputTokens` and `costUsdMicros`, most expensive first |
| GET | `/v1/admin/expenses` | `?month=YYYY-MM` (default this month) | `adminExpensesSchema` | 400 for a month in the future. `fixed` is the month's own list when it has one (`usesOverride: true`), else the defaults. `auto` has one row per AI provider from `ai_calls` of that month. `byAction` and `byModel` (calls, tokens, `costUsdMicros`, and `averageCostUsdMicros` for actions) are sorted most expensive first. `yearly` (yearly costs started on or before the month) and `oneTime` (one time costs paid in the month) come with it, plus `paidByNames` (every name used for "paid by", for suggestions). `usdToIlsRate`, `totalIlsMinor` (monthly costs, yearly costs divided by 12, one time costs and AI spend, in agorot) and `defaults` come with it |
| PUT | `/v1/admin/expenses/config` | `{ fixedCosts: [{ name, amountMinor, currency: "ILS" \| "USD", kind: "subscription" \| "configured" }], usdToIlsRate }` | `adminExpensesSchema` (this month) | Saves the default list and the dollar rate (stored as an integer, rate times 10000). Up to 50 rows |
| PUT | `/v1/admin/expenses/months/:month` | `{ fixedCosts }` | `adminExpensesSchema` (that month) | Saves a list for this month only. 400 for a future month |
| DELETE | `/v1/admin/expenses/months/:month` | none | `adminExpensesSchema` (that month) | Removes the month's own list, so the defaults apply again |
| POST | `/v1/admin/expenses/items` | `{ cadence: "yearly" \| "one_time", name, amountMinor, currency, paidBy?, paidOn: "YYYY-MM-DD" }` | `extraCostSchema` | Adds a yearly or one time cost. Audit action `expenses_item_saved` |
| PUT | `/v1/admin/expenses/items/:id` | same as POST | `extraCostSchema` | Changes one. 404 when it does not exist |
| DELETE | `/v1/admin/expenses/items/:id` | none | `extraCostSchema` (the removed one) | Audit action `expenses_item_deleted`. 404 when it does not exist |
| GET | `/v1/admin/security` | none | `adminSecuritySchema` | `aiSpend`: `thisHourUsdMicros` (last 60 minutes), `todayUsdMicros` (since 00:00 UTC), `hourlyCapUsdMicros` ($2) and `dailyCapUsdMicros` ($10). `switches`: `{ name, enabled, reason, changedAt }` for every allowed name (today only `ai`) |
| PUT | `/v1/admin/switches/:name` | `{ enabled: boolean }` | `killSwitchSchema` | Only names in `KILL_SWITCH_NAMES` (400 for others). Writes `switch_changed`. This server copy sees it at once, another copy within 30 seconds |
| GET | `/v1/admin/review` | `?status=open\|handled&cursor=&limit=` (default open, limit 1 to 50, default 20) | `adminReviewPageSchema` | The Review list (D-038): member reports and the AI listing check's flags in one list. `open` means status `open` or `reviewing`, ordered by `urgency` high, normal, low, then unsorted (null), newest first within each. `handled` means `actioned` or `dismissed`, most recently handled first. Keyset cursor (opaque). Each item has `source` (`member` or `ai_check`), `reason`, the AI's `aiReason`, `urgency` and `aiSummary` (null when the AI was off), `details` (the member's note), `reporter` (null for AI flags), `target` and `otherOpenReports` (other open reports about the same thing). `target` is a small lookup: for a listing its title, status, cover photo URL, price and seller, for a user the username, for a message or review only who wrote it (message text is never read or returned), and null when the target no longer exists. The page also carries `openCount` and `openHighCount` for the menu badge |
| POST | `/v1/admin/review/:id/action` | `{ action: "hide_listing" \| "remove_listing" \| "dismiss" \| "handled", note? }` | `adminReviewItemSchema` | `hide_listing` sets the listing to `hidden` (from active or hidden) and `remove_listing` to `removed` (same states), with `status_reason` = the note or else the report reason, and clear a reservation hold. Both work only when the target is a listing (400 otherwise), mark this report and every other open report about the listing `actioned`, and refresh the seller's counts. 409 when the listing is sold, a draft, already removed or gone (use `handled`). `dismiss` marks only this report `dismissed`, `handled` marks only this one `actioned`. Sets `handled_by_id`, `handled_at` and `resolution_note` (the note). Audit rows `review_hide_listing`, `review_remove_listing`, `review_dismiss`, `review_handled`, in the same transaction. 409 when the report is already handled, 404 for an unknown id. A reserved listing (an order in progress) is 409, it cannot be hidden or removed until the order finishes. A listing hidden here keeps its `status_reason`, and the seller's `PATCH /v1/listings/:id/status` refuses to put a hidden listing with a `status_reason` back live (409 `invalid_transition`). The AI never takes any of these actions, only a person does |

**AI cost meter.** Every call to an AI provider goes through one gate (`apps/server/src/lib/ai-cost.ts`, the actions `photo_check`, `photo_tips`, `text_suggest`, `search_understand`, `listing_check`, `report_sort` and `admin_upload_photo_check`). Before the call it checks the master `ai` switch (a missing row means on, remembered 30 seconds per server copy) and the worst case cost of the call against the caps of $2 per rolling hour and $10 per calendar day (UTC), added to what `ai_calls` already holds. Passing a cap switches `ai` off by itself with a reason such as "Daily AI cap of $10 reached" and writes an `ai_auto_disabled` audit row with no admin. An admin turns it back on from Security. A refused call behaves like a failed one: the photo and text helpers answer with an empty suggestion. After the call the real tokens (input, output, cache read, cache write) are priced from a table in code (`claude-haiku-5-5` is $0.10 in, $0.50 out, $0.01 cache read, $0.125 cache write per million tokens, up to 100K prompt tokens) and written to `ai_calls`, failed calls that still used tokens included. A model that is not in the table is priced like the most expensive one and logged. Cap checks and writes are not one transaction, so a burst can overshoot a cap by a few calls.

**Making someone an admin.** `pnpm admin:grant <email or username>` on this machine, `pnpm admin:grant:online <email or username>` for the hosted database (reads `packages/db/.env.online`, the same file as `db:migrate:online`). The person must already have an account. It writes an `admin_granted` audit row.

**Background AI checks (D-038).** Two checks run after the response has gone (`waitUntil` through `lib/background.ts`), never delay or fail the request and do nothing when the AI is off, refused by the meter, slow or wrong. The AI only flags and sorts, it never hides, removes or bans anything: a flagged listing stays live until an admin acts on the Review list.

- **Listing check** (`lib/listing-check.ts`, action `listing_check`, Claude Haiku, 300 output tokens at most): runs after `POST /v1/listings` with `publish: true` and after `POST /v1/listings/:id/publish`, and after `PATCH /v1/listings/:id` or `PUT /v1/listings/:id/photos` on a live (active or reserved) listing when the title, description, brand, category or one of the first 2 photos changed (a price or size change does not count). It is not run for drafts or for admin uploads. The model reads the title, description, brand, English category path, price and the first 2 photos (text as data between `<<<LISTING TEXT` markers) and answers `flags: [{ kind, urgency, summary }]` with kinds `prohibited_item`, `counterfeit`, `scam_off_platform`, `inappropriate`, `misleading`, at most one per kind, empty when nothing is wrong. Any flag becomes ONE `reports` row (`source` `ai_check`, no reporter, `reason` and `ai_reason` the most serious kind in that order, `urgency` the highest of the flags, `ai_summary` the summaries joined and cut to 300 characters). An open AI row for the same listing is updated instead of adding another. A later check that finds nothing leaves an open row alone, an admin decides.
- **Report sorting** (`lib/report-sort.ts`, action `report_sort`, text only, 200 output tokens at most): runs after `POST /v1/reports` stores a new member report. The model gets the reason the member picked, their note and what the report is about (listing: title, description, brand, price. Member: username and bio. Review: its public text. Message: nothing of the message at all, only the reason and the note, because the privacy policy does not allow reading chats yet), all as data between `<<<REPORT` markers. It answers `{ reason, urgency, summary }` and the server saves them as `ai_reason`, `urgency` and `ai_summary` on that report. Urgency guide: high for safety, scams, harassment, threats, prohibited items and a pile up, normal for fakes, misleading and offensive, low for spam, other and mild cases. When the AI is off or fails the three fields stay null and the report sorts after the low ones.

## Admin panel, listing upload (Phase 3)

The team uploads many clothes in big batches. They are shown publicly under a **username the team picks** (a stand-in seller, for example `vintage.closet`), and each item also records the **private full name of the real owner** so that a sale can be traced to whose clothes it was. Same admin guard, rate limit (120 a minute, 600 for the photo routes) and audit rule as the rest of `/v1/admin/*`. Schemas are in `packages/shared/src/admin.ts`.

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/v1/admin/stand-ins` | none | `{ items: standInSchema[] }` | Newest first. Each: `id`, `username`, `displayName`, `createdAt`, `listingCounts` (`active`, `reserved`, `sold`, `hidden`) and `ownerNames` (the distinct private owner names on its items) |
| POST | `/v1/admin/stand-ins` | `{ username, displayName? }` | 201 `standInSchema` | Makes a user, profile and settings like a normal member, so the public profile and cards work. Username rules are the sign up rules (3 to 24 letters, numbers, dots, underscores, case blind unique) plus a short reserved list (`RESERVED_USERNAMES`, for example admin, vinty, support). 400 with `fields.username` of `validation.username.taken`, `.reserved`, `.characters`, `.tooShort` or `.tooLong`. Writes `stand_in_created` |
| POST | `/v1/admin/stand-ins/:id/uploads` | `{ contentType, byteSize }` | `uploadResponseSchema` | The same signed upload as `POST /v1/uploads` with purpose `listing_photo` (same code, `presignUploadResponse`), but into the stand-in's own folder `listings/<standInId>/`, so the "photos must be yours" checks pass for that username. 404 when `:id` is not a stand-in |
| POST | `/v1/admin/stand-ins/:id/suggest` | `{ photoKeys: 1 to 4, language }` | `photoSuggestionSchema` | The photo helper (`createPhotoSuggester`, shared with `POST /v1/listings/suggest`) for photos in the stand-in's folder (400 otherwise). Metered under its own AI action `admin_upload_photo_check` (its own line in Expenses, "Photo helper (listing upload)"). Always 200: off, over a cap or failed gives the empty suggestion. No per person limit, the spend caps are the limit |
| POST | `/v1/admin/stand-ins/:id/listings` | `{ ownerFullName, items: 1 to 50 }` | `adminPublishResultSchema` | Each item: `title`, `description`, `categoryId`, `brandId` or `brandName`, `sizeId`, `conditionId`, `colourIds`, `priceMinor`, `currency` (default ILS), `photos` (key, width, height), optional `parcelSizeId` (default: the category's usual one), optional `clientId` (sent back) and optional `ownerFullName` that replaces the batch one. Every item is created as an **active** listing owned by the stand-in through the same checks and writes as `POST /v1/listings` with `publish: true` (`lib/listing-write.ts`, `validateListing`), plus an `admin_uploads` row (`owner_full_name`, `uploaded_by`, one `batch_id` for the call). Per item result: `ok` with `listingId`, or `ok: false` with `error` and `fields` (translation keys). One bad item never blocks the others. One audit row `uploads_published` per call (username, `batchId`, `count`, `failed`) |
| GET | `/v1/admin/uploads` | `?standInId=&owner=&status=all\|active\|reserved\|sold\|hidden\|removed&cursor=&limit=` | page of `adminUploadRowSchema` | Newest upload first, cursor paging. `owner` is part of the full name, any case. Each row: upload date, `batchId`, `ownerFullName`, username, listing id and title, category path (both languages), brand, size, condition, price, current status, and for sold items `soldAt` and `saleTotalMinor` (the total of the newest order for the item that is not cancelled or refunded) |
| GET | `/v1/admin/uploads/export.xlsx` | same filters, no paging | an Excel file | Up to 10,000 rows, built with `exceljs`. File name `vinty-uploads-YYYY-MM-DD.xlsx`. Columns: Uploaded on, Batch, Owner full name, Shown as (username), Item, Category, Brand, Size, Condition, Price (₪), Status, Sold on, Sale total (₪), Link (the public website item address, from `WEB_ORIGINS`). Bold frozen header row, filter buttons, prices as numbers. Writes `uploads_exported` (row count and filters). 20 a minute |

**Why a stand-in cannot be signed into.** No password row and no sign in method exist for it, its address ends in `@stand-in.invalid` (RFC 2606: can never receive mail, so no code can be read), the code emails skip such addresses, and `lib/auth.ts` has a session hook that refuses to create a session for any user listed in `stand_in_sellers`. Email and push are off in its settings. A sale notification to it is only a row (no push tokens, no email path).

**The owner name stays private.** It lives only in `admin_uploads.owner_full_name`. The only routes that read that table are the admin ones above. A test (`apps/server/src/routes/admin-uploads.test.ts`) fetches the public item, similar items, search, profile, profile listings, member search and feed for an uploaded item and checks the name is in none of them.

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
