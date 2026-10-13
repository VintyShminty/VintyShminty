# Vinty roadmap

Source of truth for what we are building and in what order. Update the status here whenever a milestone starts, ships or changes. Decisions behind each step live in `docs/design.md` (design) and `docs/blueprint/data-model.md` (data).

## Version 1 scope

Version 1 is a working app to inspect, not a throwaway prototype. It includes **everything in the product spec** (the Vinted UX deconstruction) except real payments and real shipping logistics.

- **Platforms:** iPhone app first (Expo, React Native). Android comes from the same code.
- **Languages:** Hebrew and English at launch, right to left ready from day one.
- **Market:** Israel only, prices in shekels (₪).
- **Checkout is simulated:** Buy now, checkout, Pay always succeeds with no card and no money moving. The seller taps Mark as shipped, the buyer taps I received it, both leave reviews and the seller's pretend balance goes up. Real payments and shipping later replace only the pay and ship steps.
- **Boosts and bumps** exist but are free.

## Milestones

| # | Milestone | What you can do at the end | Status |
|---|---|---|---|
| 0 | Blueprint | Nothing new on the phone. The full data design, the list of app to server requests, all categories and reference data in Hebrew and English, and sample data so every screen has something to show | Done (merged) |
| 1 | Accounts | Sign up and log in with email, unlock with Face ID, your profile, settings, switch between Hebrew and English. Google and Apple sign in once those accounts exist | Done (merged, PR #2) |
| 2 | Selling | The full sell form with categories and photos, drafts, your own listings, editing and deleting | Done (merged, PR #9) |
| 3 | Discovery | Home feed, Browse grid with category panels, search, filters and sort, item page, seller profiles, favourites, saved searches | Done (merged, PRs #10, #11) |
| 4 | Messaging | Live chat, notifications, push alerts (offers moved to Milestone 5, Eden 2026-10-13, because accepting an offer leads straight to checkout). Also from the Milestone 3 review: the bottom tab bar stays visible on pages opened from a tab (item page, seller profile, search, favourites), switching between Hebrew and English happens instantly without reopening the app (the app flips the layout itself instead of the phone, Eden 2026-10-13), and a heart on sold items in Favourites so they can be removed | Done (merged, PR #12) |
| 5 | Orders | Offers (send, accept, decline, counter), simulated checkout, order timeline, pretend balance and withdrawals, reviews, bundles | Done (merged, PR #14) |
| 6 | Our own look | The app stops reading as a copy of the reference product, with every feature and flow kept (Eden, 2026-10-13). Built from the 16 chosen directions in `docs/originality.md` and D-019: our own wording everywhere (sellers not members, Buzz, Away mode, My sizes, condition names, sell form, settings), the price tag item card with the buyer price pill, one Buy button with "Or make your price", the floating tab bar with the raised Sell button, the greeting and mood chips on Home, photo tiles in Browse, one reviews list, our own seller stamps, the order tracker card in chat, and a redesigned welcome, log in and sign up | In progress |
| 7 | A home feed that learns | Stage 1 of `docs/plans/home-feed.md`: the server and the app record hearts, opens, return visits, searches and category visits, each person gets a taste profile that grows and fades, Home mixes taste, new, popular and a few surprises with variety rules and no repeats while scrolling, two short questions after sign up, "Why you see this", Not interested and Reset in Settings. Before launch so the feed learns from day one. Waits for Eden's five decisions in section 9 of the plan | Planned |
| 8 | Extras | Boost (Buzz) and the rest of the spec: invite friends, help pages, Away mode settings | Planned |

Every milestone ends with something you can use on your phone, in both languages.

## Foundations already in place

- **Design:** The Vinty look adapted for the phone, Espresso and cream palette, Aileron with Heebo for Hebrew, item card option C, chips and badges option B, bottom tab bar with Browse category panels (`docs/design.md`, decisions D-001 to D-016).
- **Components:** 63 components mapped from the spec with a build order (`docs/components.md`), shown in the component sheets in `docs/mockups/` (English and Hebrew).
- **Tech:** Expo app with NativeWind and React Native Reusables, Fastify server, Postgres with Drizzle, automatic checks on every upload, agent skills and instructions (`CLAUDE.md`).
- **Expo project:** account `vintys-team`, project `vinty`, app name on the phone "Vinty".

## Accounts and services to set up

| Service | Needed for | When | Status |
|---|---|---|---|
| Expo | Building the installable app | Now | Done |
| Apple Developer ($99 a year) | Sign in with Apple, installing on phones through TestFlight | Milestone 1. Start early, approval can take days | Not started |
| Google Cloud | Google sign in | Milestone 1 | Opened, not configured |
| Mailpit (Docker, development only) | Catches every email the server sends, inbox at localhost:8025 | Milestone 1 | Running |
| MinIO (Docker, development only) | Stands in for Cloudflare R2 for photos, console at localhost:9001 | Milestone 1 | Running |
| Email provider (Resend, Postmark or similar) | Sending real emails online | When the app goes online | Not started |
| Cloudflare R2 | Photo storage online | When the app goes online | Not started |
| Vercel (decided, Eden 2026-10-13) | Hosting the server online. Live chat runs on Vercel's WebSocket support (beta since June 2026). Work it needs before going online: a shared Redis hub so Socket.IO reaches people on other instances, the timers (pretend delivery, offer expiry, review reminders) as Vercel cron jobs, a hosted Postgres, and the app already reconnects when Vercel closes a connection (every 5 to 30 minutes) | When the app goes online | Not started |

Until the app goes online, the server, database and photos run on the development Mac.

## Branches and reviews

`main` is the only long-lived branch. Each piece of work gets its own branch and a pull request that Eden merges.

| Pull request | Contained | Status |
|---|---|---|
| #1 | Design rules, palette, component sheets | Merged |
| #2 | Tech foundation, blueprint, Milestone 1 Accounts, playbook and skills, supply chain rules | Merged |
| (open) | Milestone 2 Selling: sell form, category panels, pickers, photos, drafts, own listings, selling API | In review |

## Parked for later

- Real payments (provider, payouts, fees on real money)
- Real shipping (labels, tracking, carriers)
- Hebrew search quality (finding "השמלה" when searching "שמלה")
- Photo search (search by picture)
- Translating conversations
- Final fee and referral amounts (placeholders: 5 percent of the item price, 50 shekels per referral)
