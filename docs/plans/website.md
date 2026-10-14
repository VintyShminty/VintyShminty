# Plan: the Vinty website

Status: W0 done (branch feat/website-w0, layout in D-030), W1 next. Decided by Eden on 2026-10-14.

## Why

> i want to start setting up the website, and the website also functions as a product. its as important as the app.
> (Eden)

## Decisions (Eden, 2026-10-14)

- **A separate website, not the phone app turned into a web page.** The app's screens are made for a phone held upright and use phone-only parts (Face ID, slide-up sheets, haptics). The website gets its own screens, built for phone browsers and laptops and for Google, and shares everything behind the screens with the app: the server, accounts, database, selling rules, translations, colours and fonts.
- **Everything at once.** The website matches the app (browse, search, buy, offers, chat, orders, sell, profile, settings) before anyone outside the team sees it. It is built in the steps below, but shown only when all of them are done.
- **Temporary address for now.** The website runs on a free Vercel address (`https://<name>.vercel.app`). A real domain comes later (see "When the domain arrives").
- **Same spec, with our changes.** The website follows the product spec (`docs/vinted-ux-spec.html`, including its web site map) for how things work, with every change we made applied on top: `docs/design.md` (D-001 onward, D-019 especially), `docs/originality.md`, the wording in `apps/mobile/i18n/locales/` and the scope in `docs/roadmap.md`. Never its names, wording, icons or visual details.

## What the website will not have

Things only a phone can do: Face ID unlock, push alerts, haptics, the photo library picker (the browser's file picker instead). Real payments and shipping stay out, the same as the app (checkout is simulated).

## Steps

### W0. One website brief and the laptop look (design, before any code)

1. Write `docs/website-brief.md`: every page of the spec's web site map, each with what changed for us (our wording, D-019 cards, our tab names, removed and renamed features). This is the one place the website is built from.
2. Laptop layouts do not exist yet (every decision so far is for the phone). Make mockups in `docs/mockups/` for the key pages at phone and laptop width, English and Hebrew: home feed, browse and search with filters, item page, seller page, inbox and chat, checkout, sell form, profile and settings.
3. Eden picks. Each choice becomes a D-entry in `docs/design.md` (the top bar that replaces the tab bar, the grid widths, where filters sit on a laptop, side by side inbox and chat, what sheets become on a laptop).

**Eden can check:** the mockups, in both languages.

### W1. Foundation

1. **Shared pieces move out of the app into packages** both sides use, without changing how the app looks or works:
   - the design tokens and fonts (today `apps/mobile/theme/`), so one colour change reaches both
   - the translations (today `apps/mobile/i18n/locales/`), so wording stays the same in both
   - the calls to the server and their types (today in `apps/mobile/lib/`)
2. **A new `apps/web`**: Next.js (App Router, server rendered), Tailwind reading the same tokens, Aileron and Heebo, TanStack Query, the same Zod schemas from `packages/shared`.
3. **Hebrew and English with right to left** from the first page, the language in the address (`/en/...`, `/he/...`) so Google lists both.
4. **Logging in works on the website.** The website forwards `/api/auth` and `/v1` to the server through its own address, so the login cookie belongs to the website (Safari and Chrome block login cookies from another address). The server adds the website address to its trusted list (`CORS_ORIGIN`, Better Auth `trustedOrigins`).
5. **Live chat in the browser:** the browser connects to the server for live messages. Check early that the login reaches that connection on the temporary address (the biggest unknown in this plan, see Risks).
6. **Online:** a second Vercel project with `apps/web` as the root, deployed by itself on merges into `main`, the same way as the server. `pnpm typecheck`, `pnpm lint`, `pnpm test`, the hard-coded colour guard and Semgrep cover the website too.

**Eden can check:** an empty website online in both languages, in our colours and fonts, and the app unchanged.

### W2. Public pages (no login needed)

Home, Browse with the item type tiles and category panels, search with filters and sort, item page, seller page, help.

- Pages are built on the server so Google can read them, with a sitemap and a page title per item.
- A shared item link shows the photo, title and price in WhatsApp and other apps.
- Logged out visitors can look at everything and are asked to log in when they heart, message, buy or sell.

### W3. Accounts

Sign up, log in, the 6 digit codes, forgot password, Apple and Google, the two short questions after sign up (D-022), profile and edit profile, settings (language, privacy, Not interested, Reset), favourites, saved searches, followed sellers. The website sends the same feed signals as the app (hearts, opens, searches) so the home feed learns from both.

Eden does by hand (steps written for him when we get there):
- **Google:** add the website's return address to the existing web client.
- **Apple on the web** needs what the app did not: a Services ID, a return address and a key in Apple Developer.

### W4. Messaging

Inbox and live chat, the order tracker card in chat, notifications list. On a laptop, inbox and chat side by side (from W0).

### W5. Orders

Offers (send, accept, decline, counter), simulated checkout, order timeline, Mark as shipped and I received it, reviews, pretend balance and withdrawals, bundles.

### W6. Selling

The sell form with categories and pickers, photo uploads from the computer or phone browser, drafts, own listings, edit and delete. Photos upload straight to Cloudflare R2 from the browser, so the R2 bucket needs a CORS rule allowing the website address (Eden adds it, steps written then).

### W7. Finishing

- Terms and privacy pages (the App Store needs them too).
- Every page checked at phone and laptop width, in English and Hebrew, logged in and logged out, with loading, empty and error states.
- Keyboard and screen reader basics, page speed.
- Then shown.

## When the domain arrives (later)

- The website moves to the domain and the server to `api.<domain>`.
- Real sign up emails for everyone (Resend sends from the domain).
- Photos on a proper R2 address instead of the development one.
- Item links open the app when it is installed (Universal Links).
- Invite links use the real address.

## Risks

- **Every feature is built twice from now on.** Each new feature needs app screens and website screens. The shared packages keep the rules, data and wording single, but the screens are double work.
- **Live chat login on the temporary address.** The website and the server sit on two different `vercel.app` addresses, which browsers treat as strangers. Normal pages work through the forwarding in W1, but the live chat connection may not. Fallback: the website asks the server for a short-lived chat pass and hands it to the connection. Checked in W1, before building on it.
- **Vercel's live connections are in beta** (already true for the app).
- **Moving shared pieces out of the app** could break the app if done carelessly. Done in W1 with the app checked in the Simulator after the move.
- **Apple on the web** needs extra Apple Developer setup that has not been tested here.

## Order of work and branches

One branch and pull request per step (W0 to W7), Eden merges each. The website stays unannounced until W7 is merged.
