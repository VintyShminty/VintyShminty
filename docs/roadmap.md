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
| 2 | Selling | The full sell form with categories and photos, drafts, your own listings, editing and deleting | Built on branch `milestone-2`, in review (pull request "Milestone 2: Selling") |
| 3 | Discovery | Home feed, Browse grid with category panels, search, filters and sort, item page, seller profiles, favourites, saved searches | Planned |
| 4 | Messaging | Live chat, offers (send, accept, decline, counter), notifications, push alerts | Planned |
| 5 | Orders | Simulated checkout, order timeline, pretend balance and withdrawals, reviews, bundles | Planned |
| 6 | Extras | Boost and bump, invite friends, help pages, holiday mode and the rest of the spec | Planned |

Every milestone ends with something you can use on your phone, in both languages.

## Foundations already in place

- **Design:** The Vinty look adapted for the phone, Espresso and cream palette, Aileron with Heebo for Hebrew, item card option C, chips and badges option B, bottom tab bar with Browse category panels (`docs/design.md`, decisions D-001 to D-014).
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
| Vercel | Hosting the server online | When the app goes online | Not started |

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
