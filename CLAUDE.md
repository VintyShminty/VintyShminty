# VintyShminty

Working name. A Vinted-style second-hand marketplace, phone app first. Light mode only (D-002). English and Hebrew (RTL).

## Stack

pnpm workspace (pnpm 11, Node 22 via `.nvmrc`), TypeScript 6 everywhere.

- `apps/mobile`: Expo SDK 57, Expo Router, NativeWind 4 with Tailwind 3.4, React Native Reusables (rn-primitives), Lucide icons, Gorhom Bottom Sheet, TanStack Query, Zustand, React Hook Form with Zod, i18next.
- `apps/server`: Fastify 5, `fastify-type-provider-zod`, pino logging, env validated with Zod.
- `packages/db`: Drizzle ORM with postgres-js. Migrations in `packages/db/drizzle`.
- `packages/shared`: Zod schemas and types shared by app and server.

The data model is designed (Milestone 0, `docs/blueprint/`). Milestone 1 added Better Auth (email and password, username, 6 digit email codes, sessions), profile, settings, avatar uploads, Face ID unlock and the Hebrew and English switch.

Not added yet (they need decisions or credentials): payments, Socket.IO, Cloudflare R2 (MinIO stands in for it), a real email provider (Mailpit catches mail in development), push notifications, Google and Apple sign in (prepared, off until credentials exist).

## Repo map

```
apps/mobile/app/            Expo Router screens. (dev)/gallery.tsx is the dev-only design gallery
apps/mobile/components/ui/  Reusables components restyled to our design (Text, Button, Badge, Chip, Switch, Icon)
apps/mobile/theme/          tokens.js (colours, radii, spacing, type scale), fonts.js. The single source of truth
apps/mobile/i18n/           i18next setup and locales/en.json, locales/he.json
apps/mobile/lib/            utils (cn), fonts, query client, app store, rtl
apps/mobile/tests/          Vitest, includes the hard-coded colour guard
apps/server/src/            env.ts, app.ts, plugins/, routes/, lib/
docs/design.md              Design source of truth and decision log (D-001 onward)
docs/components.md          Component inventory
docs/roadmap.md                Milestones, scope and status (source of truth, update when a milestone starts or ships)
docs/blueprint/data-model.md   Every table, state machine and open decision (Milestone 0 blueprint)
docs/blueprint/api.md          The API contract by milestone, Socket.IO events, push types
packages/db/src/schema/     Drizzle schema split by domain. packages/db/src/seed/ has the reference and sample seeds
docs/playbook/              Design method rules
```

## Run it

```
pnpm install
cp apps/server/.env.example apps/server/.env     # and packages/db/.env.example to packages/db/.env
pnpm db:up          # Postgres 17, Mailpit (email inbox http://localhost:8025) and MinIO (photos, console http://localhost:9001) in Docker
pnpm db:migrate     # apply migrations. After a schema change run pnpm db:generate first
pnpm dev:server     # http://localhost:3000, check /health and /health/db
pnpm dev:mobile     # Expo dev server. Press i for the iOS Simulator
pnpm db:seed        # reference data + fake sample data (development only, wipes user data first)
pnpm db:reset       # drop everything, migrate, seed. Run it twice, you get the same data
pnpm db:seed:reference  # only the reference data (categories, brands, sizes...). Safe anywhere
pnpm db:dev-users   # dev only: gives 3 seeded people (oliver.smith, tamar.avraham, noa_levi) a random password, written to apps/server/.dev-credentials.local (git-ignored) and the console. Run after every db:reset
pnpm storage:seed   # dev only: uploads the sample photos to the MinIO bucket so sample listings show pictures. Run after every db:reset
pnpm db:down        # stop the containers (data stays in the Docker volumes)
```

`db:seed` and `db:reset` refuse to run unless `NODE_ENV` is `development` (it defaults to that when unset) and the database is on this machine. Sample photos live in `packages/db/seed-assets/` (credits in `CREDITS.md`). Listing photo keys look like `seed/listings/<n>/<file>.jpg`, the file name is the file in `seed-assets`.

Gallery: in a dev build open Profile, Settings and tap "Open the design gallery" at the bottom. It shows the colours, type scale (Aileron and Heebo), Button, Badge, Chip and Switch. Use it to check any token or component change.

Before committing run `pnpm typecheck`, `pnpm lint` and `pnpm test`. `pnpm format` fixes formatting and import order. CI runs the same three.

## Accounts and services

- Sign in is Better Auth under `/api/auth/*`. Password reset, email confirmation and email change use a 6 digit code by email, not a link. The app sends the session cookie to `/v1` (`apps/mobile/lib/api.ts`).
- Email goes through the `Mailer` interface in `apps/server/src/lib/mail.ts`. Development sends SMTP to Mailpit. To use a real provider, write another `Mailer` and choose it in `createMailer`.
- Photos go through `Storage` in `apps/server/src/lib/storage.ts` (S3 protocol, MinIO now, Cloudflare R2 later: set `S3_ENDPOINT`, `S3_REGION=auto`, keys and `S3_PUBLIC_URL`). MinIO no longer publishes Docker images, so compose uses the last Bitnami build.
- Server env vars are in `apps/server/.env.example`. Google sign in needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, Apple sign in needs `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET` and `APPLE_APP_BUNDLE_IDENTIFIER`. Each provider switches on when its values are set. In production `BETTER_AUTH_SECRET` must be a real secret.
- The app finds the server through `EXPO_PUBLIC_API_URL` (default `http://localhost:3000`, right for the iOS Simulator). On a real phone put your Mac's address in `apps/mobile/.env`.
- Face ID is a phone setting kept in secure storage (`lib/lock-store.ts`), locking after 5 minutes away (`LOCK_AFTER_MS`). Expo Go on iOS cannot show Face ID (no usage description), so in development inside Expo Go the app asks with a plain Match or Do not match dialog. Real Face ID and real right to left need a development build (`npx expo run:ios`, needs CocoaPods).
- The shared package imports its own files as `./x.js`. Metro cannot do that, so `apps/mobile/metro.config.js` retries without the extension for files in `packages/`.

## Rules

- Update `docs/roadmap.md` status when a milestone starts or ships.
- Schema changes (a table, column, index or enum) must update `docs/blueprint/data-model.md` in the same commit. A test fails if a table is missing from it. Enum value lists live in `packages/shared/src/enums.ts` and feed both the database and zod.
- Money is an integer in minor units plus a currency code. The order and offer state machines are pure functions in `packages/shared/src/state-machines.ts`. Change them there, nowhere else.
- Follow `docs/design.md`. Record every new design decision there in the same format as D-001 to D-014. Where nothing is decided, follow the product spec (the Vinted UX deconstruction).
- Colours, radii, spacing and type come from tokens only. Never write a hex or `rgb()` value in `app/`, `components/`, `lib/` or `i18n/`. `apps/mobile/tests/no-hardcoded-colours.test.ts` fails if you do. When a native prop needs a colour value, import it from `@/theme`.
- Use logical start and end styles for RTL (the `Text` and `Input` components set the text alignment from the app language, because the phone's own language would otherwise decide, which is wrong for an English app on a Hebrew phone): `ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`. Never `left`, `right`, `pl-`, `pr-`, `ml-`, `mr-`. Place things with `justify-start` and `justify-end`, not a translate.
- No hard-coded user-facing strings. Add a key to both `locales/en.json` and `locales/he.json` and use `t("...")`.
- Writing rules for anything a user reads: no em dashes or en dashes, no semicolons, no full stop on headings and short labels, proper capitalisation, warm and direct.
- Install native or Expo packages with `npx expo install` so versions match SDK 57. Plain JavaScript packages use `pnpm add`.
- Run pnpm commands with output redirected to a file, not piped into `tail` (a background helper process keeps the pipe open and the command appears to hang).
- Never commit `.env` files or secrets. Only `.env.example` files are committed.
- Server data goes through TanStack Query and never blanks a screen while reloading (see `lib/query-client.ts`). Zustand is for small app state only.

## Design tokens and the Reusables mapping

Tokens live in `apps/mobile/theme/tokens.js` as hex values. `tailwind.config.js` turns them into CSS variables (HSL triplets, as Reusables expects) and Tailwind classes. Our own names work as classes too: `bg-surface`, `bg-pressed`, `text-text-1` to `text-text-4`, `border-border-subtle`, `bg-accent-tint`, `bg-success-tint`, `text-warning`, `bg-error-tint`, `bg-window`, `bg-backdrop`.

| Reusables name | Our token | Notes |
|---|---|---|
| background | background (#FFFFFF) | |
| foreground | text-1 | |
| card, popover | background | card-foreground and popover-foreground are text-1 |
| primary | accent (#4B2E22, espresso) | Our design "accent" is Reusables "primary". primary-foreground is on-accent |
| secondary | surface | secondary-foreground is text-1 |
| muted | surface | muted-foreground is text-3 |
| accent | pressed | Reusables "accent" is a hover and pressed surface, not our accent colour. accent-foreground is text-1. `accent-tint` is our info tint |
| destructive | destructive (same value as error) | |
| border | border | Hairline default. Subtle is `border-border-subtle` |
| input | border | Chip outlines use `border-text-4` (D-008) |
| ring | accent | |

Radii: `rounded-control` 12 (buttons, photos, tiles), `rounded-window` 20, `rounded-bar` 32, `rounded-full` for chips and badges. Spacing names: `xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 24, `2xl` 40 (for example `p-lg`, `gap-md`). Type scale classes: `text-display`, `text-title`, `text-item-name`, `text-heading`, `text-body`, `text-body-sm`, `text-subtitle`, `text-card-brand`, `text-card-desc`, `text-card-meta`, `text-pill`, `text-badge`, `text-section-label`, `text-small-label`. Use the `Text` component with a `variant` instead of raw classes, it also picks the weight and typeface.

Dark mode is not built. The theme has no dark variables on purpose.

## Fonts

Aileron for Latin, Heebo for Hebrew (D-011). Files are in `apps/mobile/assets/fonts` with their licences (Aileron CC0, Heebo OFL). React Native needs one family name per weight, so Tailwind has `font-aileron-<weight>` and `font-heebo-<weight>`. The `Text` component chooses the family from the current language.

- Aileron files: 100, 300, 400, 600, 700, 800. Missing: 200, 500 (and 900). Mapping: 200 uses Light 300, 500 uses SemiBold 600.
- Heebo files: 300 to 800 (generated as static instances from the Google Fonts variable font). Missing: 100, 200, which use 300.
- The design doc asks for 200 to 300 on large headings, so the display style uses Light 300.

## Right to left

Layout direction is fixed by the native layer at app start, so switching needs a restart. If the phone is set to Hebrew, the OS starts the app in RTL by itself because `he` is in the `supportedLocales` of the `expo-localization` plugin in `app.json`. For a language picked inside the app, `lib/rtl.ts` calls `I18nManager.allowRTL(true)` and `I18nManager.forceRTL(...)` and then reloads (`DevSettings.reload()` in development). A production build needs `expo-updates` (`Updates.reloadAsync()`), which is not installed yet. Expo Go cannot do a forced RTL at all (it crashes), so test right to left and Face ID in a development build: `cd apps/mobile && npx expo run:ios` (needs CocoaPods, `LANG=en_US.UTF-8`), then `npx expo start --dev-client`.

## Skills

Project skills live in `.claude/skills/` (sources and every change in `.claude/skills/SOURCES.md`).

- `expo-router`: routes, layouts, stacks, tabs, modals, form sheets, headers, search.
- `expo-native-ui`: screen structure, safe areas, icons, media, storage, effects.
- `expo-ui`: the `@expo/ui` native components. Check it before adding a native control, but our stack (Reusables, Gorhom Bottom Sheet) stays the default.
- `expo-animation`: any motion, gestures, haptics, reduced motion.
- `expo-data-fetching`: network calls, caching, offline, the four screen states.
- `expo-project-structure`: only for new folders and files. Never restructure existing code to match it.
- `expo-upgrade`: Expo SDK upgrades and deprecated packages.
- `react-native-skills`: Vercel's React Native performance and pattern rules (lists, state, rendering).

Never run Expo's feedback command (submit-expo-feedback) or any skill step that sends data to a third party.

Styling: our design system wins. Use NativeWind classes, the React Native Reusables components and the tokens in docs/design.md. Where a skill recommends native iOS look, system colours or platform controls that conflict, follow docs/design.md.

Better Auth skills (github.com/better-auth/skills) are to be added when auth work starts.

## Docs for agents

Fetch these before guessing at an API:

- Expo: https://docs.expo.dev/llms.txt
- Drizzle: https://orm.drizzle.team/llms.txt (an index, the full file is very large)
- Better Auth: https://better-auth.com/docs/llms.txt (for later auth work)
- Fastify: https://fastify.dev/llms.txt
- NativeWind: https://www.nativewind.dev/llms.txt
- Reanimated: https://docs.swmansion.com/react-native-reanimated/llms.txt
- TanStack: https://tanstack.com/llms.txt
- Zod: https://zod.dev/llms.txt
- i18next: https://www.i18next.com/llms.txt
- Cloudflare R2: https://developers.cloudflare.com/r2/llms.txt (later)
- Vercel: https://vercel.com/docs/llms.txt

React Native Reusables, react-hook-form, Gorhom Bottom Sheet and Socket.IO have no llms.txt. Use the Context7 or DeepWiki tools for those.

## Where decisions live

- Design decisions: `docs/design.md` (approved D-001 to D-014, open decisions at the bottom).
- Design method: `docs/playbook/design-philosophy.md`.
- Components to build: `docs/components.md`.
- Mockups for reference only: `docs/mockups/`.

## Process

How we work lives in `docs/playbook/`: `how-we-work.md`, `git-and-github.md`, `security-and-safety.md`, `debugging.md`. The knowledge base is `docs/log/` (one diary entry per day) and `docs/knowledge/` (decisions, lessons, gotchas, glossary). Read `docs/knowledge/` before touching an unfamiliar area.

- `daily-log`: at the end of each working session.
- `compile-memory`: at the end of each milestone, or about weekly.
- `safety-check`: before committing, opening a PR, adding a dependency, or touching auth, uploads or data.
- `git-workflow`: starting a branch or worktree, committing, opening a PR.

Never commit straight to `main`. Eden merges.
