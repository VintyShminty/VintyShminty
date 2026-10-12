# VintyShminty (working name) Design

Source of truth for the product's look, feel, navigation and approved UX decisions. Method rules live in `docs/playbook/design-philosophy.md`. This file holds the concrete choices. The product is a phone app (React Native), so desktop rules inherited from Kept are adapted below (see D-005).

Starting point (D-001 below): everything here is inherited from Kept's design **except colour**, which was decided fresh (D-006), then adapted for a phone app (D-002 to D-005). Change any value freely; record why in the decision log.

Authority order for design work:
1. Eden's current direction.
2. Approved and Implemented decisions below.
3. Platform accessibility conventions (iOS and Android).
4. Design handoffs and mockups (references, not rules).
5. Current implementation details.

## Principles

- Make the user's next useful action visible before supporting tools or detail.
- Quiet, editorial chrome; content (listing photos) leads.
- Preserve working journeys before changing layout. Never remove a save, recovery or return path in a redesign.
- Empty, loading, error, recovery, large text and one-handed reach are normal design states.
- Light mode only for now (D-002). When dark mode returns, both themes are designed and checked for every new window.

## Colour

Palette: Espresso and cream (D-006). Light mode only for now (D-002). Requirements whatever the palette:
- Every colour is a named token; no hard-coded values in components.
- Tokens for: page background, raised surface, pressed surface, window fill, backdrop, border default, border subtle, text ladder (primary / secondary / muted / faint), accent, on-accent, and state (success, warning, error, destructive).
- Text is a ladder of steps. When dark mode returns, light-mode values are solved to match dark-mode contrast, not mirrored.
- Never pure black as a surface; reserve it for shadows/overlays.
- Listing photos and user content are never tinted.

| Token | Hex | Used for |
|---|---|---|
| background | #FFFFFF | Page background |
| surface | #FBF8F2 | Raised surface: search bar, cards, inactive chips |
| pressed | #F1E9DA | Pressed surface, switch track when off |
| border | #E4DACA | Border default |
| border-subtle | #F0EADF | Border subtle, dividers, inactive chip outline |
| text-1 | #241811 | Primary text |
| text-2 | #54443A | Secondary text |
| text-3 | #695A4F | Muted text |
| text-4 | #7A6B60 | Faint text |
| accent | #4B2E22 | Primary button fill, links, prices, active tab, outline button |
| on-accent | #FFFFFF | Text and icons on the accent fill |
| accent-tint | #F7EEDC | Info banners, "New" badge |
| chip-selected | #EFE0C3 | Selected chip fill |
| on-chip | #3A2218 | Label on a selected chip |
| success | #1B7A43 | Sold ribbon, success text |
| success-tint | #E6F4EA | Success background |
| warning | #8A4F00 | Warning text |
| warning-tint | #FFEFC2 | Warning background |
| error | #B3261E | Error text and field outline |
| error-tint | #FDECEA | Error background |
| destructive | #B3261E | Destructive actions (same value as error) |
| window | #FFFFFF at 96% | Window and sheet fill (derived from background, not in the mockup) |
| backdrop | #241811 at 25% | Dim behind windows and sheets (derived from text-1, not in the mockup) |

Measured contrast (WCAG formula, from the mockup's computed table):

| Pair | Colours | Measured | Needs |
|---|---|---|---|
| Primary text on page | #241811 on #FFFFFF | 17.30:1 | 4.5:1 |
| Secondary text on page | #54443A on #FFFFFF | 9.27:1 | 4.5:1 |
| Muted text on page | #695A4F on #FFFFFF | 6.61:1 | 4.5:1 |
| Faint text on page | #7A6B60 on #FFFFFF | 5.12:1 | 4.5:1 |
| Muted text on raised surface | #695A4F on #FBF8F2 | 6.24:1 | 4.5:1 |
| Faint text on raised surface | #7A6B60 on #FBF8F2 | 4.83:1 | 4.5:1 |
| Primary button label | #FFFFFF on #4B2E22 | 12.26:1 | 4.5:1 |
| Price line, links, outline button | #4B2E22 on #FFFFFF | 12.26:1 | 4.5:1 |
| Active tab icon and label | #4B2E22 on #FFFFFF | 12.26:1 | 4.5:1 |
| Price line on raised surface | #4B2E22 on #FBF8F2 | 11.56:1 | 4.5:1 |
| Accent on tint (banner, badge) | #4B2E22 on #F7EEDC | 10.63:1 | 4.5:1 |
| Selected chip label | #3A2218 on #EFE0C3 | 11.34:1 | 4.5:1 |
| Sold ribbon label | #FFFFFF on #1B7A43 | 5.37:1 | 4.5:1 |
| Success text on page | #1B7A43 on #FFFFFF | 5.37:1 | 4.5:1 |
| Success on success tint | #1B7A43 on #E6F4EA | 4.73:1 | 4.5:1 |
| Warning text on warning tint | #8A4F00 on #FFEFC2 | 5.74:1 | 4.5:1 |
| Error text on page | #B3261E on #FFFFFF | 6.54:1 | 4.5:1 |
| Error on error tint | #B3261E on #FDECEA | 5.72:1 | 4.5:1 |
| Switch on and primary fill against page (3:1 for icons) | #4B2E22 on #FFFFFF | 12.26:1 | 3:1 |

All pairs pass. Faint text on the raised surface (4.83:1) is the tightest, so do not go lighter than text-4 for any text.

## Typography

Inherited from Kept. The typeface is Aileron (D-003), self-hosted, same structure as Kept.

- One family for UI, self-hosted, every weight used actually loaded (no browser-faked weights).
- Signature: light display weight against heavy emphasis. Light weights (200-300) are for large headings only, never small text (D-005).

| Element | Size | Weight | Notes |
|---|---|---|---|
| Hero / greeting | ~40px on phone | 200-300 | Large headings only, never small text. Tight negative tracking (-0.035em), line-height ~0.96 |
| Hero emphasis (name, last phrase) | same | 600-800 | |
| Page title | ~32px | 700 | |
| Page subtitle | 14px | 400 | Secondary text |
| Item name (large) | ~28px | 800 | |
| Sheet / list heading | 18px | 700 | |
| Section header | 12px | 600 | Uppercase, muted, tracked |
| Small label | 10px | 500 | Uppercase, muted, wide tracking (0.12em) |
| Card title | 13px | 500 | |
| Card subtitle | 11px | 400 | Uppercase, muted |
| Filter pill | 13px | 500 | |
| Badge | 10px | 600-700 | Tracking 0.08em |
| Body | 14-16px | 400 | Inputs at 16px |

Wordmark on loading screens is typographic (bold, tight tracking, soft pulse), never an image.

## Spacing and layout

8px base grid.

| Token | Value | Usage |
|---|---|---|
| xs | 4px | Icon to text, tiny separators |
| sm | 8px | Between pills, badge to edge |
| md | 12px | Grid gap, card padding |
| lg | 16px | Between sections on the same level |
| xl | 24px | Between major sections |
| 2xl | 40px | Page top padding, large breaks |

- Phone app. Bottom tab bar (Home, Browse, Sell, Inbox, Profile) replaces the desktop top nav. Page side padding 16px.
- Item grid: 2 columns on phone, 12px gaps. Item cards are portrait 3:4 (`aspectRatio: 3 / 4`), not square (D-005).
- Larger screens (tablet): 3 columns, same 3:4 cards.
- Each scroll container owns its own bottom clearance above the tab bar and the home indicator (safe area).

## Shapes and depth

- Window radius 20px; buttons 12px; pills fully rounded; search/prompt bar 32px.
- Borders are hairlines (0.5-1px, low opacity). A window's top edge is slightly brighter than its sides and bottom.
- No drop shadows on cards or windows. Depth = border + blur + surface shift.
- Glass (translucent + blur ~24px) only for floating chrome (search bar, floating buttons), never for reading surfaces.

## Components

**Windows (modals and sheets).** Near-opaque fill (~96%), blur 60px, hairline border with brighter top edge, 20px radius, no shadow. Backdrop: light dim (~25%) + 8px blur. On the phone, slide-up sheets (filters, price breakdown, make an offer) use Gorhom Bottom Sheet (D-004) with the same fill, radius (20px on the top corners) and backdrop. Opacity below ~90% is banned (text gets hard to read). Nested windows sit above their parent.

**Buttons.**
| Type | Style |
|---|---|
| Primary | Filled accent (Kept used a soft vertical gradient), 12px radius, medium weight |
| Ghost | Transparent, faint border, secondary text. Pressed: border and text brighten |
| Action ("+ Add") | Ghost with border, 13px, icon + label |
| List row active | Faintly tinted background, full-width pill |

**Filter pills.** ~32px tall, padding 8px 14px, full radius, 13px medium. Inactive: faint fill, secondary text. Active: inverted (primary text colour as fill). Count after a dot separator ("All · 19").

**Badges / status pills.** Small (10px), uppercase, tracked, pill. Status shown with outline vs fill and strength of stroke, plus a label; never colour alone.

**Bottom tab bar.** Replaces the desktop top nav and sidebar. Five tabs: Home, Browse, Sell, Inbox, Profile. Solid background (no transparency, prevents bleed-through), hairline top border, sits above the home indicator (safe area). Labels uppercase, tracked, 10px, with an icon above. Active tab: accent icon and label (icon drawn with the text colour, never emoji). Inbox unread count as a small pill on the icon.

**Search bar.** Full width minus 16px side padding, 32px radius, hairline border, camera icon on the right for photo search. Focus: border brightens. Busy: input disabled, placeholder "Searching...".

**Collapsible sections.** Full-width header with a rotating arrow. Body animates its height (0.3s ease) using the native layout animation. Expensive content mounts on first open, then stays mounted.

**Footer.** Quiet legal links at the bottom of Profile (thin top border, low-contrast, stacked). No footer on other screens.

**Scrollbar.** n/a in the native app. Use the system scroll indicator.

**Long-operation buttons.** A light sweeping around the button edge in a 2s loop while busy (native animated driver).

**Images.** On load failure, hide the image and show initials/placeholder in the parent. Item photos are cropped to 3:4 with cover fit. Image optimisation (WebP, sizes) is done by the image pipeline or upload service, not build tools.

## Motion

| Element | Property | Duration | Easing |
|---|---|---|---|
| Button press | background, border | 150ms | ease |
| Card press | `transform: scale(0.98)` | 150ms | ease |
| Card info press | opacity | 150ms | ease |
| Pill state change | background, colour | 150ms | ease |
| Tab bar press | background, colour | 200ms | ease |
| Page to page | none, instant | | Pages run their own small entrance (skeleton → content) |
| New item appear | opacity 0 → 1 | 300ms | ease |
| Sheet open and close | slide up, reverse to close | 300ms | ease-out, reverse to close |

There is no hover on phones. Every hover rule from Kept becomes press feedback (D-005).

- Frequent one-click transitions stay under ~200ms.
- Close easing is the reverse of open easing.
- Loading indicators hold at least one full cycle (700-1200ms).

## Writing rules

- No em dashes or en dashes in anything a user reads.
- No semicolons in user-facing text.
- Headings and short labels carry no full stop.
- Proper capitalisation always.
- Warm, direct, human. No corporate filler ("I hope this finds you well", "synergies", "circle back").
- AI-generated text follows the same rules (enforced in the prompt and in an output cleanup pass).
- Product voice for the marketplace: to decide

## Do not use

- Heavy box shadows on cards or windows
- Rounded rectangles with thick borders
- Dense data tables
- Hamburger menus (navigation is the bottom tab bar)
- Translucent windows below ~90% opacity for reading surfaces
- Emoji as icons in themed UI (they ignore the palette)
- Corporate or sales jargon in the UI

## Approved decisions

### D-001 : Inherit Kept's design, except colour

- **Date:** 2026-10-11
- **Area:** Design system
- **Status:** Approved
- **Decision:** Typography, spacing, layout, shapes, window chrome, components, motion and writing rules start from Kept's design. The colour palette is not inherited and is decided fresh.
- **Rationale:** Kept's quiet, editorial look is proven and liked; a photo-led marketplace needs its own palette.
- **Implementation:** Values above. Colour decided in D-006.
- **References:** `docs/playbook/design-philosophy.md`

### D-002 : Light mode only for now

- **Date:** 2026-10-12
- **Area:** Colour, Design system
- **Status:** Approved
- **Decision:** The app ships in light mode only. Dark mode is deferred. The "both themes first-class" rules in the philosophy file are paused until dark mode returns.
- **Rationale:** One theme halves design and checking work while the core marketplace is built. A photo-led marketplace reads well on a light background.
- **Implementation:** Colour tokens are defined for light only, but still named by role so a dark set can be added later without touching components. Paused rules stay in `docs/playbook/design-philosophy.md`, marked as paused.
- **References:** `docs/playbook/design-philosophy.md`

### D-003 : Typeface is Aileron

- **Date:** 2026-10-12
- **Area:** Typography
- **Status:** Approved
- **Decision:** Keep Aileron as the one UI family, as in Kept. Closes O-002.
- **Rationale:** It has the light-to-heavy range the signature look needs, and it keeps the product visually close to Kept.
- **Implementation:** Self-host Aileron in the app, loading every weight actually used (no faked weights).
- **References:** Typography table above

### D-004 : Component library is React Native Reusables

- **Date:** 2026-10-12
- **Area:** Design system, Components
- **Status:** Approved
- **Decision:** Build UI on React Native Reusables (the shadcn port for React Native, on NativeWind), restyled to Kept's look (hairline borders, no shadows, 12px buttons, fully rounded pills). Use Gorhom Bottom Sheet for slide-up sheets: filters, price breakdown and make an offer.
- **Rationale:** Ready-made accessible parts that we own and can restyle, matching the NativeWind setup already in the app.
- **Implementation:** Components live in the mobile app and read colour, radius and spacing from tokens only.
- **References:** Components section above

### D-005 : Phone-app adaptations of Kept's rules

- **Date:** 2026-10-12
- **Area:** Layout, Typography, Motion, Navigation
- **Status:** Approved
- **Decision:** (1) Item cards are portrait 3:4 instead of square, because clothing is photographed tall and a square crop cuts off shoes and hems. (2) Very light display weights (200-300) are for large headings only, never small text. (3) There is no hover on phones, so hover rules become press feedback. (4) The top nav and desktop sidebar become the bottom tab bar: Home, Browse, Sell, Inbox, Profile. (5) Web-only implementation rules (portal to the page body, CSS grid tricks, scrollbar styling, WebP via build tools, iOS input zoom) get a native equivalent or are marked "n/a in the native app" in the philosophy file.
- **Rationale:** Kept is a desktop web product. This one is a phone app held in one hand and judged by clothing photos.
- **Implementation:** Spacing and layout, Typography, Components (bottom tab bar, search bar) and Motion sections above are updated to match.
- **References:** `docs/playbook/design-philosophy.md`

### D-006 : Colour palette: Espresso and cream

- **Date:** 2026-10-12
- **Area:** Colour, Design system
- **Status:** Approved
- **Decision:** The palette is option 4 from the second colour round: a dark roasted brown accent (#4B2E22) on white, with cream tints (#FBF8F2, #F1E9DA, #F7EEDC, #EFE0C3) and warm brown text steps. State colours: success #1B7A43, warning #8A4F00 on #FFEFC2, error and destructive #B3261E. Closes O-001. The full token table with hex values and the measured contrast pairs is in the Colour section above.
- **Rationale:** Thrift-shop warmth that suits second-hand clothes, and it lets listing photos lead. Every text and icon pair passes WCAG AA, with the tightest at 4.83:1 (faint text on the raised surface). Peach (round 1) was rejected earlier.
- **Implementation:** Define the tokens once in the app's theme (NativeWind), named by role as in the table. Window fill and backdrop are derived values (white at 96%, text-1 at 25%) that were not in the mockup.
- **References:** `docs/mockups/colour-options-2.html` (option 4), `docs/mockups/component-sheet.html`

<!-- Template for new entries:
### D-### : Short decision name

- **Date:** YYYY-MM-DD
- **Area:** ...
- **Status:** Approved | Implemented | Superseded
- **Decision:** What is now true
- **Rationale:** Why
- **Implementation:** Where it lives or what remains
- **References:** Mockup / test / handoff
-->

## Open decisions

Proposals, not rules, until explicitly promoted above.

None right now.

| ID | Proposal | Decision needed |
|---|---|---|

## Superseded decisions
