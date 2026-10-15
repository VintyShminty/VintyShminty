# Unfinished work

Things that were started or decided but not finished. Each item says where it stands, what it waits on and the next step. Remove an item when it is done. Plans and milestones live in `docs/roadmap.md`, this file only holds leftovers.

## AI features with Claude Haiku

Decided 2026-10-14 (Eden). Step 1 merged (D-036, PR #66), step 2 merged (D-037, PR #68). Step 3 merged (D-038, PR #69). Step 4 merged (D-041, PR #74). Step 5 built on branch `feat/ai-style-tags` (D-042), waiting for Eden's review.

- **The choice:** Claude Haiku 5.5 powers every AI feature in the app. It tied GPT-6 Luna on a 60-listing test, scored best on Hebrew categories (97%) and is already set up. Results and the reasoning are in `docs/log/2026-10-14.md`.
- **Approved features:**
  - Sell form autofill: category, brand, condition and colour from the title and description
  - Photo check before publishing (dark, cut off, a phone number in the picture), as a gentle tip
  - Search in plain words, turned into filters
  - Style tags for the Home feed
  - Chat warnings: deals moved off the app, scams
  - Listing checks: banned items, likely fakes, offensive text, sent to Eden for review
  - Report sorting by type and urgency
  - Help answers from our own help pages
  - Problem summaries for Eden when an order goes wrong
- **Left out:** AI-written listing descriptions and quick replies in chat (built and tried, then left aside by Eden on 2026-10-15). **Parked:** translating listings (in the roadmap's Parked for later).
- **Lines the AI does not cross:** it never moves money, changes an order or bans anyone by itself. It suggests and warns, and a person or our fixed rules decide. Automatic text is labelled. Reading chats must be stated in the privacy policy before chat warnings or problem summaries ship.
- **Step 1, merged (D-036):** text suggestions in the sell form (category, brand, condition and colours from the title and description, shown as guesses, never filled in) and gentle photo tips (too dark, cut off, contact details), on the app and the website, through the AI cost meter.
- **Step 2, merged (D-037):** search in plain words, turned into filters that switch on by themselves with a one tap way back to the exact words, on the app and the website, for signed out visitors too.
- **Step 3, merged (D-038):** listing checks (words and the first 2 photos) and report sorting, in one Review list in the admin pages. Flagged listings stay live until Eden decides.
- **Step 4, merged (D-041):** chat warnings on every text message (shown to the person who received it, clear scams also go to the Review list). Quick replies were left aside. The privacy policy has its "AI helpers" section (PR #71).
- **Step 5, built (D-042):** style tags for the Home feed, up to 3 of 20 styles per listing, behind the scenes only, picked in the listing check and caught up 100 a night for older listings.
- **Next step:** help answers, then order problem summaries.
- **Keys:** the Claude key is in `apps/server/.env`. Keys for Jev (TypeSafe AI) and OpenAI are there too, unused. OpenAI's free photo safety filter could be added later.

## Overlaps in the category tree

Found 2026-10-14 during the AI test. Every model stumbled on the same spots, so sellers and buyers will too.

- Running shoes sit under both Men's shoes and Sports.
- Backpacks sit under both Men's bags and Camping.
- Designer bags sit under both Women's bags and Designer.
- **Waits on:** the new categories change (commit `4e19cd5`, branch `new-categories`), which renames and expands the tree and may already move some of these.
- **Next step:** once that is merged, check which overlaps remain. For each, decide where the item belongs and make the other place point to it, or remove it. The tree is in `packages/db/src/seed/reference/categories.ts`.
