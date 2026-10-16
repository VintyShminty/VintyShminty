# Gotchas

Traps in our stack. Format: symptom, cause, fix, source. Added by the `compile-memory` skill.

## Tooling

- **A pnpm command seems to hang.** A background helper keeps the output pipe open. Redirect output to a file instead of piping into `tail`. Source: `CLAUDE.md`.
- **Native package version mismatch.** Install Expo and native packages with `npx expo install`, plain JavaScript packages with `pnpm add`. Source: `CLAUDE.md`.
- **CI fails on formatting or import order.** Run `pnpm format`. Source: `CLAUDE.md`, commit `00e4ad3`.
- **Whole files reformatted after a format run.** Prettier was used. This project formats with Biome only, through `pnpm format`. Source: log 2026-10-15 (chat redesign).

## Database

- **Server tests fail only when all files run together.** They share one database. The server test files run one at a time (`--no-file-parallelism`). Source: commit `828ab96`.
- **An "online" migration quietly ran on the Mac's database.** drizzle-kit loads `.env` first and a loaded value is not replaced. `drizzle.online.config.ts` now reads `.env.online` itself. Check the table count online after a migration. Source: log 2026-10-13 late evening, commit `ed31472`.

- **Seed or reset refuses to run.** By design. It runs only in development against a local database. Source: `CLAUDE.md`.
- **Schema changed but a test fails.** The table list in `docs/blueprint/data-model.md` must match the schema. Update it in the same commit. Source: `docs/blueprint/data-model.md`, "Keeping this page true".
- **After editing the schema** run `pnpm db:generate` before `pnpm db:migrate`. Source: `CLAUDE.md`.
- **A schema branch clashes with main on the migration number.** Another change took the same number while the branch waited. Merge main in and regenerate the migration with the next number instead of merging the two files. If the local database already has the table from the old number, drop that one table and run again. Source: log 2026-10-15 (#85).

## App

- **Right to left follows the app language, not the phone (D-018).** The native side is always left to right and the app sets `direction` on its root view, so the language switch needs no restart. Never read `I18nManager.isRTL` (always false), use `useIsRtl()`. NativeWind `rtl:` classes never fire, pick the style from the language. Test in a development build. Source: `CLAUDE.md`, `lib/rtl.ts`.
- **A page opened from a tab must live inside that tab (D-017).** Put shared pages in `app/(app)/(tabs)/(home,inbox,profile,shop)/`, not on the root stack, or the tab bar disappears. Source: `docs/design.md` D-017.
- **A hard-coded colour fails a test.** Use tokens from `@/theme`. Source: `apps/mobile/tests/no-hardcoded-colours.test.ts`.
- **Left and right styles break Hebrew.** Use start and end (`ps-`, `me-`, `text-start`). Real case (before D-018): Hebrew text hugged the left edge because the phone swapped left and right in its own right to left mode. The swap is keyed to the layout direction, so it still happens with D-018: in `Text`, `text-left` means the start edge. `TextInput` does not swap, so `Input` picks right or left itself. Since #91 it follows the first letter typed (Hebrew sits right, English left), and an empty box or a price follows the app language. Source: `CLAUDE.md`, log 2026-10-12 evening, commit `4abebb7`, log 2026-10-15 (#91).
- **Face ID and forced right to left do nothing or crash in Expo Go** (the quick preview app). Use a development build: `npx expo run:ios`, which needs CocoaPods. Source: `CLAUDE.md`, log 2026-10-12 evening.
- **Missing font weights.** Aileron has no 200 or 500, Heebo no 100 or 200. They map to the nearest file. Source: `CLAUDE.md`.

- **Home fails online right after a merge.** A PR added a database column and was merged before the online database got it. Run the online migration first (`pnpm db:migrate:online`). Source: log 2026-10-14, memory `migrate-before-merge`.
- **A saved feed is thrown away every time.** It was checked against the owner before the app knew who was logged in. Check ownership only once the user is known. Source: log 2026-10-14 (#41).
- **A test or search looks wrong after another session switched the folder's branch.** The category list changed mid test (273 became 387). Freeze the data a test reads before starting. Source: log 2026-10-14.
- **The AI helper stays off online after the key was added.** The redeploy ran before the key was saved. Redeploy again. Source: log 2026-10-14.
- **Plain word search picks the wrong size or too narrow a type.** Give the AI sizes as written inside their group and tell it to pick the whole group unless a kind is named. "MK bag" still misses, known gap. Source: log 2026-10-14 (#68).
- **The simulator shows a red error after an update.** An old dev server does not know the new parts. Restart it. Source: log 2026-10-14.
- **Mockups time out on the test iPhone.** Open Expo Go first, then the link. Source: log 2026-10-14.
- **Apple and Google buttons are missing on a helper simulator.** Not a bug, the local server has no sign in keys. Source: log 2026-10-14.
- **The app crashes in the simulator right after switching branch.** The branch added a native piece (here a storage library) that the installed app lacks. Rebuild the app before testing. Source: log 2026-10-15 (chat redesign).
- **Address suggestions give no postcode.** Google often has none for Israeli street addresses. A second lookup (Geocoding) fills it, which needs the Geocoding API switched on for the key. Source: log 2026-10-15 (#87).
- **Close animation looks fine in stills but wrong to Eden.** Two guesses did not fix it, a frame by frame video showed the real cause. Record video for motion bugs. Source: log 2026-10-14 (#38).

## Libraries and CI

- **Installing a very new library version fails.** Versions younger than 7 days are refused on purpose. Wait, or add a temporary exception in `pnpm-workspace.yaml` with a date to remove it. Exceptions due: 2026-10-13 (overdue, still in the file on 2026-10-13 night) and 2026-10-19. Source: `docs/playbook/security-and-safety.md`, log 2026-10-12 evening.
- **The pull request check fails on a vulnerability scan.** It blocks on serious findings. Two build-tool findings (node-forge and braces, only on the developer machine) are accepted by name with a reason and a weekly recheck, anything new still blocks. Source: commit `4c4e85f`, `pnpm-workspace.yaml`.

## Vercel (the online server)

- **Build check fails on code that passes on the Mac.** Vercel type checks without "strict", so a few types read differently. Write code that passes both ways. Source: commit `5a22091`.
- **"Cannot find package ... @vinty/shared/src/index.ts".** Vercel does not translate our workspace packages. `apps/server/build.mjs` packs the server into `server.mjs`, which Vercel picks as the entry. Do not set an output directory, that turns the server into static files. Source: commits `1194fe2`, `2da0072`.
- **Every request hangs 60 seconds, no logs.** Vercel swaps `listen` for a stub while loading the file. Never `await app.listen()`. Source: commit `c1fa141`.
- **Something after the response never happens** (code emails, photo deletes). Vercel freezes the function after it answers. Wrap it in `waitUntil` from `@vercel/functions`. Source: commit `2457d36`.
- **A setting "looks right" but fails** (cron password refused, Google "OAuth client was not found"). The pasted value ends with an invisible line break. The server trims optional settings. Source: commit `bda40d6`.
- **Deploy refused: more than 15000 files.** The main folder holds local build files. Deploy from the clean copy, see `docs/going-online.md`. Source: log 2026-10-13 night.
- **Production settings cannot be read back.** Vercel's Neon values are sensitive. Copy the direct address from the Neon page's quickstart (Show secret) instead. Source: log 2026-10-13 late evening.

## Website

- **An item page opens scrolled down with its top cut off.** The grey loading placeholder in Next.js keeps the old scroll position. `apps/web/components/scroll-to-top.tsx` sits in the item page's `loading.tsx` and jumps to the top. Removing the placeholder also fixes it but makes clicks feel slow. Source: log 2026-10-15, D-040.
- **A card photo does nothing when clicked.** The card's invisible full-card link is covered by the later positioned photo block. Give the photo `pointer-events-none` and its buttons (bookmark, arrows) `pointer-events-auto` (`apps/web/components/item-card.tsx`). Source: log 2026-10-15.
- **The local website shows empty cards.** Docker (the app that runs the local database) is not running. Open Docker Desktop, then `pnpm db:up`. Source: log 2026-10-15.
- **Website search acts like a plain search when tested.** The Browser pane was hidden, which stops the search box from waking up. Open the pane before testing interactions. Source: log 2026-10-14, memory `browser-pane-hidden-hydration`.
- **"I see no difference" in review.** Two branches reviewed one after the other, and the local website showed the other one. Say which branch is on screen. Source: log 2026-10-15.

## Sign in

- **Google login ends on "account not linked".** The existing Vinty account with that email never confirmed its email. Linking needs a confirmed email, on purpose. The person confirms first, then Google links. Source: log 2026-10-13 night, D-023.
- **Google always signs in with the last account.** The browser sheet remembers it. The server asks Google to show the chooser (`prompt: select_account`). Source: commit `f65e0a1`.
- **Apple's button text cannot be styled.** iOS draws it in its own typeface and sizes it from the button height. Match other buttons to it. Source: commit `47b6aa6`.
- **The app ignores a new feature after the app ID changed.** The simulator still has the old app. Install the new development build. Source: log 2026-10-13 night.

## Apple and tools

- **App Store Connect forms ignore quick fills on dropdowns.** Pick with the keyboard. Escape closes the whole form. Source: log 2026-10-13 night.
- **A TestFlight tester sees nothing.** Status "Invited" means the invite email was not accepted yet. Internal testers first join the Apple team (Users and Access). Source: log 2026-10-13 night.
- **Simulator typing comes out in Hebrew.** The Mac or simulator keyboard is Hebrew. Use the pasteboard, or for a password field set the simulator to the English layout only for the test and restore it after. Source: handoff 2026-10-13, log 2026-10-15 (chat redesign).
- **Typecheck errors on new routes in a new worktree.** The typed routes file is stale. Copy `apps/mobile/.expo/types/router.d.ts` from the main checkout or run Metro once. Source: handoff 2026-10-13.
- **The Mac crawls** (load average in the hundreds). Several simulators, leftover test servers or Spotlight indexing the copies. It also fakes app bugs: photo uploads looked stuck and the Android emulator froze. Closing a simulator window does not stop it, shut it down. One helper simulator at a time, stop your own processes by id. Source: memory, log 2026-10-13, log 2026-10-15 (#88, #89).
