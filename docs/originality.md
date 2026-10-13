# Originality: how different from Vinted

Source of truth for what must be our own before launch. Started 2026-10-13. Background research is in `docs/log/2026-10-13.md`. This is general research, not legal advice.

## The rule

Same skeleton, different skin and different voice.

- **Free to share (how it works):** features, the order of steps in a flow, standard patterns (bottom tab bar, two column grid, filter chips, a heart to save), category trees and filters.
- **Must be ours (how it looks and what it says):** name, logo, app icon, brand colour, illustrations, custom icons, every sentence a user reads, photos, sounds, code and data.
- **The test:** cover the logo. Would a normal person think it is Vinted? If yes, change things.

Why it matters: trademarks (name, logo), copyright (words, artwork, code), EU design rights (Vinted is an EU company, screens can be protected for 3 years automatically and up to 25 if registered), Israeli "passing off" (making people think you are the other brand) and Apple's App Store rule against copycat apps, which is the risk most likely to hit first.

The Vinted UX breakdown that `docs/design.md` refers to guides how things work. It never decides names, wording or visual details.

## Chosen directions

Picked by Eden on 2026-10-13 in `docs/mockups/originality-choices.html` and `docs/mockups/originality-round-2.html` (open them to see each option). Recorded as D-019 in `docs/design.md`. Nothing is built yet.

| # | Area | Choice | Still open |
|---|---|---|---|
| 1 | Product voice | Friends' closets: people first, warm and local | Write the voice guide (tone, sample words) |
| 2 | Price and protection | Two prices, our own way: seller price, then a soft pill with the buyer price, and a breakdown (item, protection, you pay) on the item page | The name for the protection. "Covered" is a placeholder Eden is not sure about |
| 3 | Item card | Price tag card: big price first, then brand, size and condition in small capitals ("MANGO · S · LIKE NEW"), then the buyer price pill from row 2 (round 2) | None |
| 4 | Home screen top | Large greeting ("Good morning, Noa") with a small round search button beside it, then the mood chips (For you, New today, Under ₪50, Your sizes, Near you) and the grid (round 2) | None |
| 5 | Browse | Photo tiles grouped by item type (Dresses, Jeans, Sneakers, Bags...) | Final list and order of tiles |
| 6 | Search and "members" | "Sellers": "Search clothes, brands or sellers", tabs Items and Sellers | None |
| 7 | Paid boost | "Buzz" for now (Eden): button "Give it buzz", badge "Buzzing" | Trademark check with the app name |
| 8 | Item page actions | One Buy button, "Or make your price" as a link, "Message" on the seller row. The protection stays as a concept in the same places, with a new name and new text, and reminds the buyer how they are covered and what they pay for | Write the protection copy (depends on 2) |
| 9 | Sell form | Same long form, every heading, hint and button rewritten in our words | Write the copy in the new voice |
| 10 | Condition | A slider with five stops (Eden): Unworn with tags, Unworn, Like new, Worn, Well loved. Tags become the first stop, so no separate switch. Five levels match today's data, so only the names change | Eden to confirm the five names |
| 11 | Reviews | One list of written reviews plus a single line for automatic ones ("36 smooth sales") | None |
| 12 | Settings and notifications | Same list in the same order, renamed as in the mockup: Your profile, Shopping preferences, Sign in and safety, Your privacy, Alerts, Language | The rows inside Alerts (today "Push notifications", "High-priority notifications") were not in the mockup. "My sizes" (row 15) sits inside Shopping preferences |
| 13 | Seller badges | Our own outline stamps, no progress rings | Final badge names |
| 14 | Tab bar | A floating rounded bar (32 point shape) above the content, icons only, the active tab on a soft tint, and a raised round espresso Sell button with a camera in the middle. Each tab keeps a hidden name that screen readers read aloud (round 2) | None |
| 15 | Holiday mode and sizes | "Away mode" with a moon and a return date, and "My sizes" | None |
| 16 | Order updates in chat | Tracker card pinned at the top of the chat, mixing both round 2 options: the line of step icons (Paid, Sent, Arrived, Done) with send and arrival dates, plus the "Track parcel" and "I got it" buttons | Mock it once Milestone 5 starts |

## Guidelines for our work

These apply to every screen, string and asset from now on, for people and agents alike.

1. **Structure yes, surface no.** The Vinted spec may decide what a screen does and the order of steps. It never decides a name, a sentence, an icon, a colour, a layout detail or an illustration.
2. **Write every sentence fresh.** Never paste or lightly reword text from the spec or from Vinted's app. Write it in our voice (Friends' closets, D-019), then check it against the spec's wording. If it is the same or nearly the same, rewrite it.
3. **No Vinted words.** Banned in anything a user sees: Vinted, Buyer Protection, Bump and Bumped, members, wardrobe, Bundle discounts, Holiday mode, Personalisation, Satisfactory, Frequent uploads, Speedy shipping, Ask seller, "incl." under a price, and the order step names "Order shipped", "Delivered", "Your sale is complete!".
4. **Our own assets only.** Icons from our set (Lucide) or drawn by us, photos we own or have a licence for, illustrations made for us. Nothing taken from Vinted's app, site or marketing.
5. **The cover-the-logo test.** Before a new screen is approved, put it next to the matching Vinted screen in the spec. If a normal person would think they are the same app, change it before it ships.
6. **Store listing rules (Apple).** The app name, subtitle, keywords, icon and screenshots never mention Vinted or any other app, never borrow its icon style or colours, and the name stays under 30 characters. No "like Vinted" or "Vinted alternative" in the listing.
7. **Never touch their data.** No scraping, importing or copying of Vinted listings, photos, users or reviews.
8. **When unsure, ask Eden** and note the question in this file.

### What Apple's rules say

From the App Store Review Guidelines (read on 2026-10-13, they change over time, so read the live page again before submitting):

- **4.1 Copycats.** Do not copy a popular app or make "minor changes to another app's name or UI" and pass it off as your own. Impersonating another app or service can get the developer account removed. Never use another developer's icon, brand or product name in your icon or name.
- **5.2.1 Intellectual property.** Only use content you made or have a licence for. No trademarks or copyrighted work without permission, and no copycat names or metadata.
- **2.3.7 Metadata.** A unique app name (30 characters at most). Keywords and subtitle must not be packed with trademarks or other apps' names, and the subtitle must not reference other apps.
- **2.3.8 Metadata.** The app name and all its icons must match each other, to avoid confusion.
- **4.2 Minimum functionality.** The app must feel like a real app, not a repackaged website. We are fine here.

What it means for us: Apple checks the name, icon and listing first, and the look of the app second. Our rename work covers 4.1 and 5.2.1. Rule 6 above covers 2.3.7 and 2.3.8.

## Checklist

Tick an item when it is changed in both English and Hebrew.

### Must change before launch

- [ ] **App name.** Replace "Vinty" and "VintyShminty" everywhere: the name under the app icon, the welcome screen, the loading screen wordmark and the app's link name (the short code other apps use to open it)
- [ ] **Trademark search** on the new name, in Israel and the EU
- [ ] **App icon and splash screen.** Our own design, not the Expo placeholder
- [ ] **"Buyer Protection".** A new name for the fee and the promise behind it
- [ ] **The shield and "incl." line** under every price. A new way to show the price the buyer pays: wording, icon and placement
- [ ] **"Buyer pays ₪X incl. Buyer Protection"** on the sell form and item page. Rewrite with the new name
- [ ] **"Bumped" badge** and the boost feature. A new word for both
- [ ] **Search bar text** "Search for items or members". Rewrite
- [ ] **"Members"** as the word for users (search, results tabs, "From members"). Pick our own word

### Should change (the combination)

- [ ] **Item card.** Change at least two details: the order of brand, description and price, where the heart count sits, or the badge look
- [ ] **Home screen top.** Make the search bar and category chips feel like ours (a greeting, a different chip style or order)
- [ ] **Condition names.** Replace "Satisfactory" at least, reword the rest in our voice
- [ ] **"Bundle discounts".** Rename

### Process

- [x] **Design guide rule.** Change "follow the Vinted UX deconstruction" in `docs/design.md` so it covers how things work only, never names, wording or visual details
- [ ] **Product voice.** Decide it (`docs/design.md` still says "to decide"). Every rename above depends on it
- [ ] **Wording pass.** Read every user-facing sentence in English and Hebrew and rewrite anything that sounds like Vinted
- [ ] **Screens not yet checked.** Item page, sell form, profile, inbox, filters
- [ ] **IP lawyer.** One hour with an Israeli lawyer for brands, designs and copyright, with the new name and screenshots next to Vinted's
- [x] **Apple copycat rule.** Read it before the App Store submission

### Already fine, no action

Espresso and cream colours, Aileron and Heebo fonts, outline pill badges, espresso star ratings, the tab bar, and the order of steps in the sell form and filters.
