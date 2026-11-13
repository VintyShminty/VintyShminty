# Handoff: fix the two security audit findings (2026-10-16)

For a fresh Claude session. Read `CLAUDE.md` first, then this file. Start a new branch from `main` with the `git-workflow` skill (for example `fix/security-audit-oct16`). Never commit to `main`. Eden merges.

## Context

On 2026-10-16 a full security audit of the server, the website and the phone app found two medium issues. The server was clean. Log entry: `docs/log/2026-10-16.md`. Both issues were confirmed by reading the code. Nothing has been changed yet.

## Finding 1: open redirect in the website's `next` parameter

**Where:** `apps/web/lib/login-links.ts`, the `safeNext` function. It is used by:

- `apps/web/app/[lang]/log-in/page.tsx` (server redirect when the visitor is already logged in)
- `apps/web/app/[lang]/sign-up/page.tsx` (same)
- `apps/web/components/auth/log-in-form.tsx` (client redirect after login)
- `apps/web/app/[lang]/welcome-questions/page.tsx` with `components/auth/welcome-questions.tsx`
- `components/auth/sign-up-flow.tsx`

**Problem:** the check rejects values that do not start with `/`, that start with `//`, or that contain `\`. A value like `/%09/evil.com` (a tab after the slash) passes. Browsers strip tab and newline when parsing an address, so `/\t/evil.com` becomes `//evil.com`, a protocol-relative link to another site. Next 16 writes the redirect target into the Location header as given, and Node allows a tab in a header value, so the server path is exploitable. The client path (`router.replace`) resolves to a different origin and does a full navigation there.

**Fix:** make `safeNext` strict. Parse with `new URL(next, "https://x.invalid")`, require `origin === "https://x.invalid"`, and return `pathname + search + hash` from the parsed result. Also reject any control or whitespace character (`/[\u0000-\u001F\u007F\s]/`) before parsing. Optionally require the path to start with `/en/` or `/he/` (see `lib/i18n.ts` for the language list).

**Tests:** `apps/web/tests/` is Vitest. Add cases for `/%09/evil.com` (decoded: tab), `/\n/evil.com`, `//evil.com`, `/\\evil.com`, `https://evil.com`, and a good value like `/en/item/123?x=1#y` that must come back unchanged.

## Finding 2: Face ID lock does not cover native full-screen modals in the app

**Where:**

- `apps/mobile/app/_layout.tsx`: the lock (`components/app-lock.tsx`) is rendered as a sibling view after the root `Stack`, absolute positioned with `z-50`, only when `signedIn && locked`. The `Stack.Protected` guard checks `signedIn` only, not `locked`.
- `apps/mobile/app/(app)/_layout.tsx`: `sell-form` and `onboarding` use `presentation: "fullScreenModal"`, `face-id-offer` uses `presentation: "modal"`.
- Lock state: `apps/mobile/lib/lock-store.ts` (`useIsLocked`, `unlocked`, `LOCK_AFTER_MS` from `lib/config.ts`).

**Problem:** react-native-screens presents a `fullScreenModal` as a separate native view controller above the whole root view, so it appears above the lock overlay. The lock is not repeated inside those modals. Someone with the unlocked phone can open `vinty://sell-form` (or `vinty://sell-form?id=<draftId>`) while the app is locked, cancel Face ID, and use the sell form fully: make and publish listings as the owner. Other private pages stay covered.

**Fix options, pick one and say why in the PR:**

- (a) Preferred: render the lock as its own native layer, a React Native `Modal` with `presentationStyle="overFullScreen"` and `visible={signedIn && locked}`, so it sits above every native modal. Keep the current content and behaviour of `AppLock` (auto prompt on appear and on return from background, "Use password" signs out and wipes local data).
- (b) Dismiss open modals when the app locks: when `locked` turns true call `router.dismissAll()` in the root layout, then show the overlay as now. Simpler, but the person loses an unsaved sell form.
- (c) Render `<AppLock>` inside `app/(app)/sell-form/_layout.tsx` and the onboarding screen as well. Most repetition, easy to forget on the next modal.

Rules to respect: no hex colours (`apps/mobile/tests/no-hardcoded-colours.test.ts`), logical start and end styles only, wording keys in both `packages/locales/en.json` and `he.json`, tokens from `@/theme`. The sell form has its own `BottomSheetModalProvider` (see `CLAUDE.md`), keep that working.

**Also check:** Gorhom bottom sheets that were open when the app locked. The root `BottomSheetModalProvider` wraps the lock, and `PortalHost` is rendered after the lock in `app/_layout.tsx`, so open sheets or portals may draw above the overlay too. Option (a) covers this as well.

**Verify on a device or dev build** (Expo Go cannot do real Face ID, see `CLAUDE.md`): turn Face ID on in the app, background it for more than 5 minutes (or temporarily lower `LOCK_AFTER_MS`), open `vinty://sell-form` from Notes or Safari, and confirm the lock screen is on top and the sell form is not usable until Face ID passes. Also confirm a sheet open at lock time is covered.

## Below the bar, no action needed unless cheap

- `apps/server/src/routes/me.ts` (account delete) and `apps/server/src/routes/admin.ts` around line 160 delete verification rows with `like '%<email>%'` without escaping `%` and `_`. Impact is limited to clearing other people's pending codes. If touched, escape the pattern or match the identifier exactly.
- Public AI routes (`routes/search-assist.ts`, `routes/help-assist.ts`) accept calls without a login. Cost question only, already rate limited.

## Done looks like

- Both fixes on one branch, `pnpm typecheck`, `pnpm lint` and `pnpm test` green, a PR opened with a plain-language description for Eden.
- Run the `safety-check` skill before the commit.
- A line added to `docs/log/<date>.md` under a new heading for that session.
