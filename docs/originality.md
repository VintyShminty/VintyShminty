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

These apply to every screen, string and asset from now on, for people and agents alike. They are numbered G1 to G12 (G9 to G12 come from Apple's rules below).

1. **Structure yes, surface no.** The Vinted spec may decide what a screen does and the order of steps. It never decides a name, a sentence, an icon, a colour, a layout detail or an illustration.
2. **Write every sentence fresh.** Never paste or lightly reword text from the spec or from Vinted's app. Write it in our voice (Friends' closets, D-019), then check it against the spec's wording. If it is the same or nearly the same, rewrite it.
3. **No Vinted words.** Banned in anything a user sees: Vinted, Buyer Protection, Bump and Bumped, members, wardrobe, Bundle discounts, Holiday mode, Personalisation, Satisfactory, Frequent uploads, Speedy shipping, Ask seller, "incl." under a price, and the order step names "Order shipped", "Delivered", "Your sale is complete!".
4. **Our own assets only.** Icons from our set (Lucide) or drawn by us, photos we own or have a licence for, illustrations made for us. Nothing taken from Vinted's app, site or marketing.
5. **The cover-the-logo test.** Before a new screen is approved, put it next to the matching Vinted screen in the spec. If a normal person would think they are the same app, change it before it ships.
6. **Store listing rules (Apple).** The app name, subtitle, keywords, icon and screenshots never mention Vinted or any other app, never borrow its icon style or colours, and the name stays under 30 characters. No "like Vinted" or "Vinted alternative" in the listing.
7. **Never touch their data.** No scraping, importing or copying of Vinted listings, photos, users or reviews.
8. **When unsure, ask Eden** and note the question in this file.

### Apple's rules, one by one

From the App Store Review Guidelines, read on 2026-10-13. They change over time, so read the live page again before every submission: https://developer.apple.com/app-store/review/guidelines/

Apple's reviewers look at the store listing first (name, icon, subtitle, screenshots), then open the app. A copycat problem is usually spotted in the first minute.

| Rule | What Apple says, in plain words | What it means for us | Our guideline |
|---|---|---|---|
| **4.1(a) Copycats** | Do not copy a popular app, or take another app and change its name or screens a little and call it yours | The whole originality pass (D-019). Small tweaks are exactly what this rule names, so the changes must be real, not cosmetic | G1, G2, G3, G5 |
| **4.1(b) Impersonation** | Pretending to be another app or service breaks Apple's developer code of conduct and can get the developer account removed | Never suggest we are Vinted, part of Vinted or connected to it. That covers the app, emails, support replies and social posts | G9 |
| **4.1(c) Their brand in our name or icon** | You cannot put another developer's icon, brand or product name in your app's name or icon without their permission | "Vinty" sounds like Vinted and must go. The new icon must not look like Vinted's (no teal, no similar letter mark) | G10 |
| **5.2.1 Intellectual property** | Use only content you made or have a licence for. No trademarks, copyrighted work or patented ideas without permission. No copycat names in the app bundle or the developer name | Assets need a licence on file. The hidden app ID (`com.anonymous.vinty`) and the developer name also count, not just what users see | G4, G11 |
| **5.2.2 Other services** | If the app uses or shows content from another service, its terms must allow it | No importing, scraping or showing Vinted listings, photos or reviews, even with a "bring your listings over" button | G7 |
| **2.3.7 Name and keywords** | A unique name of 30 characters at most. Do not stuff keywords with trademarks or other apps' names. The subtitle must not mention other apps | No "Vinted" in keywords, subtitle or description. No "like Vinted" or "Vinted alternative" | G6 |
| **2.3.8 Name and icons match** | The app name and every icon must look like the same product | One name and one icon style across the app, the store and any alternate icons | G10 |
| **4.2 Minimum functionality** | The app must be useful and feel like a real app, not a website in a wrapper | We pass. Nothing to do | None |

### More guidelines from Apple's rules

9. **Never claim a link to Vinted.** No "from the makers of", "as seen on", "move from Vinted" or comparisons with Vinted, in the app, emails, support or marketing.
10. **Name and icon are ours from end to end.** The new app name does not sound like, rhyme with or shorten Vinted. The icon uses our espresso and cream, not a teal and not a letter mark like theirs. The name under the icon, the store name and the icon all match.
11. **Hidden names count too.** When the app is renamed, also change the app ID (`com.anonymous.vinty`), the link name (`vinty`), the developer name and the support email.
12. **Clean store screenshots.** Make them from our own photos or photos we have a licence to use in advertising, not the development sample photos. Avoid big, readable brand logos (Nike, Zara and so on) in screenshots and ads. People can still list branded items inside the app.

### Before every App Store submission

- [ ] Read the live rules again (4.1, 5.2, 2.3)
- [ ] Name: unique, 30 characters at most, trademark search done
- [ ] Icon, name and store name match. Nothing teal, nothing like Vinted's mark
- [ ] Subtitle, keywords and description: no Vinted or other app names
- [ ] Screenshots: our own or licensed photos, no big brand logos
- [ ] App ID, link name, developer name and support email renamed
- [ ] Search the app's English and Hebrew text for the banned words (G3)
- [ ] Cover-the-logo test on the main screens (G5)

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
