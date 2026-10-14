# Vinty website brief

Step W0.1 of `docs/plans/website.md`. This is the one place the website is built from. Written 2026-10-14.

## 1. What this is

The Vinty website is as important as the app. It does everything the app does, on phone browsers and laptops, and it can be found on Google. It shares the server, accounts, selling rules, wording, colours and fonts with the app.

**The rule.** The product spec (`docs/vinted-ux-spec.html`, including its web site map) tells us how things work and how web pages are put together. On top of that we apply every change we have made: `docs/design.md` (D-001 onward, D-019 most of all), `docs/originality.md`, the wording in `apps/mobile/i18n/locales/` and the scope in `docs/roadmap.md`. We never use the reference's names, wording, icons or visual details. The cover-the-logo test (G5) applies to every web page too.

**What this brief does not decide.** Laptop layouts. Every design decision so far was made for the phone. How the top bar looks, how wide the grid is, where filters sit on a laptop, how inbox and chat sit together: those are drawn in the W0 mockups and chosen by Eden, then recorded as D-entries. This brief says what each page is for, what is on it, and what feeds it. Where a layout choice is needed it says "decided in W0".

**How to read each page.** Every page below has the same four lines:
- **Does:** what it is for, from the spec
- **Ours:** what changed for us, with D-numbers and our wording
- **Feeds from:** the server calls behind it (from `docs/blueprint/api.md`)
- **Phone-only in the app:** what the app does that a website cannot, and what replaces it

**Address rule.** Every page lives under `/en/...` or `/he/...` (the language is in the address so Google lists both and Hebrew mirrors the layout, D-018). Below, paths are written without the prefix. So `/item/123` means `/en/item/123` and `/he/item/123`. Pages that need a login are marked "Login". Pages Google should list are marked "Google".

**Our words used in this brief.** sellers (never members), closet, piece, hearts (saved items), Buzz ("Give it buzz", "Buzzing"), Away mode, My sizes, Covered (placeholder for the protection name, one key `protectionName`), Closet deal (bundle), the five condition names (Unworn with tags, Unworn, Like new, Worn, Well loved), Post it, Keep as draft. The banned words list in `docs/originality.md` (G3) applies on the web too.

## 2. The global shell on the web

The shell is the frame around every page. The app has a floating tab bar at the bottom (D-014 area, D-017: it stays on every page opened from a tab). A laptop has no good place for that bar, so something replaces it.

### What the spec's web shell offers

The spec's desktop shell is one sticky top bar (logo, a wide search box with an Items or Sellers switch, inbox, alerts, hearts, avatar, a strong Sell button, help, language), then a row of category tabs with a hover menu that drops down, and a big footer of link columns. The spec's phone web shell is smaller: logo, a few icons, a menu button, a search row, and a drawer for everything else, with no bottom bar.

### What we adapt (our version, shape decided in W0)

| Part | What it does for us | Replaces in the app |
|---|---|---|
| Top bar, sticky | Our wordmark at the start. The search field "Search clothes, brands or sellers" with the Items and Sellers switch. Icons for Inbox, Alerts and Hearts. The avatar menu. A Sell button. Language switch | The tab bar (Home, Browse, Sell, Inbox, Profile) and the round search button on Home |
| Category row or Browse menu | A way to reach Browse and the item type tiles from any page. Either a row of tabs under the top bar with a drop-down panel, or one Browse button that opens a panel | The Browse tab and its pushed panels (D-009, D-010) |
| Avatar menu | Profile, My orders, Balance, Favourites, Saved searches, Invite friends, Settings, Help, Log out | The Profile tab list |
| Sell button | Always visible. Opens the sell form. Logged out visitors are asked to log in first | The raised Sell button in the tab bar (D-019 row 14) |
| Footer | About, Help, Terms, Privacy, language. Plain and short. No store badges until the app is public | Nothing (the app has no footer) |
| Phone browser version | Same top bar shrunk: wordmark, search, a menu button that opens a full-screen drawer with the avatar menu list and the Browse tiles. A bottom bar may be kept for phone widths only | The tab bar itself |

**OPEN for Eden (decided in W0):** what exactly replaces the floating tab bar on a laptop, and whether a phone browser gets a bottom bar like the app or a drawer like the spec's phone web. See the open questions.

The spec's ad slots, shipping notice strip and "Vinted official" rows are not copied. The spec itself says ads are noise.

### Language switch

- A small switch in the top bar and in the footer: English and Hebrew.
- It changes the first part of the address (`/en` to `/he`) and keeps you on the same page. The whole layout mirrors at once (D-018) and the font changes between Aileron and Heebo (D-011).
- Logged in people also store the choice in Settings, Language, so the server (emails, alerts) matches.
- Each page tells Google about its other-language twin.

### Logged out and logged in

| | Logged out | Logged in |
|---|---|---|
| Can see | Home, Browse, search, item pages, seller pages, help, terms, privacy. Everything public | All of it plus their own pages |
| Top bar | "Log in" and "Sign up" in place of the avatar. Sell is shown | Avatar, inbox and alert dots, hearts |
| Heart, message, buy, make your price, follow, report, sell | A friendly "Log in to continue" step. After logging in you land back on the same page and the action goes through | Works directly |
| Home | The greeting reads "Welcome in" (`greetingGuest`) and the feed is mixed new and popular. No "Your sizes" chip content | Greeting by name and time of day, feed that learns (D-022) |

The two short questions after sign up (D-022) show once, only after a new account is created.

## 3. Pages

The list has 57 numbered entries in 7 groups. About 40 are real pages with their own address. The rest are dialogs, panels inside another page, or notes (marked as such). Help also covers How it works, Terms, Privacy, About and the not found page.

### A. Public pages (W2)

**1. Home** `/`  (Google)
- Does: the personalised photo feed, infinite scroll. Spec: no hero, no category tiles.
- Ours: D-019 row 4. A large greeting ("Good morning, Noa") then mood chips (For you, New today, Under ₪50, Your sizes, Near you), then the grid of price tag cards (D-019 row 3: big price, then BRAND · SIZE · CONDITION in small capitals, then the buyer price pill). The feed learns (D-022): taste, new, popular and a few surprises, no repeats while scrolling. "Why you see this" and Not interested. On the web the greeting sits in the page, the round search button is not needed because the top bar has the search field. Empty states per chip are already written (`home.empty.*`).
- Feeds from: `GET /v1/feed` (also takes the mood chip), `POST /v1/events` (hearts, opens, return visits), `POST /v1/feed/hide`
- Phone-only in the app: long press for "Why you see this". On the web this becomes a small "..." button on each card that opens a small popover (a small floating panel next to the button) with the same options. Pull to refresh becomes a "Show new" button. Decided in W0 for the laptop.

**2. Browse** `/browse`  (Google)
- Does: a page of photo tiles by item type, one click from the top bar.
- Ours: D-019 row 5. Photo tiles by item type (Dresses, Tops, Jeans, Trousers, Skirts, Coats and jackets, Knitwear, Sneakers, Shoes, Bags, then a More tile). Women, Men and Kids are filters inside a tile, not the first level. No illustrated tiles like the spec. Tile list and order live in `apps/mobile/lib/browse-tiles.ts`, which moves into the shared pieces in W1.
- Feeds from: `GET /v1/reference` (categories), tile photos
- Phone-only in the app: the pushed panels sliding in from the side (D-009, D-010, D-014). On a laptop the category tree becomes the top bar menu panel or a left column. Decided in W0.

**3. Browse: a tile** `/browse/[tile]`  (Google)
- Does: one item type, with Women, Men, Kids as a first choice and then the results.
- Ours: same tiles as the app (`browse/tile`). Opens straight into results with the filters available.
- Feeds from: `GET /v1/listings` with category filters, `GET /v1/listings/count`

**4. Browse: category** `/browse/category/[id]`  (Google)
- Does: the spec's catalog page: a breadcrumb, links to subcategories, a row of filters, the grid.
- Ours: the "All" row first, then subcategories, as in D-009 and D-010. The breadcrumb is real links, which Google likes.
- Feeds from: `GET /v1/reference`, `GET /v1/listings`

**5. More to explore** `/browse/more`  (Google)
- Does: the tiles that did not fit (Accessories, Kids, Sportswear, Designer, Home, Electronics, Books and media, Hobbies) and then the whole category tree.
- Ours: `browse.moreTitle` "More to explore". Same as the app.
- Feeds from: `GET /v1/reference`

**6. Search results** `/search?q=...`  (Google for plain searches)
- Does: results for a typed search, with filter pills and sort, a count, numbered pages. The spec's desktop uses a pager, its phone web and app use endless scroll.
- Ours: the field says "Search clothes, brands or sellers". Two tabs: Items and Sellers (D-019 row 6, never "Members"). The result count line, "No items found" with "Try different words or fewer filters". "Save this search" is a bookmark beside the field (spec: app). Recent searches come from the account.
- Feeds from: `GET /v1/listings`, `GET /v1/listings/count`, `GET /v1/search/suggestions` (while typing), `GET /v1/users` (Sellers tab), `POST /v1/me/saved-searches`, `GET/POST/DELETE /v1/me/recent-searches`
- Phone-only in the app: the search overlay. On the web, suggestions drop down under the field. Photo search (the camera in the field) is out, see section 4.

**7. Filters and sort** (part of the results page, not its own address)
- Does: Sort, Category, Size, Brand, Condition, Colour, Pattern, Price, Material. Show results applies them.
- Ours: D-014 made this a full-screen pushed panel in the app, and the condition filter uses our five names. On the web the filters are in the address (`?brand=...&size=...`) so they can be shared and Google can read the common ones. Where they sit on a laptop (left column, pills with popovers, or a panel) is decided in W0.
- Feeds from: `GET /v1/listings`, `GET /v1/brands` (brand picker), `GET /v1/reference` (sizes, colours, conditions, materials, patterns)
- Phone-only in the app: pushed sub-pages for price, size and brand. A phone browser can keep a full-screen filter page. A laptop does not need it.

**8. Item page** `/item/[id]`  (Google)
- Does: the decision page: photo gallery, honest price, details, seller trust, three ways to act. Also a seller's other items and similar items.
- Ours: D-019 rows 2 and 8. Seller price first, then the soft pill with the buyer price, and a price breakdown (item, Covered, you pay) that opens as a small dialog. One Buy button, "Or make your price" as a link under it, and Message on the seller row. The condition is shown with our five names. "Message seller" rather than "Ask seller". If the seller is away: "{{name}} is away until {{date}}. You can still save it." Sold, Reserved, Hidden and Draft notes already exist in our wording. "More like this" for similar items. The "..." menu offers Report this item. Buzz shows a "Buzzing" badge. Shared links show photo, title and price (W2 plan).
- Feeds from: `GET /v1/listings/:id`, `GET /v1/listings/:id/similar`, `GET /v1/users/:id/listings` (seller's other items), `PUT/DELETE /v1/listings/:id/favourite`, `PUT/DELETE /v1/users/:id/follow`, `POST /v1/reports`, `POST /v1/events` (opens)
- Phone-only in the app: the sticky bottom Buy bar, the swipe gallery, the black full-screen photo viewer, the native "..." sheet. On the web: the buy actions sit in a side card that stays in view on a laptop (the spec's right column) and in a bottom bar on a phone browser. The gallery becomes a photo mosaic plus a click to enlarge viewer with arrow keys. The "..." becomes a small menu. Decided in W0.

**9. Price breakdown** (a dialog on the item page)
- Does: explains what the buyer pays for.
- Ours: D-019 row 2. Uses `protectionName` ("Covered", still a placeholder, Eden has not chosen) and its note. Text is written fresh, never the reference's.
- Feeds from: `GET /v1/pricing/preview`
- Phone-only in the app: a bottom sheet. On the web a centred dialog.

**10. Seller page** `/seller/[id]`  (Google)
- Does: identity, trust badges, reviews and listings in one place. Follow, Block and Report in a menu.
- Ours: the word is "seller". Tabs Listings, Reviews, About (`profile.tabs`). Reviews are one list of written reviews plus one line for the automatic ones ("36 smooth sales, no problems", D-019 row 11). Our own outline stamps for badges (row 13, no progress rings). Followers and Following numbers are links. Away mode shows the moon strip (D-025). "Closet deal" button to build a bundle from this seller's pieces. Active and Sold toggles on the listings.
- Feeds from: `GET /v1/users/:id`, `GET /v1/users/:id/listings`, `GET /v1/users/:id/reviews`, `GET /v1/users/:id/followers`, `GET /v1/users/:id/following`, `PUT/DELETE /v1/users/:id/follow`, `PUT/DELETE /v1/users/:id/block`, `POST /v1/reports`
- Phone-only in the app: the pull down header. Nothing else.

**11. Followers and following** `/seller/[id]/followers`, `/seller/[id]/following`
- Does: lists of sellers with a Follow button. Small pages.
- Feeds from: `GET /v1/users/:id/followers`, `GET /v1/users/:id/following`

The spec's Brand page (a catalog already filtered to one brand) is not a separate page for us. A brand name on an item links to search results with that brand set (`/search?brand=...`), which is the same thing.

### B. Accounts and shopping lists (W3)

**12. Welcome** `/` for logged out visitors can stay Home. The app's Welcome screen (one strong photo, "Good taste, passed on", D-021) becomes a sign up and log in invitation on Home, in the top bar and in the "Log in to continue" step. Whether a full welcome page exists on the web is decided in W0.

**13. Sign up** `/sign-up`
- Does: create an account.
- Ours: D-020. Two fields only, Email then Password. No username (the server makes one from the email). "Continue with Apple" and "Continue with Google" under a thin "or" line (D-023), each shown only when the server says that provider is on. After a new account, the two questions (D-022).
- Feeds from: `POST /api/auth/sign-up/email`, `GET /v1/auth/providers`, `POST /api/auth/sign-in/social`
- Phone-only in the app: Apple signs in with an ID token inside the app. On the web, Apple and Google both use a redirect to the provider and back. Apple on the web needs extra Apple Developer setup (a Services ID, a return address, a key, see plan W3).

**14. Log in** `/log-in`
- Does: email and password, plus Apple and Google. A "Forgot password" link.
- Feeds from: `POST /api/auth/sign-in/email`, `POST /api/auth/sign-in/social`
- Phone-only in the app: Face ID unlock after the first login (out, see section 4).

**15. Confirm your email** `/confirm-email`
- Does: type the 6 digit code that was emailed (not a link).
- Feeds from: `POST /api/auth/email-otp/send-verification-otp`, `POST /api/auth/email-otp/verify-email`

**16. Forgot password** `/forgot-password`
- Does: email, then a 6 digit code, then a new password.
- Feeds from: `POST /api/auth/email-otp/request-password-reset`, `POST /api/auth/email-otp/reset-password`

**17. Two sign up questions** `/welcome/questions`  (Login, only after a new account)
- Does: "What do you shop for?" (Women, Men, Kids, several allowed) and "What are your sizes?" (the My sizes picker). Both skippable, both end on Home.
- Ours: D-022 and D-029 (hand-drawn ink figure, one picture per step, the part you choose in colour). The website reuses the same pictures. Laptop layout decided in W0.
- Feeds from: `POST /v1/me/onboarding-picks`, `PUT /v1/me/personalisation/sizes`

**18. Favourites** `/favourites`  (Login)
- Does: everything you hearted, including sold items.
- Ours: the word is "hearts". A heart on sold items stays so they can be removed (Milestone 4 note).
- Feeds from: `GET /v1/me/favourites`, `PUT/DELETE /v1/listings/:id/favourite`

**19. Saved searches** `/saved-searches`  (Login)
- Does: your saved searches, tap to run, delete. The spec never found where these live on the web, so this page is ours to place.
- Feeds from: `GET/PATCH/DELETE /v1/me/saved-searches`

**20. Followed sellers** `/following`  (Login)
- Does: sellers you follow (the "Follow your favourite sellers" empty state in the spec).
- Feeds from: `GET /v1/users/:id/following` for your own id

**21. Invite friends** `/invite`  (Login)
- Does: your code with a Share button, three short steps, who joined, your vouchers. A "Have a friend's code?" section for accounts up to 7 days old.
- Ours: D-024. Placeholder amounts (50 shekels). Vouchers are shown but not used at checkout.
- Feeds from: `GET /v1/me/referral`, `POST /v1/referrals/redeem`, `GET /v1/me/vouchers`
- Phone-only in the app: the share sheet. On the web a Copy link button and, on phones, the browser's share menu.

**22. Your buzzes** `/buzzes`  (Login)
- Does: items that have buzz, with end dates. Buzz is free for now.
- Ours: "Your buzzes", "Buzzing", "Ends {{date}}". Never "Bump".
- Feeds from: `GET /v1/me/bumps`, `GET /v1/bump-plans`

**23. Give it buzz** (a dialog on your own listing)
- Does: choose how long, confirm.
- Feeds from: `GET /v1/bump-plans`, `POST /v1/listings/:id/bump`
- Phone-only in the app: a sheet. On the web a dialog.

### C. Messaging (W4)

**24. Inbox** `/inbox`  (Login)
- Does: tabs Messages and Notifications (and Archived). Each conversation is tied to an item. The spec's desktop shows the list and the open chat side by side in one card, its phone web shows only the list.
- Ours: on a laptop, list and chat side by side (decided in plan, drawn in W0). On a phone browser, the list and the chat are separate pages. Archive, Mute, Move to inbox, Mark all read exist already. Empty states are written ("No messages yet", "Message a seller about a piece and the chat lands here"). The tab dot comes from the unread count.
- Feeds from: `GET /v1/conversations`, `GET /v1/me/unread`, `GET /v1/me/notifications`, `POST /v1/me/notifications/read`, `PUT /v1/conversations/:id/archive`, `PUT /v1/conversations/:id/mute`
- Phone-only in the app: push alerts (out). The browser tab title shows an unread number instead.

**25. Chat** `/inbox/[conversationId]`  (Login)
- Does: messages with the item strip, offers as bubbles with their status, photos, and the order told inside the chat.
- Ours: D-019 row 16. A tracker card pinned at the top with the step icons (Paid, Sent, Arrived, Done), send and arrival dates, and the buttons "Track parcel" and "I got it". Our step names, never the reference's. Offer bubbles for send, accept, decline, counter, withdraw. A daily offers counter. Block and Report in the chat options. Live messages through Socket.IO (the one open risk in the plan: the login must reach the live connection on the temporary address).
- Feeds from: `GET /v1/conversations/:id`, `GET/POST /v1/conversations/:id/messages`, `POST /v1/conversations/:id/read`, offer calls (see order pages), Socket.IO events from `docs/blueprint/api.md`
- Phone-only in the app: the camera button and photo picker become the browser's file picker, also drag and drop on a laptop. The keyboard "send" key becomes Enter.

**26. Notifications** (a tab inside Inbox, plus a small dropdown from the top bar bell)
- Does: news about your pieces, offers and orders. Each row opens what it is about. Mark all read.
- Feeds from: `GET /v1/me/notifications`, `POST /v1/me/notifications/read`

### D. Orders (W5)

**27. Make your price** (a dialog from the item page or the chat)
- Does: two preset discounts that depend on the price, a custom price, how many offers are left today.
- Ours: the link text is "Or make your price" (D-019 row 8). The number pad is not needed on a laptop.
- Feeds from: `GET /v1/offers/quota`, `POST /v1/conversations/:id/offers`
- Phone-only in the app: the full-screen page with the number pad. On the web a dialog with a normal number field.

**28. Offer actions** (inside the chat)
- Does: the seller accepts, declines or counters. The sender withdraws. Accepting leads straight to checkout (Milestone 5 note).
- Feeds from: `POST /v1/offers/:id/accept`, `/decline`, `/counter`, `/withdraw`

**29. Closet deal (bundle)** `/closet-deal/[sellerId]`  (Login)
- Does: pick two or more pieces from one seller for a discount and one shipment. Add and Review controls.
- Ours: the word is "Closet deal" (not "Bundle discounts"). The percent comes from the seller's settings.
- Feeds from: `POST /v1/bundles`, `PUT/DELETE /v1/bundles/:id/items/:listingId`, `GET /v1/bundles/:id`

**30. Checkout** `/checkout/[id]`  (Login)
- Does: one page: the item or items, address, delivery choice (pick-up point or home delivery), total to pay, a Pay button. The item is held for 30 minutes.
- Ours: simulated. Pay always succeeds, no card, no money moves. A clear "practice run" note stays. Price lines: Price, Closet deal, Covered, Postage, Total to pay. Real payment and real shipping labels stay out (same as the app).
- Feeds from: `POST /v1/checkout/quote`, `POST /v1/orders`, `POST /v1/orders/:id/pay`, `GET/POST /v1/me/addresses`
- Phone-only in the app: the pickup-point map is not built in the app either. Same on the web.

**31. Checkout: address** `/checkout/[id]/address`
- Does: pick or add the delivery address.
- Feeds from: `GET/POST/PATCH /v1/me/addresses`

**32. Order done** `/checkout/[id]/done`
- Does: a success screen with a link to the chat and to My orders.

**33. My orders** `/orders`  (Login)
- Does: Bought and Sold tabs with status chips (All, In progress, Completed, Cancelled). The Sold tab opens on In progress in the spec.
- Ours: written empty states exist for each combination (`orders.empty.*`).
- Feeds from: `GET /v1/orders`

**34. Order page** `/orders/[id]`  (Login)
- Does: the order timeline (Paid, Sent, Arrived, Done), seller's "Mark as shipped", buyer's "I got it", cancel, dispute, and leave a review. The spec says the order has no page of its own, only the chat. We have an order screen in the app, so the web has one too, with the same tracker card as the chat.
- Feeds from: `GET /v1/orders/:id`, `POST /v1/orders/:id/ship`, `/confirm-received`, `/cancel`, `/dispute`
- Phone-only in the app: the pretend parcel timer runs on the server, so nothing changes.

**35. Leave a review** (a dialog from the order or the chat)
- Does: five stars (espresso, not gold, D-012) and a comment up to 400 characters.
- Feeds from: `POST /v1/orders/:id/reviews`, `PUT /v1/reviews/:id/reply`

**36. Balance** `/balance`  (Login)
- Does: pending and available balance, Withdraw, Shop, a list of entries by month.
- Ours: the balance and withdrawals are pretend for now, with the note ("No real money moves").
- Feeds from: `GET /v1/me/balance`, `GET /v1/me/balance/entries`, `POST /v1/me/balance/withdrawals`

### E. Selling (W6)

**37. Sell form** `/sell` and `/sell/[draftId]`  (Login)
- Does: one long page that grows as you choose a category. Photos, name, story, category, brand, size, condition, colours, material, pattern, price, parcel size.
- Ours: D-015 and the sell copy rewritten in our voice (D-019 row 9): "New listing", "The piece", "The details", "Your price", "Sending it", "Post it", "Keep as draft". The condition is a slider with five stops (D-019 row 10). Price shows "This is what buyers pay". Rules (which rows are needed per category, price, photos) live once in `packages/shared/src/listing-rules.ts` and run on the web too. A suggestion helper offers best guesses and never fills anything in (D-028). "Some photos were made or touched up with AI" tick box. "Keep your changes?" with Save for later and Throw away when you leave.
- Feeds from: `GET /v1/reference`, `GET /v1/brands`, `POST /v1/brand-requests`, `GET /v1/pricing/preview`, `GET /v1/sell/assist`, `POST /v1/listings/suggest`, `POST /v1/listings`, `PATCH /v1/listings/:id`, `PUT /v1/listings/:id/photos`, `POST /v1/listings/:id/publish`, `POST /v1/uploads`
- Phone-only in the app: the full-screen modal, the photo library picker, camera. On the web the photos come from the file picker or drag and drop onto a drop zone. They upload straight to Cloudflare R2 (needs a CORS rule, Eden adds it). On a laptop the form can show a live preview of the card beside it (decided in W0).

**38. Category and other pickers** (inside the sell form)
- Does: category drill-down, brand search, size, condition, colours, material.
- Ours: D-010 category panels. On a laptop these become a dialog or an inline panel, not a pushed screen. Decided in W0.

**39. My listings** `/my-closet`  (Login)
- Does: your own pieces as a small dashboard: price, views, hearts, and a "Give it buzz" button per piece. Status: Active, Draft, Reserved, Hidden, Sold.
- Ours: your closet on your own profile. Also reachable at `/seller/[yourId]`.
- Feeds from: `GET /v1/me/listings`, `GET /v1/me/listings/:id`, `PATCH /v1/listings/:id/status`

**40. Edit a listing** `/sell/[id]/edit`  (Login)
- Does: the same form with "Update listing". Delete with "Delete this listing?" and the warning that photos go too.
- Feeds from: `PATCH /v1/listings/:id`, `DELETE /v1/listings/:id`

**41. Reserve, hide and show** (buttons on your own listing)
- Feeds from: `PATCH /v1/listings/:id/status`

### F. Profile and settings (W3)

**42. Your profile** `/profile`  (Login)
- Does: the same page others see plus selling tools. Identity card, badges, reviews, your closet, the Away mode strip ("I'm back" button), and rows for Favourites, Balance, My orders, Invite friends, Buzzes.
- Ours: D-025 for the moon strip. Our badge stamps (D-019 row 13).
- Feeds from: `GET /v1/me`, `GET /v1/me/badges`, `GET /v1/users/:id/listings`, `GET /v1/users/:id/reviews`

**43. Edit profile** `/profile/edit`
- Does: photo, username, bio, city, country, show city.
- Feeds from: `PATCH /v1/me/profile`, `POST /v1/uploads` (avatar), `GET /api/auth/is-username-available`
- Phone-only in the app: photo from library or camera. The web uses the file picker.

**44. Settings home** `/settings`  (Login)
- Does: the list of sections. The spec's desktop shows a left rail with the sections and the content beside it. The phone web shows a list then the content.
- Ours: rows renamed (D-019 row 12): Your profile, Your account, Addresses, Sign in and safety, Your privacy, Shopping preferences, Alerts, Language, Help, Away mode, Log out. A left rail on a laptop (decided in W0) and a plain list on a phone.
- Feeds from: `GET /v1/me/settings`, `PATCH /v1/me/settings`

**45. Your account** `/settings/account`
- Does: email, password, username, delete account. Sub-pages for Change email, Change password, Change username, Confirm email, Delete account.
- Feeds from: `POST /api/auth/email-otp/request-email-change`, `/change-email`, `POST /api/auth/change-password`, `DELETE /v1/me`
- Note: Delete account asks for the password and says what is kept (orders and reviews).

**46. Addresses** `/settings/addresses`, `/settings/addresses/new`, `/settings/addresses/[id]`
- Feeds from: `GET/POST/PATCH/DELETE /v1/me/addresses`

**47. Sign in and safety** `/settings/security`
- Does: devices signed in (sign one or all others out), Google and Apple linked, blocked sellers.
- Feeds from: `GET /api/auth/list-sessions`, `POST /api/auth/revoke-session`, `/revoke-other-sessions`, `POST /api/auth/link-social`, `GET /v1/me/blocks`
- Phone-only in the app: the Face ID switch (out). The row is simply not shown on the web.

**48. Your privacy** `/settings/privacy`
- Feeds from: `GET/PATCH /v1/me/settings` (last seen, show city, personalisation)

**49. Shopping preferences** `/settings/shopping`
- Does: My sizes, "Answer the welcome questions again", Hidden from your feed (with Undo), Reset my recommendations.
- Ours: D-022 and D-029. Reset opens a confirmation that says Home forgets what it learned and that hearts, sizes, follows and hidden items stay.
- Feeds from: `PUT /v1/me/personalisation/sizes`, `PUT /v1/me/personalisation/brands`, `GET /v1/feed/hidden`, `DELETE /v1/feed/hidden/:id`, `DELETE /v1/me/personalisation`, `POST /v1/me/onboarding-picks`
- The same signals as the app go to the feed (hearts, opens, searches), so Home learns from both.

**50. Alerts** `/settings/alerts`, `/settings/alerts/phone`, `/settings/alerts/email`
- Does: "On your phone" and "By email", each with "Do not miss these" and "Good to know" groups and "Cap alerts per day".
- Ours: the names from `docs/originality.md` proposal 1. On the web "On your phone" is shown as "Push alerts" only if Eden wants it (alerts to a phone have no meaning in a browser). Email alerts work as in the app. See open questions.
- Feeds from: `GET/PUT /v1/me/notification-preferences`

**51. Language** `/settings/language`
- Does: pick English or Hebrew.
- Feeds from: `PATCH /v1/me/settings`

**52. Away mode** `/settings/away-mode`
- Does: one switch, return date chips (In 1 week, In 2 weeks, In 1 month, In 2 months, No date), up to 90 days. Your items are left out of Home and search and nobody can buy them. People can still save them and message you.
- Ours: D-025. Words fixed (never "Holiday mode").
- Feeds from: `GET/PUT /v1/me/away-mode`

**53. Closet deal settings** `/settings/closet-deal`
- Does: the discounts you give when someone buys several pieces.
- Ours: renamed from "Bundle discounts".
- Feeds from: `GET/PUT /v1/me/bundle-discounts`

**54. Blocked sellers** `/settings/blocked`
- Feeds from: `GET /v1/me/blocks`, `PUT/DELETE /v1/users/:id/block`

**55. Log out** (a button, not a page)
- Does: ends this session on this browser.
- Feeds from: `POST /api/auth/sign-out`

**56. Not interested list** is part of Shopping preferences (see 49).

### G. Help and legal (W2 and W7)

**57. Help** `/help` and `/help/[article]`  (Google)
- Does: the spec has a personalised help hub with search, "I need help with a specific order" and topics. We keep our five groups (Buying, Selling, Shipping and orders, Your account, Safety), each article short, then a "Still stuck?" card with "Write to us".
- Ours: D-025. Articles are written already in both languages. On the web "Write to us" opens an email to our support address, or a small form (open question). The "Our help topics" API exists, so the website reads the same articles as the app and Google can read them.
- Feeds from: `GET /v1/help/topics`

**How it works** `/how-it-works`  (Google). The spec has a three part explainer. We write our own short one in the Friends' closets voice. Content to be written, not in the app. Counted inside Help.

**Terms and privacy** `/terms`, `/privacy`  (Google). Needed by the App Store too (W7). Text to be written (Eden may want a lawyer). Linked from sign up and the footer.

**About** `/about`  (Google). Optional. Who we are, in the Friends' closets voice.

**Not found and error pages**: a friendly "This page is not here" in both languages, with a way home.

## 4. Not on the website

| App thing | On the web |
|---|---|
| Face ID unlock, the Face ID offer, the lock after 5 minutes | Not built. The browser session is the login. No Face ID rows in Settings |
| Push notifications and push settings | Not built. Browser tab title and email alerts instead. No "On your phone" screens unless Eden decides otherwise |
| Haptics (little buzzes on tap) | Not built |
| The photo library picker and camera | The browser's file picker, drag and drop |
| Slide-up sheets and pushed panels | Dialogs, popovers, side panels and normal pages. Which one where is decided in W0 |
| Pull to refresh, swipe back | A "Show new" button, the browser Back button |
| Photo search (camera in the search field) | Not built (the app's own flow is not complete either, and photo search is on the parked list) |
| Real payments and real shipping | Out, like the app. Checkout is a practice run |
| Paid Buzz | Free for now, like the app |
| Developer-only design gallery | Not on the website |
| Ads and the spec's ad slots | Never |
| Store badges in the footer | Later, when the app is public |

## 5. Decisions and what is still open

Eden picked the laptop and phone browser layout on 2026-10-14, recorded as D-030 in `docs/design.md`: a top bar with one Browse button on laptops, a menu drawer on phone browsers, two column inbox, the item page card beside the photos, the sell form with a live preview, five cards across, the big greeting, only By email in Alerts, logged out visitors land on Home, Write to us stays an email link, and Claude drafts Terms, Privacy and About for a lawyer to check.

Filters, decided in round 2 with the clickable prototype (`docs/mockups/website-filters-prototype.html`), also in D-030: an item type's page opens with photo tiles for its types, filters are a row of pills that each open a floating panel, and on a laptop the results change on every click.

Nothing in the layout is open any more.
