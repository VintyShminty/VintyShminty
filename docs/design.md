# VintyShminty (working name) Design

Source of truth for the product's look, feel, navigation and approved UX decisions. Method rules live in `docs/playbook/design-philosophy.md`. This file holds the concrete choices. The product is a phone app (React Native), so desktop-era rules are adapted below (see D-005).

Starting point (D-001 below): everything here is the base design language **except colour**, which was decided fresh (D-006), then adapted for a phone app (D-002 to D-005). Change any value freely; record why in the decision log.

Authority order for design work:
1. Eden's current direction.
2. Approved and Implemented decisions below.
3. Platform accessibility conventions (iOS and Android).
4. Design handoffs and mockups (references, not rules).
5. Current implementation details.

Where nothing here is decided, follow the product spec (the Vinted UX deconstruction, which `docs/components.md` maps to our components) for how things work only: features, flows and the order of steps. Never take names, wording, icons or visual details from it. Those follow this file and `docs/originality.md` (D-019).

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
| surface | #FBF8F2 | Raised surface: search bar, banners, pressed rows |
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
| chip-selected | #EFE0C3 | Promo banner fill (no longer the selected chip fill, see D-008) |
| on-chip | #3A2218 | Label on the promo banner |
| success | #1B7A43 | Sold badge text and outline, success text |
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
| Promo banner label | #3A2218 on #EFE0C3 | 11.34:1 | 4.5:1 |
| Inactive chip outline (border, 3:1) | #7A6B60 on #FFFFFF | 5.12:1 | 3:1 |
| Inactive chip label | #241811 on #FFFFFF | 17.30:1 | 4.5:1 |
| Active chip label | #FFFFFF on #4B2E22 | 12.26:1 | 4.5:1 |
| Warning badge on white | #8A4F00 on #FFFFFF | 6.56:1 | 4.5:1 |
| Neutral info badge on white | #54443A on #FFFFFF | 9.27:1 | 4.5:1 |
| Success text on page | #1B7A43 on #FFFFFF | 5.37:1 | 4.5:1 |
| Success on success tint | #1B7A43 on #E6F4EA | 4.73:1 | 4.5:1 |
| Warning text on warning tint | #8A4F00 on #FFEFC2 | 5.74:1 | 4.5:1 |
| Error text on page | #B3261E on #FFFFFF | 6.54:1 | 4.5:1 |
| Error on error tint | #B3261E on #FDECEA | 5.72:1 | 4.5:1 |
| Switch on and primary fill against page (3:1 for icons) | #4B2E22 on #FFFFFF | 12.26:1 | 3:1 |

All pairs pass. Faint text on the raised surface (4.83:1) is the tightest, so do not go lighter than text-4 for any text.

## Typography

Base design language. The typeface is Aileron (D-003), self-hosted. Hebrew uses Heebo, paired with Aileron (D-011).

- One family for UI, self-hosted, every weight used actually loaded (no browser-faked weights). Aileron for Latin letters and numbers, Heebo for Hebrew (D-011).
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
| Card brand | 13.5px | 800 | Brand name on item cards (D-007) |
| Card description | 12px | 400 | Up to two lines, secondary text |
| Card meta | 11px | 400 | Size and condition, muted |
| Filter pill | 13px | 500 | |
| Badge | 10px | 600 | Uppercase, tracking 0.08em |
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

- Phone app. The bottom tab bar (Home, Browse, Sell, Inbox, Profile) replaces the desktop top nav and stays the default navigation (D-009). Page side padding 16px.
- Item grid: 2 columns on phone, 12px gaps. Item cards are portrait 3:4 (`aspectRatio: 3 / 4`), not square (D-005).
- Larger screens (tablet): 3 columns, same 3:4 cards.
- Each scroll container owns its own bottom clearance above the tab bar and the home indicator (safe area).

## Shapes and depth

- Window radius 20px, buttons 12px, item photos and category tiles 12px, chips and badges fully rounded outline pills, item card badges the same outline pills (D-008), search and prompt bar 32px.
- Borders are hairlines (0.5-1px, low opacity). A window's top edge is slightly brighter than its sides and bottom.
- No drop shadows on cards or windows. Depth = border + blur + surface shift.
- Glass (translucent + blur ~24px) only for floating chrome (search bar, floating buttons), never for reading surfaces.

## Components

**Windows (modals and sheets).** Near-opaque fill (~96%), blur 60px, hairline border with brighter top edge, 20px radius, no shadow. Backdrop: light dim (~25%) + 8px blur. On the phone, slide-up sheets (price breakdown, make an offer, option lists) use Gorhom Bottom Sheet (D-004) with the same fill, radius (20px on the top corners) and backdrop. Opacity below ~90% is banned (text gets hard to read). Nested windows sit above their parent.

**Buttons.**
| Type | Style |
|---|---|
| Primary | Filled accent, 12px radius, medium weight |
| Ghost | Transparent, faint border, secondary text. Pressed: border and text brighten |
| Action ("+ Add") | Ghost with border, 13px, icon + label |
| List row active | Faintly tinted background, full-width pill |

**Item card (D-007, superseded by D-032: price on a paper tag on the photo, bookmark top-end, status badge top-start, title, size and condition, tiny Covered line. The text below describes the older layout).** Portrait 3:4 photo with 12px rounded corners and no border. A white circle heart (32px) sits top-right on the photo. A badge sits bottom-left on the photo, using the standard outline badge (D-008): Bumped and Price drop in espresso, Sold in green. Below the photo: brand in bold with the favourite count (small heart and number) at the right, a description of up to two lines, size and condition, then the price. Price drop: the sale price in espresso, with a struck-through "Was: €X" line and the percentage off (for example "24% off"). Sold: the photo is washed out with white, the price is muted and struck through, and there is no heart. Under the price, the buyer price with the protection shield ("€20,55 incl."). Sale emphasis is espresso, never red. Green appears only for Sold. Press feedback is a 0.98 scale.

**Chips (D-008).** 32px tall, padding 0 14px, fully rounded, 13px medium, 1px outline in text-4 on a white fill with primary text. Active: filled espresso with white text. Applied filters that can be removed: 1.5px espresso outline with a cross. A count follows a dot separator ("All · 19"). The Filter button is an icon-only 40 by 32 pill with the same outline. Pressed uses the pressed surface and disabled uses 40% opacity.

**Badges and status pills (D-008).** 22px tall, 10px uppercase, tracked, semibold, fully rounded, 1px outline in the status colour on a white fill, with a small icon (11px) before the label. Colour by meaning: success for Sold and Completed, warning for Reserved and In progress, error for Cancelled and Removed, espresso for New, Price drop, Bumped and Verified, neutral text-2 for info such as Frequent uploads. Status always has an outline, an icon and a label, never colour alone. The white fill keeps badges readable on photos. Item cards use these same badges.

**Bottom tab bar.** The default navigation (D-009). Five tabs: Home, Browse, Sell, Inbox, Profile. Solid background (no transparency, prevents bleed-through), hairline top border, sits above the home indicator (safe area). Labels uppercase, tracked, 10px, with an icon above. Active tab: accent icon and label (icon drawn with the text colour, never emoji). Inbox unread count as a small pill on the icon. It stays visible, with Browse active, while category panels push in.

**Browse and category panels (D-009).** The Browse tab is a 2 column grid of main category tiles under the search bar. Tiles are light tinted (accent-tint), 12px radius, label top-left in bold, and a picture bottom-right (a Lucide line icon for now, illustration style to decide). Tapping a tile opens a full-screen panel that slides in from the trailing edge and pushes the current screen aside (see Motion). The panel has a top bar (back arrow, centred category title, search icon), an "All" row with a grid icon, then rows of icon, label and chevron separated by hairlines. A row with children pushes another panel the same way. A leaf row or "All" opens the item feed for that level. Row labels use regular weight, 400 (D-013). Back reverses the motion.

**Filter panel (D-014).** The Filter screen is a full-screen panel pushed in from the trailing edge over the results, the same push as the category panels. It is not a bottom sheet. It has a top bar (close X on the leading side, "Filter", Clear all), rows that show the current value, and a sticky Show results button with the live count. Its Category row opens the category panels (D-010).

**Star ratings (D-012).** Stars use the espresso accent, filled for the score and outlined in the border colour for the rest. There is no gold in the palette.

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
| Page to page | none, instant, except the category push below | | Pages run their own small entrance (skeleton → content) |
| New item appear | opacity 0 → 1 | 300ms | ease |
| Sheet open and close | slide up, reverse to close | 300ms | ease-out, reverse to close |
| Category panel push | new panel slides in from the trailing edge, the previous screen shifts left about 30% and dims | 300ms | ease-out, back is the exact reverse |

There is no hover on phones. Every hover rule becomes press feedback (D-005).

- Frequent one-click transitions stay under ~200ms.
- Close easing is the reverse of open easing. Back from a category panel runs the push in reverse.
- In right-to-left languages the category push runs mirrored (the panel enters from the left).
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
- Hamburger menus and side drawers (navigation is the bottom tab bar, D-009)
- Translucent windows below ~90% opacity for reading surfaces
- Emoji as icons in themed UI (they ignore the palette)
- Corporate or sales jargon in the UI

## Approved decisions

### D-001 : Base design language, except colour

- **Date:** 2026-10-11
- **Area:** Design system
- **Status:** Approved
- **Decision:** Typography, spacing, layout, shapes, window chrome, components, motion and writing rules start from the base design language. The colour palette is not part of it and is decided fresh.
- **Rationale:** A quiet, editorial look that lets clothing photos lead. A photo-led marketplace needs its own palette.
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
- **Decision:** Keep Aileron as the one UI family, Closes O-002.
- **Rationale:** It has the light-to-heavy range the signature look needs, and it keeps the look consistent.
- **Implementation:** Self-host Aileron in the app, loading every weight actually used (no faked weights).
- **References:** Typography table above

### D-004 : Component library is React Native Reusables

- **Date:** 2026-10-12
- **Area:** Design system, Components
- **Status:** Approved
- **Decision:** Build UI on React Native Reusables (the shadcn port for React Native, on NativeWind), restyled to the Vinty look (hairline borders, no shadows, 12px buttons, fully rounded pills). Use Gorhom Bottom Sheet for slide-up sheets: price breakdown, make an offer and short option lists. Category selection (D-010) and the Filter screen (D-014) are not sheets.
- **Rationale:** Ready-made accessible parts that we own and can restyle, matching the NativeWind setup already in the app.
- **Implementation:** Components live in the mobile app and read colour, radius and spacing from tokens only.
- **References:** Components section above

### D-005 : Phone-app adaptations of the base rules

- **Date:** 2026-10-12
- **Area:** Layout, Typography, Motion, Navigation
- **Status:** Approved
- **Decision:** (1) Item cards are portrait 3:4 instead of square, because clothing is photographed tall and a square crop cuts off shoes and hems. (2) Very light display weights (200-300) are for large headings only, never small text. (3) There is no hover on phones, so hover rules become press feedback. (4) The top nav and desktop sidebar become the bottom tab bar: Home, Browse, Sell, Inbox, Profile. (5) Web-only implementation rules (portal to the page body, CSS grid tricks, scrollbar styling, WebP via build tools, iOS input zoom) get a native equivalent or are marked "n/a in the native app" in the philosophy file.
- **Rationale:** This is a phone app held in one hand and judged by clothing photos.
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

### D-007 : ItemCard is Option C, Badge forward (superseded by D-019 and D-032)

- **Date:** 2026-10-12
- **Area:** Components, Item card
- **Status:** Approved. The card layout is superseded by D-032 (heart, bottom-start badge, brand line and the Was line under the price are gone). The rules still standing: sale emphasis is espresso never red, green only for Sold, press scale 0.98.
- **Decision:** The item card follows round 2 Option C. 12px rounded photo, white circle heart top-right, outline badges (D-008) bottom-left, brand in bold with the favourite count, a two line description, size and condition, then the price. A price drop shows the sale price in espresso with a struck-through "Was: €X" line and the percentage off. Sale emphasis is espresso and green is used only for Sold.
- **Rationale:** Familiar to shoppers, handles every state clearly, and the Was price with a percentage makes a deal obvious. Adapted to our palette, so the sale colour is espresso instead of red.
- **Implementation:** Item card description under Components. ItemCard, HeartPill (circle variant) and PriceBlock in `docs/components.md`. Live in `docs/mockups/component-sheet.html`.
- **References:** `docs/mockups/round-2.html` (Option C)

### D-008 : Chips and badges are Option B, Hairline outline

- **Date:** 2026-10-12
- **Area:** Components, Chips, Badges
- **Status:** Approved
- **Decision:** Chips and badges follow round 2 Option B. Chips are fully rounded pills with a thin outline, the active chip is filled espresso, applied filters get a 1.5px espresso outline and a cross, and the Filter button is an icon-only pill. Badges are outlined pills with an icon and a label, coloured by meaning. The chip-selected fill (#EFE0C3) no longer marks a selected chip. It stays as the promo banner fill. This applies everywhere, item cards included (corrected 2026-10-12 at Eden's request).
- **Rationale:** The lightest look, so photos stay the loudest thing. Outline plus icon plus label means status never rests on colour alone, and the white fill keeps badges readable on any photo. The inactive outline measures 5.12:1 on white.
- **Implementation:** Chips and Badges paragraphs under Components, with new contrast rows in Colour. Chip, Badge and FilterBar in `docs/components.md`.
- **References:** `docs/mockups/round-2.html` (Option B)

### D-009 : Navigation is the bottom tab bar, with a Browse grid and pushed panels

- **Date:** 2026-10-12
- **Area:** Navigation, Motion
- **Status:** Approved. Superseded in part by D-019 (2026-10-13): the tab bar is now a floating bar with icons only and a raised Sell button (no labels), and the Browse tab is photo tiles by item type instead of the category grid. The pushed category panels, now behind the More tile, still follow this decision
- **Decision:** The bottom tab bar (Home, Browse, Sell, Inbox, Profile) stays the default navigation. The side drawer proposed in round 2 is not adopted. The Browse tab shows the search bar and a 2 column grid of main category tiles. Tapping a category opens a full-screen panel that slides in from the trailing edge and pushes the current screen aside, like an iOS push, not an overlay. The panel has a top bar (back arrow, centred title, search icon), an "All" row, then subcategory rows (icon, label, chevron) separated by hairlines. A row with children pushes another panel the same way. A leaf or "All" opens the item feed. The tab bar stays visible with Browse active. Back reverses the motion. The push takes about 300ms.
- **Rationale:** Tabs keep the five main places one tap away and match what shoppers know. A grid makes the categories easy to scan, and a push keeps a clear sense of depth and a simple way back.
- **Implementation:** Bottom tab bar, Browse and Motion sections above. CategoryGrid, CategoryPanel and CategoryRow in `docs/components.md`, built with an Expo Router stack push (native slide) inside the Browse tab. Tile illustration style is still to decide, a Lucide line icon is the placeholder.
- **References:** `docs/mockups/round-2.html` (section 3 for the drawer that was not adopted), `docs/mockups/component-sheet.html` (CategoryGrid story)

### D-010 : Category selection is always a full-screen push panel

- **Date:** 2026-10-12
- **Area:** Navigation, Components
- **Status:** Approved
- **Decision:** Category selection everywhere (Browse, Sell form, Filters) uses full-screen panels that slide in from the trailing edge (right in left-to-right languages) and push the current screen aside, like CategoryPanel in D-009. It is not a bottom sheet. CategoryPicker keeps the same TopBar and CategoryRow rows with icons. Its first level shows a close X on the leading side, the title "Category" and a "Find a category" search. Deeper levels show a back arrow, the title and an X. In the Sell form leaf rows have a radio and there is no All row. On the Filter page each level starts with an "All <category>" row. CategoryPicker is removed from the Gorhom Bottom Sheet uses in D-004.
- **Rationale:** One way to pick a category across the app, so the Browse tab, the Sell form and the Filter page feel the same and the rows cannot drift apart.
- **Implementation:** CategoryPicker in `docs/components.md`, built with an Expo Router stack in a full-screen modal push. Live in `docs/mockups/component-sheet.html` (CategoryPicker story).
- **References:** D-009, D-004

### D-011 : Hebrew typeface is Heebo, paired with Aileron

- **Date:** 2026-10-12
- **Area:** Typography, Right to left
- **Status:** Approved
- **Decision:** Hebrew text is set in Heebo. Aileron stays the face for Latin letters and numbers (D-003). The app picks the family from the current language. Closes O-003 (the currency was already decided as ILS).
- **Rationale:** Heebo is a clean sans with a weight range close to Aileron's, so Hebrew and English screens feel like one product. It is free (OFL) and is already in the app.
- **Implementation:** Heebo files and licence in the app's font folder, mapped per weight in the theme. Typography section above.
- **References:** `docs/mockups/component-sheet-he.html`, D-003

### D-012 : Star ratings use the espresso accent, not gold

- **Date:** 2026-10-12
- **Area:** Components, Colour
- **Status:** Approved
- **Decision:** StarRating draws filled stars in the espresso accent (#4B2E22), with unfilled stars in the border colour. No gold token is added.
- **Rationale:** The palette is espresso and cream (D-006), and a gold would be a second accent that competes with the photos. Espresso on white measures 12.26:1.
- **Implementation:** StarRating in `docs/components.md` and `apps/mobile/components/ui/star-rating.tsx` (already uses the accent token). Shown in both component sheets.
- **References:** D-006

### D-013 : CategoryRow labels use regular weight

- **Date:** 2026-10-12
- **Area:** Components, Typography
- **Status:** Approved
- **Decision:** CategoryRow labels are regular weight (400), including the All row, not semibold.
- **Rationale:** Long lists of rows read calmer in regular weight, and the icon and chevron already give each row structure. It also follows the product spec.
- **Implementation:** CategoryRow in `docs/components.md` and the Browse and category panels paragraph above. CategoryRow does not exist in the app yet, so build it at 400 from the start.
- **References:** D-009, D-010

### D-014 : The Filter screen is a full-screen pushed panel, not a bottom sheet

- **Date:** 2026-10-12
- **Area:** Navigation, Components
- **Status:** Approved
- **Decision:** The Filter screen is a full-screen panel that slides in from the trailing edge and pushes the results aside, like the category panels (D-009, D-010). It is not a bottom sheet. Sub-pages (price, size, brand) and the category picker push the same way. FilterSheet is renamed FilterPanel. D-004's list of bottom sheet uses no longer includes filters.
- **Rationale:** The Filter screen has many rows and sub-pages, which is too much for a sheet. One push motion for every full-screen choice keeps the app consistent and keeps a clear way back.
- **Implementation:** FilterPanel in `docs/components.md`, Filter panel paragraph above, Expo Router stack in a full-screen modal push. Live in both component sheets (FilterPanel story).
- **References:** D-004, D-009, D-010, `docs/mockups/component-sheet.html`

### D-015 : Sell form layout and pickers

- **Date:** 2026-10-12
- **Area:** Sell form, Components
- **Status:** Approved (Eden, 2026-10-12). Designer is browse only: it never appears in the Sell category picker, and designer items are found by browsing (Eden, 2026-10-12). Brand stays optional for every category (Eden, 2026-10-12).
- **Decision:** (1) The Sell tab opens the sell form as a full-screen task page with a close cross and no tab bar (spec). (2) Brand, Size, Condition, Colours, Material and Pattern open as option sheets (D-004 short lists, OptionListSheet), single choice applies on tap, Colours (up to 2) has Done in the sheet header. Brand has a search, the popular brands when empty, and Request a brand when nothing matches. Category stays the full-screen push (D-010) and hides Designer at the top level, as the spec's Sell picker shows eight rows. (3) Price is an inline field with the ₪ sign and a live "Buyer pays ₪X incl. Buyer Protection" line from the server. Parcel size is inline radio cards with the recommended size tagged and Small chosen for a new listing. (4) Photos: an empty dashed box, then square tiles with a remove cross and a Main tag on the cover. Tapping a photo offers Make it the cover, Move earlier and Move later instead of drag and drop. (5) Save draft and Upload sit side by side in a bar at the bottom. Closing with changes asks "Save changes before closing?" with Save and Discard (native dialog).
- **Rationale:** The spec never captured the pickers inside the app form, so they follow our components (OptionListSheet, PickerRow) and the desktop spec's radio cards for parcel size. Tap to move is reachable with one hand and with VoiceOver, and needs no new library. Both buttons at the bottom make drafts easy to find.
- **Implementation:** `apps/mobile/app/(app)/sell-form/`, `components/sell/`, `components/ui/sheet.tsx`, `picker-row.tsx`, `radio.tsx`, `checkbox.tsx`.
- **References:** D-004, D-010, spec Sell form and Category picker, `docs/mockups/component-sheet.html` (PhotoUploader, PickerRow, OptionListSheet)

### D-016 : The tab bar keeps its order in Hebrew

- **Date:** 2026-10-13
- **Area:** Navigation, Right to left
- **Status:** Approved (Eden, 2026-10-13)
- **Decision:** The bottom tab bar is not mirrored in right to left. Home stays at the left and Profile at the right in Hebrew, as in English. Everything else in the app still mirrors.
- **Rationale:** People switch between the two languages and the tab positions are muscle memory. iOS would mirror the bar by default, so this is a deliberate exception.
- **Implementation:** `direction: "ltr"` on the floating bar in `apps/mobile/components/navigation/floating-tab-bar.tsx` (was the tab bar style in `(tabs)/_layout.tsx` before D-019).
- **References:** D-011, CLAUDE.md Right to left

### D-017 : The tab bar stays on every page opened from a tab

- **Date:** 2026-10-13
- **Area:** Navigation
- **Status:** Approved (Eden, 2026-10-13)
- **Decision:** The bottom tab bar stays visible on the item page, a member's profile, Search, Favourites, Saved searches, Settings and Edit profile. Each tab (Home, Browse, Inbox, Profile) has its own stack, so a page opened from a tab pushes inside that tab and the tab keeps its own history. Tapping the active tab again goes back to its first screen. The pages with no tab bar are the task pages: the sell form (D-015), the Filter panel and its sub-pages (D-014), the conversation screen, and the Face ID offer.
- **Rationale:** Opening an item from Browse and finding yourself in no tab at all felt lost. With a stack per tab you always know where you are, and Back returns to the same scroll position in the same tab.
- **Implementation:** `apps/mobile/app/(app)/(tabs)/` holds one group per tab (`(home)`, `(shop)` for Browse, `(inbox)`, `(profile)`), each with a stack layout (`components/navigation/tab-stack.tsx`). Pages shared by every tab live once in `(home,inbox,profile,shop)/` (listing, user, search, favourites, saved-searches). Settings and Edit profile live in `(profile)/`. To link to an item or a person from any screen use `router.push({ pathname: "/listing/[id]", params: { id } })` and `{ pathname: "/user/[id]", params: { id } }`. The current tab is kept. To open one in a specific tab use the group in the path, for example `/(profile)/listing/123`. A cold link (notification tap, deep link) has no current tab and opens in the first group alphabetically (Home). The Browse group is named `(shop)` on purpose so a cold link never lands in the Browse stack. Inside the tab stacks the bottom safe area is the room the floating bar takes (D-019), so every screen that already reads the safe area leaves space under its last row (`components/navigation/tab-stack.tsx`, `lib/tab-bar.ts`).
- **References:** D-009, D-014, D-015, D-016

### D-018 : The app sets the layout direction, so the language switches instantly

- **Date:** 2026-10-13
- **Area:** Right to left, Navigation
- **Status:** Approved (Eden, 2026-10-13)
- **Decision:** Switching between English and Hebrew in Settings changes the language and mirrors the whole layout at once, with no restart. The phone's own layout direction stays left to right always. The app puts `direction: rtl` or `ltr` on its root view from the app language and tells the navigation the same, so pages push in from the right and swipe back from the left edge in Hebrew. A Hebrew phone with the app in English, and an English phone with the app in Hebrew, both look right because the phone's language no longer decides anything about layout.
- **Rationale:** The old way (`I18nManager.forceRTL`) only applied at app start, so every switch needed a restart. People who switch languages should see the change immediately.
- **Implementation:** `apps/mobile/app/_layout.tsx` (root `direction` style and expo-router `LocaleProvider`), `apps/mobile/lib/rtl.ts` (`useIsRtl`, `ensureNativeLtr`), `Text` and `Input` align by app language, back and forward arrows use `useIsRtl`. `app.json` no longer lists Hebrew as a supported locale, so iOS never starts the app in right to left by itself (system dialogs on a Hebrew phone stay in English). NativeWind's `rtl:` variant no longer fires (it reads the phone), so pick styles from the language instead.
- **References:** D-011, D-016, CLAUDE.md Right to left

### D-019 : Originality pass, our own look and voice instead of Vinted's

- **Date:** 2026-10-13
- **Area:** Voice, Components, Navigation
- **Status:** Approved (Eden, 2026-10-13). Phase A (wording pass) built on branch milestone-6. Visual parts built on branch m6-nav: tab bar (row 14), Home top and mood chips (row 4), Browse photo tiles (row 5). Reviews (row 11) and the order tracker card in chat (row 16) built on branch m6-reviews. Still to build: badges look, condition slider
- **Decision:** Keep Vinted's structure and flows, change what reads as Vinted. The voice is "Friends' closets" (people first, warm and local). The item card becomes a price tag card (price first, then brand, size and condition in small capitals, then the buyer price pill). Buyers see the seller price plus a soft pill with the buyer price, never the shield and "incl." line, and the protection gets its own name. Home opens with a large greeting and a small round search button beside it, then mood chips (For you, New today, Under ₪50, Your sizes, Near you) and the grid. Browse uses photo tiles by item type. Users are "sellers" in search. The item page has one Buy button, "make your price" as a link and Message on the seller row. Condition is a slider with five stops: Unworn with tags, Unworn, Like new, Worn, Well loved. Reviews are one list plus a line for automatic ones. Seller badges are our own outline stamps. The tab bar is a floating rounded bar, icons only (each tab keeps a hidden name for screen readers), with a raised round Sell button with a camera (a price tag since Eden's change on 2026-10-13). Holiday mode is "Away mode", Personalisation is "My sizes". Order progress is a tracker card at the top of the chat: a line of step icons with dates, plus Track parcel and I got it buttons. Every user-facing sentence copied from Vinted is rewritten.
- **Rationale:** Legal and App Store risk. Nobody owns how an app works, but the look, names and wording must be ours. Research and the rule are in `docs/originality.md`.
- **Implementation:** Phase A, wording (2026-10-13): every banned word is gone from both locale files, the server push text and the seed, with a test that keeps them out (`apps/mobile/tests/no-banned-words.test.ts`). Done in phase A: sellers instead of members, Buzz (names only, the feature is not built), the sell form words, condition names, Settings and Alerts names, Away mode with a moon and return date, My sizes under Shopping preferences, the "incl." line removed. The protection name is a placeholder in one key (`protectionName`, English "Coverage"), rename it there. Choices, open questions and the checklist in `docs/originality.md`, options in `docs/mockups/originality-choices.html` and `originality-round-2.html`. Changes parts of D-007 (item card), D-008 (Bumped badge) and D-009 (tab labels, Browse grid). The paid boost was "Buzz" for now (button "Give it buzz", badge "Buzzing"). On 2026-10-15 Eden renamed it "Boost": button "Boost this listing", badge "Boosted", in Hebrew "להקפיץ את המודעה" and "מוקפצת". The code still calls it buzz and bump inside. Still open: the protection name (wait for the app name), the voice guide.
- **Superseded in part by D-032:** the item card (price tag card, heart, small capitals line, buyer price pill on cards) is now the price tag on photo card. The pill stays on the item page, sell form preview and offer sheet, with a BadgeCheck icon.
- **Superseded in part by D-047:** the Home top (greeting and round search button) is now the Yadii wordmark with Alerts and Saved icons, a full-width search bar and the mood chips.
- **Implementation, card and item page (branch m6-card):** the buyer price pill (`components/price-pill.tsx`, check icon, "{price} with {protectionName}") replaces the shield and the "incl." line on cards, the sell form price preview, the offer sheet, the checkout line and the order note. The item card is the price tag card (big seller price with the heart at the end of that row, brand, size and condition in small capitals, pill, badges on the photo, "Buzzing" with a zap icon; the favourite count and the two line description left the card). The item page shows a breakdown card (Item, protection, You pay, how you are covered) and one "Buy for X" button with "Or make your price" as a link and a "Message" chip on the seller row. The sell form condition is a five stop slider (`components/sell/condition-slider.tsx`, drag, tap or VoiceOver adjustable, runs right to left in Hebrew). Seller badges are outline stamps (`components/seller-stamp.tsx`, no rings). The Bumped badge of D-008 is superseded in part by Buzzing.
- **Implementation, navigation (m6-nav):** (1) Tab bar: `components/navigation/floating-tab-bar.tsx`, a custom `tabBar` for the Expo Router tabs. A 64 point bar with the 32 point `rounded-bar` shape, 95 percent white, hairline border, 16 points from each side, icons only, the active tab on an accent-tint pill, the Inbox count as a small espresso pill, and a raised round espresso Sell button with a price tag in the middle (a camera at first, changed by Eden 2026-10-13). Each tab keeps its name for screen readers. It hides while the keyboard is open. It overlays the content, so `TabStack` gives the screens inside a tab a bottom safe area that includes the bar (`lib/tab-bar.ts`). (2) Home: a large light greeting by time of day with the first name or username, a round search button, then the mood chips. `GET /v1/feed` takes `mood` (`for_you`, `new_today`, `under_50`, `your_sizes`, `near_you`). Signed out visitors see For you, New today and Under ₪50. Empty states for sizes and city link to My sizes and Edit profile. (3) Browse: `lib/browse-tiles.ts` is the one file that orders the tiles. Ten tiles, then More (the rest of the tiles plus the whole category tree as rows, so Designer and every deeper category stay reachable, D-015). A tile opens `browse/tile` with All, Women, Men and Kids chips, searching with the new `categoryIds` filter. Tile photos are the sample photos in object storage under `browse/` (Unsplash licence, development only, real photos before launch).
- **Implementation, reviews and order tracker (m6-reviews):** (1) Reviews tab (`components/profile-view.tsx`): the list asks the server for written reviews only (`source=member`), the All, Written and Automatic chips are gone, and one success-tint line under the score reads "{count} smooth sales, no problems" from `summary.automatic.count` (plural forms in English and Hebrew, hidden at zero). The score and count above it are the written ones, so they match the list. No server change was needed, the summary already carries the automatic count. A seller with only automatic reviews sees just the line and "No written reviews yet". Reply and View order stay on your own page. (2) Order tracker (`components/chat/order-tracker.tsx`, pinned under the item strip in `app/(app)/conversation/[id].tsx`): four step icons Paid, Sent, Arrived, Done with their dates, the status in words on the top line, and the buttons the order allows (`actions`): Pay now, Mark as shipped, Track parcel (opens a line with the tracking code, or the order when there is no code) and I got it (same confirmation as the order page). Tapping the card opens the order. It reads the order query, so `order:updated` refreshes it live. Cancelled and refunded orders show the state in red instead of the steps, disputed show the steps and "Under review". The order dividers stay in the message list.
- **References:** `docs/originality.md`, `docs/mockups/originality-choices.html`

### D-020 : Sign up asks only for email and password

- **Date:** 2026-10-13
- **Area:** Sign up, Accounts
- **Status:** Approved (Eden, 2026-10-13)
- **Decision:** The sign up screen has two fields, Email then Password. There is no username field. The server makes the public username from the email: the part before the @, lowercase, only letters, numbers, dots and underscores, no dots or underscores at the ends, at most 24 characters, padded with digits up to 3 if short (or `user` plus digits if nothing is left). If it is taken (compared without caring about capitals) it adds random digits (2, then 4, then 6) until it is free. The display name starts as the username. The person can change both later: Profile details shows a Username row that opens the change screen, which says the username is their public name.
- **Rationale:** Fewer fields means fewer people give up at sign up, and the live "taken" check made the form feel like an exam. Everyone still needs a public name for profiles, chats and member search. The email is never shown publicly, so the username starts as a harmless guess, not as a promise. The sign up route still accepts a username, so older callers keep working.
- **Implementation:** `apps/server/src/lib/username.ts` (generator), `apps/server/src/lib/auth.ts` (user create hook, runs for every way of making an account), `packages/shared/src/auth.ts` (`signUpInputSchema` username optional), `apps/mobile/app/(auth)/sign-up.tsx`, `apps/mobile/app/(app)/(tabs)/(profile)/edit-profile.tsx`.
- **References:** None

### D-021 : The welcome, log in and sign up screens use one strong photo

- **Date:** 2026-10-13
- **Area:** Welcome, Log in, Sign up, Forgot password
- **Status:** Approved (Eden, 2026-10-13), Implemented on branch m6-welcome
- **Decision:** Eden picked direction 2, "One strong photo", of `docs/mockups/welcome-options.html`. The welcome screen is a full-screen photo with a dark fade toward the bottom, the Vinty wordmark at the top start, a small white chip on the photo ("Noa's coat, ₪140"), the headline "Good taste, passed on" (one weight, two lines), one short line under it with a set line break so no word is left alone, a white Sign up button and an outlined Log in button on the photo. Log in, Sign up and Forgot password start with a rounded photo band (the same photo) with the back button in a white circle over it, then the existing forms (D-020 unchanged). The band shrinks to the back button while the keyboard is open, so the field and the button stay visible. The status bar is light over the photo and dark on all other screens.
- **Rationale:** Calm, confident and ours. It shows people and clothes from the first second and drops the thin plus heavy headline mix that broke in Hebrew.
- **Trade-off:** One photo carries the whole brand, so a great real photo is needed before launch. The bundled one is a licensed sample (Unsplash, 600 px wide) and looks soft on a big screen.
- **Implementation:** `apps/mobile/app/(auth)/welcome.tsx`, `log-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, `apps/mobile/components/auth-photo.tsx` (photo, token-coloured fade, band), `apps/mobile/assets/images/welcome-photo.jpg` (credit in `assets/images/CREDITS.md`), strings under `welcome` in both locale files.
- **References:** `docs/mockups/welcome-options.html`

### D-023 : Continue with Apple and Google

- **Date:** 2026-10-13
- **Area:** Welcome, Log in, Sign up, Accounts
- **Status:** Merged (PR #23, 2026-10-13). Switched on online in Milestone 8
- **Decision:** The welcome, log in and sign up screens get "Continue with Apple" (iPhone only) and "Continue with Google" under a thin "or" line. On the welcome photo the Apple button is Apple's white style and the Google button is a white button with Google's four colour G. On the log in and sign up forms, below the main button, Apple's white outline style and a hairline Google button with the same height (48) and radius (12). The Apple button is Apple's own component with Apple's own words, as their rules require. A button only appears when the server says that provider has keys (`GET /v1/auth/providers`), so nothing is shown, and nothing can fail, until Eden adds them, and keys can be switched on without a new app build. Apple signs in with an ID token on the phone. Google opens the system browser sheet with our web client (no extra native library, the same for Android later). A new person who arrives this way gets the two short questions once, like email sign up (D-022), and no confirmation code because Apple and Google have already checked the email. Apple's "hide my email" address is accepted as the email, and since it is random the username is made from the first name (or "user" plus digits), not from the address. Apple sends the name only the first time, so the app passes it along then. Errors are plain: a cancelled sheet says nothing, a missing email, a busy network and everything else have their own sentence.
- **Rationale:** Fewer steps to a first account, and Apple requires its own sign in when another social sign in is offered. Browser Google keeps Eden's setup to one Google client and no extra native module, at the cost of a browser sheet instead of the Google account picker.
- **Implementation:** `apps/server/src/lib/social.ts`, `routes/auth-providers.ts`, `apps/mobile/components/social-buttons.tsx`, `google-mark.tsx`, `lib/social-login.ts`, `lib/auth-providers.ts`. Google's brand colours are the only non token colours, kept in `brand` in `theme/tokens.js`.
- **Website:** The log in and sign up pages show the same two buttons under the same "or" line (`apps/web/components/auth/social-slot.tsx`): Apple's black outline button with its logo and "Continue with Apple", and a hairline Google button with the four colour G, height 48, radius 12. Each shows only when `GET /v1/auth/providers` says so (`appleWeb` for Apple). The person goes to Apple or Google, comes back to the website logged in, and a new person lands on the two welcome questions. A refused login comes back to the log in page with the app's wording; cancelling says nothing. Google's registered return address stays the server's (Better Auth's `oAuthProxy`, see `docs/going-online.md` J3).
- **References:** `docs/going-online.md` Part J

### D-022 : The home feed explains itself and asks two questions after sign up

- **Date:** 2026-10-13
- **Area:** Home, Settings (Shopping preferences, Your privacy), sign up
- **Status:** Approved (Eden, plan decisions in `docs/plans/home-feed.md` section 9), Implemented on branch milestone-7. The first name and username step was added on branch feat/app-polish (Eden asked 2026-10-14), Built on branch feat/app-polish
- **Decision:** A long press on a Home card opens the "Why you see this" sheet: one plain sentence for the reason (for example "You like Zara", "New in Dresses", "Popular this week", "Something new for you"), then Not interested with this item, everything from this seller, show less of this brand, show less of this category (only those that apply). The card leaves the list at once. A screen reader gets the same through a "Why you see this" action on the card. After a new account is created (never on log in) three skippable screens follow, once: "What should we call you?" (a first name and a username, see below), "What do you shop for?" (Women, Men, Kids, several allowed, big tick rows) and "What are your sizes?" (the My sizes picker). Both end on Home. Settings, Shopping preferences lists what was hidden with Undo, and has "Reset my recommendations" with a confirmation that says Home forgets what it learned and that hearts, sizes, follows and hidden items stay. Your privacy has the "Tailor Home to what I do" switch, whose note says turning it off also clears what Home learned. The first screen asks for a first name and a username. The first name is private and only used for the greeting on Home (it starts empty, or with the first word of the name Apple passed). The username is the public name on the profile, listings and chats, prefilled with the one made from the email, and a taken name shows its error under the field. Skip goes on without saving.
- **Rationale:** People should see why a card is there and be able to say no, which builds trust in a feed that learns. Two short questions give a new person a useful Home on day one, and Skip keeps them optional.
- **Trade-off:** A long press is hidden, so the reason is not visible on the card. Showing it on every card would add noise to the grid.

- **Implementation:** `apps/mobile/components/feed-reason-sheet.tsx`, `apps/mobile/app/(app)/onboarding.tsx`, `apps/mobile/lib/onboarding.ts`, `lib/feed-queries.ts`, `settings/personalisation.tsx`, `settings/privacy.tsx`. The onboarding uses a plain white screen with the step count and Skip at the top, big option rows and one primary button (the welcome photo is not reused, the questions need room).
- **References:** `docs/plans/home-feed.md`

### D-024 : Invite friends lives in the profile tab and a friend's code is typed there

- **Date:** 2026-10-13
- **Area:** Extras, profile
- **Status:** Implemented
- **Decision:** "Invite friends" is a row under Balance on your own profile. The screen shows your code with a Share button, three short steps, who joined and your vouchers. A friend's code is entered in a "Have a friend's code?" section on the same screen, only for accounts up to 7 days old. Vouchers are shown but not used at checkout yet.
- **Rationale:** Sign up asks only for email and password (D-020) and Apple and Google sign in skip that screen, so one place for the code works for every way of joining.
- **Implementation:** `app/(app)/(tabs)/(home,inbox,profile,shop)/invite.tsx`, `apps/server/src/lib/referrals.ts`.

### D-025 : Away mode screen, return date chips and the banner on your profile

- **Date:** 2026-10-13
- **Area:** Settings, Profile, Help
- **Status:** Merged (PR #30, 2026-10-13)
- **Decision:** Settings has an "Away mode" row with a moon icon (it shows "On" while it is on). It opens a screen with one switch. Once on, a moon line says "Away until 20 Oct" or "Away until you switch it off", and a row of chips picks the return date: In 1 week, In 2 weeks, In 1 month, In 2 months, No date. While you are away, your own profile starts with a soft info coloured strip with a moon, one sentence and a small "I'm back" button. Settings also gets a "Help" row with a question mark icon (bundled articles in five groups: Buying, Selling, Shipping and orders, Your account, Safety, each article a short title and a few paragraphs, then a "Still stuck?" card that opens an email to us).
- **Rationale:** Chips need no native date picker (a new native module would need a new TestFlight build) and cover how people really use a break. The banner puts the way back where people see their own items, so nobody stays hidden by accident.
- **Trade-off:** You cannot pick an exact day, only these choices (the server accepts any day up to 90 days, so a date picker can come later).
- **Implementation:** `apps/mobile/app/(app)/(tabs)/(profile)/settings/away-mode.tsx`, `settings/help/index.tsx` and `[id].tsx`, `components/profile-view.tsx` (`AwayBanner`), `lib/help-topics.ts`, locale keys `away.*` and `help.*`
- **References:** D-019, `docs/originality.md`

### D-029 : The sizes question is a hand-drawn ink figure, one picture per step

- **Date:** 2026-10-13
- **Area:** Sign up questions (D-022)
- **Status:** Merged (PR #37, 2026-10-13). Replaces the code-drawn figure that was first merged as D-026 (the sizes entry, not "Log in and sign up slide up"), so the number D-026 is now only the slide up entry.
- **Decision:** The second sign up question shows a hand-drawn ink illustration of a woman, a man or a child, one picture per step. The part you are choosing for is in colour and the rest of the body is faded. Layout: the top bar ("2 of 2", Skip) stays, the picture fills the upper part of the screen on white, and below it a white card with window-radius top corners and a soft top edge holds the step title (large, bold) with progress dots at the end of the title row, a one line hint, rows of outline chips (D-008) each with a small uppercase label, the main button named after the next step ("Next: Bottoms", "Start browsing" on the last step, "Skip this one" as an outline button when nothing is ticked) and a quiet Back under it from the second step. Moving between steps cross-fades the pictures (300ms ease out on the UI thread, instant when the phone asks for less motion). All pictures of one person share one crop and size so the figure never jumps. If "What do you shop for?" had exactly one pick, that person is shown, otherwise a small "Whose sizes?" step comes first. Sizes are saved after each step like Settings, My sizes.
- **Steps and mapping:** only size groups that exist in the reference data. Women: Tops (letter sizes row and EU number sizes row, labelled Letters and EU numbers), Bottoms (jeans waist), Belts, Shoes. There is no "whole body, dresses" step any more. Men: Tops (letters), Bottoms (waist), Belts, Shoes. Kids: Clothes (age sizes, whole outfit), Shoes. "One size" is left out on purpose.
- **Rationale:** A long list of codes (XXS, EU 32, W28) means nothing until you see where on the body it goes. A real drawing feels warmer than a diagram and one part at a time keeps each choice short.
- **Trade-off:** Ten image files in the app (12 to 37 KB each, JPEG on white, generated with an AI image tool for this app and owned by Eden) instead of drawing in code. The pictures are not recoloured by tokens.
- **Implementation:** `apps/mobile/components/onboarding/` (`size-figure.tsx` the stacked pictures and the cross-fade, `size-steps.ts` the step to size group mapping, `sizes-step.tsx` the screen), pictures in `apps/mobile/assets/sizes/`, used by `app/(app)/onboarding.tsx`. Locale keys `onboarding.sizes.*`. The picture does not mirror in Hebrew, the rest of the layout does.

### D-030 : The website layout on laptops and phone browsers

- **Date:** 2026-10-14
- **Area:** Website (W0 of `docs/plans/website.md`)
- **Status:** Approved (Eden, 2026-10-14). Filters decided in a second round the same day, tried in the clickable prototype
- **Decision:** (1) On a laptop the frame is a top bar: the wordmark, one Browse button that opens the photo tiles of D-019 row 5 in a panel, the search field, inbox, alerts, hearts, your photo and Sell. No row of item types and no side bar. (2) On a phone browser a menu button opens a drawer from the end side with Sell, the Browse tiles and the profile list. No floating bar. (3) Inbox on a laptop is two columns, conversations and the open chat, with the order tracker card at the top of the chat as in the app. (4) The item page on a laptop puts the photos at the start and a card at the end that stays in view while scrolling: name, brand, size and condition, price, the buyer price pill, Buy, Or make your price, then the seller row with Message. (5) The sell form on a laptop has the form at the start and a live price tag card preview at the end ("How buyers see it"). (6) Grids show five cards across on a laptop. (7) Home keeps the big greeting headline. (8) Settings, Alerts on the website shows only By email, with a line saying phone alerts are set in the app. (9) A logged out visitor lands straight on Home, with Log in and Sign up in the top bar, and is asked to log in only to heart, message, buy or sell. (10) Help, Write to us is an email link as in the app. (11) Claude drafts Terms, Privacy and About, a lawyer checks them before real launch. (12) After picking an item type from the Browse panel, its results page opens with a strip of photo tiles for its types (All, then for example Mini, Midi, Maxi), the selected tile outlined in espresso, and the breadcrumb Browse › Dresses › Midi. Women, Men and Kids (only the groups that type has) are chips at the start of the filter row. (13) Filters are a row of pills (Sort, Size, Condition, Price, Colour). A pill opens a floating panel under it, over the grid, with room for every group (My sizes, letters, numbers). Clicking outside closes it. A pill with choices shows their count, and applied choices show as chips with a cross under the row, with Clear all. (14) On a laptop the results change on every click, with the number of pieces in the panel, and no Show results button (the app keeps its button because its filter page covers the grid). (15) On the website, sign up asks for the 6 digit email code right after the account is made, with a Later link so nobody is stuck if the email is slow (Eden, 2026-10-14). The app keeps confirming later in Settings. A marketplace needs reachable emails for order news.
- **Rationale:** The Browse button keeps the top calm and reuses the photo tiles, which are ours. Five across keeps photos big enough to judge fabric and fit. Visitors from Google or a shared link want the pieces, not a welcome page.
- **Trade-off:** The phone browser drawer means the website and the app get around differently on a phone (the app keeps its floating bar).
- **References:** D-019, `docs/website-brief.md`, `docs/mockups/website-options.html`, `docs/mockups/website-filters-prototype.html`

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

### D-033 : Clothing categories say what the garment is

- **Date:** 2026-10-14
- **Area:** Categories, category picker, Browse tiles, photo helper
- **Status:** Merged (PR #45, 2026-10-14).
- **Decision:** A clothing category names the kind of garment, never its fabric, occasion or fit. "Casual shirts", "Formal shirts" and "Linen shirts" become one "Button-up shirts" (Linen becomes the Material of those listings). Women and Men get the same names where the garment is the same: Dresses, Tops, Sweatshirts and hoodies, Knitwear, Jeans, Trousers, Shorts, Coats, Jackets, Blazers, Vests and gilets, Jumpsuits, Dungarees, Swimwear, Underwear and sleepwear, Sportswear. Women also have Matching sets, Kimonos and kaftans and Maternity. Women and Men have Uniforms and costumes. Overshirts sit under Tops (Women) and Shirts (Men). Hoodies and sweatshirts leave Knitwear. Women keep both Blouses and Button-up shirts. Jumpsuits and Dungarees are two groups. Men's first group is "Tops" like Women. Kids keep Girls, Boys and Baby. The purpose groups Sportswear, Maternity and Uniforms and costumes stay on purpose, they hold only things made for that purpose. No Era or Fit attribute yet. Rows people tend to mix up carry a one line hint under the name in the category picker ("A thick shirt worn open like a light jacket"), taken from the language files (`sell.categoryHints.<slug>`), so there is no schema change. Names that were too close to a competitor's pairs are replaced ("Tops and t-shirts", "Jumpers and sweaters", "Jumpsuits and playsuits", "Lingerie and nightwear", "Suits and blazers", "Outerwear", "Maternity clothes").
- **Browse:** Tops and Shirts are two tiles (Shirts takes Women's Button-up shirts, Blouses and Overshirts, Men's Shirts and Kids shirts). Knitwear is "Knitwear and hoodies" and also holds the sweatshirt groups. Shorts sit inside the Trousers tile. Bags moved to More so ten tiles still show on Browse. The Shirts photo is cropped from a sample photo, replace it with a real shirt photo.
- **Rationale:** A seller of a linen shirt had no right answer and the photo helper offered three. One noun answers "what is it" and everything else is a filter.
- **Trade-off:** Several old categories had no way to tell the new type (plain Coats, plain Jackets, Casual dresses), so their listings land on a first guess (Wool coats, Other jackets, Other dresses) and can be re-sorted later.
- **Implementation:** `packages/db/src/seed/reference/categories.ts` (the tree), `category-moves.ts` (old to new), `seed/category-moves.ts` (the move, run by the reference seed), `apps/mobile/lib/browse-tiles.ts`, `apps/server/src/lib/photo-assist.ts` (`PHOTO_HINTS`), `docs/blueprint/data-model.md` (the tree).
- **References:** D-010, D-019, `docs/originality.md`

### D-031 : The Colours picker is a grid of round swatches

- **Date:** 2026-10-14
- **Area:** Sell form, Colours sheet
- **Status:** Merged (PR #46, 2026-10-14).
- **Decision:** The Colours sheet shows large round swatches (44px) in four columns with the name underneath, instead of a list of rows with a small dot. The header, the "Pick up to 2 colours" line, the "Looks like" section (photo helper guesses) and "All options" stay as they were. A picked swatch gets a ring in the accent colour and a small check badge, and its name turns heavier. Two colours at most, exactly as before: once two are picked the others fade and cannot be tapped until one is unpicked. White and Cream keep a hairline border so they show on the white sheet. Multicolour is drawn as four pie slices using the swatch values of Red, Yellow, Green and Blue from the same reference data, so it reads as many colours. Gold and Silver are flat. Each swatch is a checkbox button named after its colour. The grid mirrors in Hebrew and the sheet scrolls on small phones.
- **Rationale:** Colour is something people choose by looking. A bigger swatch is easier to compare and tap than a 20px dot in a text row. Founder chose option A (swatch grid) over pills and grouped families.
- **Trade-off:** Fewer colours fit on screen at once than in a tight list, so small phones scroll a little. The Filters screen still uses the list with small dots.
- **Implementation:** `apps/mobile/components/sell/colour-grid-sheet.tsx`, used in `apps/mobile/app/(app)/sell-form/index.tsx`.
- **References:** D-004, D-019

### D-032 : The item card is a price tag on the photo, and saving is a bookmark

- **Date:** 2026-10-14
- **Area:** Components, Item card, Saving items
- **Status:** Merged (PR #51, 2026-10-14). Supersedes the item card of D-007 and the price tag card of D-019 (heart in the price row, small capitals line, buyer price pill on cards, the "Was" and percent off lines). Keeps from D-007: espresso for sale emphasis (never red), green only for Sold, press scale 0.98.
- **Decision:** Founder picked direction 2, "Tag on photo". The seller price sits on the photo's bottom-start corner as a small white paper tag (6px corners, hairline border). A price drop shows the old price, muted and struck, inside the tag before the new price. Sold: the photo keeps its white wash and the tag shows the price muted and struck, nothing else (the price is gone, same meaning as D-007). The status badge (Price drop, Buzzing, Sold) moves to the top-start corner. The save button is top-end: a Lucide Bookmark in a small white circle (32px), filled with the accent colour when saved. It shows for a signed in viewer, never on your own items, and sold items have none except on Favourites. Below the photo: the title on one line (truncated), then size and condition, then the Covered buyer price as a tiny muted line with a BadgeCheck icon (no pill, no background). The screen reader reads title, price, size and condition, and "Saved" when saved. Everywhere in the app the heart is replaced by the Bookmark for saving: the item page save pill, the count on your own listings, the Favourites row in the profile menu and the notification icons. The saved searches row moved to a SearchCheck icon so it no longer clashes. The buyer price pill keeps its place on the item page, sell form preview and offer sheet, with a BadgeCheck instead of a check. Favourites, its endpoints and data are unchanged, and no screen or text was renamed.
- **Rationale:** The price is the first thing a shopper looks for, and on the photo it is seen without a row of text under every picture. A bookmark reads as "keep this for later" without implying a social like.
- **Trade-off:** The tag covers a corner of the photo. The brand name no longer shows on the card (the title carries it). Some user-facing texts still say favourite, heart or like (open question for Eden).
- **Implementation:** `apps/mobile/components/listing-card.tsx` (`hideSave` and `saveOnSold` props), `CoveredLine` in `components/price-pill.tsx`, new key `browse.cardSaved`.
- **References:** D-007, D-008, D-019

### D-034 : Chat: ledger line offers and smaller bubbles

- **Date:** 2026-10-14
- **Area:** Chat
- **Status:** Approved (Eden, 2026-10-14)
- **Decision:** Eden picked direction B, "Ledger lines". Message bubbles get 12px corners (`rounded-control`) with a 3px tail corner, text at 15 over 21, padding 12 by 9 and a 76% maximum width. Yours stay filled espresso, theirs are white with a 1px `border` hairline. Photo bubbles take the same corners. An offer is one full width line, not a bubble on one side: a 3px bar at the start edge (espresso when the offer is yours, grey when it is theirs), the label ("Your offer", "Their offer") with the status under it in plain text (green when accepted, no pill), and at the end edge the amount at heading size with the listed price struck under it. An accepted offer shows its "held until" note in muted text under the line, lined up with the label. The actions are a thin bar along the bottom of the card in equal cells separated by hairlines: Decline, Counter, Accept for the receiver (Accept last, espresso and bold), Withdraw for the sender, "Buy for" with the amount for the buyer of an accepted offer. System lines such as "Counter offer sent" are plain small muted centred text without a pill. The order step in the chat loses its border and keeps the surface fill with 12px corners. The person card inside the chat is removed, the top bar already shows who it is.
- **Rationale:** The old offer card and bubbles felt big and toyish next to the rest of the app.
- **Trade-off:** Offers no longer sit on a side like messages, so who made them is told by the label and the colour of the bar.
- **Implementation:** `apps/mobile/components/chat/message-bubble.tsx`, `apps/mobile/components/chat/offer-bubble.tsx`, `apps/mobile/components/chat/order-divider.tsx`.
- **References:** `docs/mockups/chat-options.html` (direction B), D-019

### D-035 : Website polish after the first laptop review

- **Date:** 2026-10-14
- **Area:** Website, layout, item card, chips, menus, language
- **Status:** Approved (Eden, 2026-10-14). Changes parts of D-008 (chip size on the website), D-030 (side margins) and D-032 (no "..." card menu on the website).
- **Decision:** (1) Wider margins on laptops: the page container is capped at 1280px with 48px side padding from the `lg` width and 80px from `xl`, so cards stay 5 across but get narrower. The top bar, footer and every page share it. Phones are unchanged. (2) The "with Coverage" line under a card is 11px (`card-meta`) and the protection is named "Coverage" (one key, `protectionName`, shared with the app, Hebrew stays "כיסוי"). (3) Website chips are 10% smaller: 29px tall, 13px side padding, 14px text (the filter pills and the small chips on the item page and sell form follow). (4) The website cards have no "..." menu (Why you see this, Not interested) and always show the bookmark top-end. The server endpoints and the app keep it. (5) Menus and lists have no filled hover: text and icon turn espresso, keyboard focus gets a 2px espresso ring inside the row, and the current item is bold or has a check, never a fill. (6) The globe in the top bar, the phone drawer and the footer opens a small language menu (English and עברית, a check on the current one, short name EN or עב on the button) instead of switching on click.
- **Rationale:** Eden saw the live site on a laptop: cards felt too wide and chips too big, the cream hover block looked heavy, one click to switch language was easy to hit by accident, and the "..." menu hid the save button.
- **Trade-off:** Narrower cards show a little less of each photo. Without the "..." menu the website has no way to hide an item or seller (the app still does).
- **Implementation:** `apps/web/components/chip.tsx`, `home-feed.tsx` (chips switch in the browser, the other moods load in the background), `language-menu.tsx`, `lib/utils.ts` (`MENU_ROW`, `FOCUS_RING`), `item-card.tsx`, `price-pill.tsx`, the page containers. Loading skeletons for the tile, search, item and seller pages and smaller, blurred tile photos belong to the same round.
- **References:** D-008, D-030, D-032

### D-036 : The sell form also reads the seller's words, and gives gentle photo tips

- **Date:** 2026-10-14
- **Area:** Sell form, app and website
- **Status:** Merged (PR #66, 2026-10-14). Extends D-028 (Eden confirmed D-028 applies: nothing is filled in by itself).
- **Decision:** When the seller leaves the title or description box of a new listing, Claude Haiku reads the words and guesses the category (top 3), brand, condition and colours. The guesses join the photo helper's in the same places (D-028): "Looks like" first in the category panel and the quiet "Boots?" hint on the empty Category row, the brand first in the brand list, colours first in the colour grid. Words win over photos for category, brand and condition, photos win for colours, and a category both agree on goes first. A brand from the words is labelled "Looks like: Nike", one read from a tag keeps "From the tag: Nike". Condition is new: while no condition is picked, a small chip with the sparkle sits above the condition slider ("Looks like: Very good") and one tap picks it. It is read again only when the words changed and something is still unpicked, at most 5 times per listing. Photo tips: the same photo read now also looks for a photo that is too dark, cuts the item off, or shows a phone number or contact details. Photos added after the first read are checked once in a small separate read. Under the photo row a quiet line with the sparkle says, for example, "Photo 2 looks a bit dark. Daylight helps it sell", at most 2 lines, each with an X to close it. A tip never blocks saving or posting. When the AI is switched off (no key, the admin switch, or a spend cap), none of this shows and the app does not ask.
- **Rationale:** Sellers type "Nike Air Force 1, worn twice" long before they reach the pickers, so the words are often surer than the photos, and condition is something only words can tell. Photo tips help items sell without a rule that blocks anyone.
- **Trade-off:** Words and photos are read in separate calls, so the photo guesses are not delayed until the seller finishes typing (a text-only read costs about 0.01 cents). The photo tips ride along with the existing photo read for almost nothing, and photos added later cost one small extra read.
- **Implementation:** shared shapes and `mergeGuesses` in `packages/shared/src/photo-assist.ts`. Server: `lib/text-reader.ts`, `lib/photo-reader.ts`, `lib/photo-assist.ts`, `routes/photo-assist.ts` (`/v1/listings/suggest-text`, `/v1/listings/photo-check`). App: `lib/sell-assist.ts`, `lib/sell-store.ts`, the sell form. Website: `components/sell/sell-form.tsx`.
- **References:** D-028, `docs/unfinished-work.md` (AI features with Claude Haiku)

### D-037 : Search in plain words turns into filters, with an easy way back

- **Date:** 2026-10-14
- **Area:** Search, app and website
- **Status:** Merged (PR #68, 2026-10-14).
- **Decision:** When someone searches a sentence (3 words or more, or a number in it), for example "red summer dress under 100", Claude Haiku turns it into our normal filters: category (a whole group such as Dresses when the words are general), brand, size, colour, condition, material, pattern, price and order ("cheapest"). The filters switch on by themselves and show as the usual chips with an X. Only specific words no filter covers, such as a model name ("air force 1"), stay as the search text, because every search word must match and filler words would hide good items. One quiet line with the sparkle sits above the results, "Searched as filters", with a "Search the exact words" link that goes back to a plain word search. Short searches ("Zara", "linen shirt") never go to the AI and stay instant. It works for signed out visitors too, at most 20 new sentences an hour per person or internet address, and a repeated sentence is remembered so it costs nothing. If the AI is off, slow, over its limit or unsure, the search simply uses the exact words.
- **Rationale:** A plain word search for a sentence finds almost nothing, because every word must match. Turning it into filters finds the items, and the chips show exactly what was understood, so nothing is hidden.
- **Trade-off:** A sentence waits 1 to 2 seconds for the AI before the results show. Unlike the sell form (D-028, D-036) the filters switch on without a tap, Eden chose that because the undo is one tap and the plain search would be empty anyway.
- **Implementation:** shared shapes and `applyUnderstanding` in `packages/shared/src/search-assist.ts`. Server: `lib/search-reader.ts`, `POST /v1/search/understand`. App: the search screen. Website: the search field and the results page.
- **Note (2026-10-15, Eden asked for speed):** Simple searches are now answered instantly by fixed rules (`apps/server/src/lib/search-rules.ts`, English and Hebrew): a price phrase, our colour names, a category name, a gender word, a brand written exactly, "cheapest" or "newest". The rules answer only when every word was understood and fall through to the AI otherwise (a size, a condition, a material, an unknown word, or a category name that exists in several branches with no gender word). A rules answer costs nothing, does not use the 20 an hour limit and is not logged as an AI call. The AI gets a shorter list: each category line has the English path and only the Hebrew name of the node, conditions are names only, and the size groups are sent only when the words mention a size. The prompt is asked to stay cached for 1 hour instead of 5 minutes.
- **References:** D-036, `docs/unfinished-work.md` (AI features with Claude Haiku)

### D-038 : One Review list in the admin pages, sorted and flagged by the AI, decided by Eden

- **Date:** 2026-10-14
- **Area:** Admin pages (website), listings, reports
- **Status:** Merged (PR #69, 2026-10-14).
- **Decision:** A new admin page, Review, right after Dashboard, holds member reports and the AI's own listing flags in one list, most urgent first (Urgent, Normal, Low, then Not sorted, then newest). The menu shows how many urgent items are open. Listing check: when a listing goes live, or a live listing's words, brand, category or photos change, Claude Haiku reads the words and the first 2 photos and looks for items that are not allowed, likely fakes, offensive words or pictures, words and photos about different items, and attempts to pay or talk outside the app. Anything it finds becomes one "AI check" row with a short summary. The listing stays live until Eden looks (Eden's choice): the AI never hides, removes or bans anything. Report sorting: when a member reports something, the AI reads the reason, their note and what is reported, and sets the urgency, its own reading of the problem and a one line summary. For a reported chat message it reads only the reason and the note, never the message, until the privacy policy says chats can be read. Each open card has an optional note and Eden's buttons: Hide listing, Remove listing (asks first), Dismiss, Mark handled. Hiding or removing closes every open report about that listing. A listing reserved for a buyer cannot be hidden or removed while its order is in progress, and a listing our team hid stays hidden: the seller cannot put it back live. Handled items move to the Handled tab with their note.
- **Rationale:** Reports could be sent but nobody could see them. One list with the urgent things first means Eden only has to check one place, and the AI does the reading without ever deciding.
- **Trade-off:** Reading 2 photos costs about 0.1 cents per listing, about 10 times a words only check, but fakes and items that are not allowed often only show in the photos. A wrong flag costs Eden a look, never the seller their listing.
- **Implementation:** shared shapes in `packages/shared/src/review.ts`, new report columns (`source`, `urgency`, `ai_reason`, `ai_summary`, a report without a reporter is an AI check). Server: `lib/listing-check.ts`, report sorting, `GET /v1/admin/review`, `POST /v1/admin/review/:id/action`. Website: `app/[lang]/admin/review`.
- **References:** D-036, D-037, `docs/unfinished-work.md` (AI features with Claude Haiku)

### D-039 : A calmer top of the website

- **Date:** 2026-10-14
- **Area:** Website, top bar, Home
- **Status:** Approved by Eden and merged (PR #72, 2026-10-15). Changes the Home greeting of D-030 (row 7) and the look of the Home mood chips (D-008, D-035).
- **Decision:** Eden picked direction C of `docs/mockups/top-bar-options.html` ("Today, tightened"), with the search bar fully rounded. The top bar keeps its layout. The wordmark is near black (text-1) in bold, the bar's bottom line is the subtle border, the search bar is white with a thin border and fully rounded (no cream fill), and the Sell button shows a plus instead of the camera. The Home greeting is one line, "Good evening," in light weight and the first name in semibold, at the title size instead of two display lines. The Home mood chips are pills (fully rounded, 32px tall, light border, text-2), the chosen one filled near black. The buttons at the end of the top bar are slimmer: Sell, Sign up and Log in are 34px tall with 8px corners and less padding, Sign up has a light border and dark text instead of the espresso outline (the phone menu keeps its 40px Sell). Chips elsewhere are unchanged.
- **Rationale:** Eden felt the top of the website looked childish. The cream filled search, the heavy chip outlines and the huge two line greeting made it read playful rather than grown up.
- **Trade-off:** Home chips now differ from the filter chips on other pages. Directions A (quiet editorial) and B (department store) were not taken.
- **Implementation:** `apps/web/components/top-bar.tsx`, `sell-button.tsx`, `home-greeting.tsx`, `home-feed.tsx`.
- **References:** D-008, D-030, D-035, `docs/mockups/top-bar-options.html`

### D-040 : The website item page is quieter, and cards flip through photos

- **Date:** 2026-10-14
- **Area:** Website, item page, item card
- **Status:** Approved by Eden and merged (PR #70, 2026-10-15). Changes the item page of D-030 (row 4) and the price block that D-032 kept on the item page.
- **Decision:** (1) The item page price reads like the card: the seller price in espresso, a drop shows the old price muted and struck with a "% off" badge, and the Coverage price is a quiet line with a BadgeCheck (no pill). (2) No cream fills on the right: the price breakdown sits under a hairline. (3) The main photo has no cream fill and always fills a 3:4 frame (cover fit, like the cards), the thumbnails stay beside it. (4) The description moves into the right panel under the price, and the panel no longer stays pinned while scrolling, so a long description cannot hide its bottom. (5) On the card, a click on the photo opens the item, and on hover a card with more than one photo shows a next arrow on the end side (and a back arrow after the first photo) with small dots, up to 5 photos. (6) The Coverage note says the buyer is protected by Coverage and that we step in, not that money comes back by itself (shared with the app).
- **Rationale:** Eden found the cream blocks and the cream bars around photos heavy, the description easy to miss under the photos, and the old Coverage note promised an automatic refund we do not give.
- **Trade-off:** Photos that are not 3:4 lose their edges on the item page. Cards carry a few more photo addresses, one extra database query per page of cards.
- **Implementation:** `apps/web/app/[lang]/item/[id]/page.tsx`, `components/photo-gallery.tsx`, `components/item-card.tsx`, the optional `photos` on `listingCardSchema` filled in `toCards` (`apps/server/src/lib/discovery.ts`), key `item.breakdown.note`.
- **References:** D-030, D-032, D-035

### D-041 : Chat warns about likely scams

- **Date:** 2026-10-14
- **Area:** Chat, app and website
- **Status:** Merged, 2026-10-15 (#74).
- **Decision:** Every text message is checked by Claude Haiku in the background after it is sent (Eden's choice), so sending never slows down. When it asks to pay outside Vinty, shares a link that may not be safe, moves the talk to WhatsApp or a phone number, or rushes the other person, the person who received it sees one quiet line under that bubble with a small warning sign, for example "Careful: paying outside Vinty is not protected. Keep payment in the app". The sender sees nothing new. Clear scams (a fake payment link, asking for card details or codes) also go to Eden's Review list (D-038).
- **Rationale:** Deals moved off the app are where people get cheated, and a warning at the right moment protects them without blocking anyone.
- **Trade-off:** Reading every message costs about 0.006 cents each, but catches scams that are worded without the usual signs.
- **Implementation:** `warning` on messages. Server: `lib/chat-check.ts`. App and website: the chat screen.
- **References:** D-034, D-038, `docs/unfinished-work.md` (AI features with Claude Haiku)
- **Note:** Quick replies were built and tried, then left aside by Eden on 2026-10-15.

### D-042 : Style tags teach Home what people like, behind the scenes only

- **Date:** 2026-10-15
- **Area:** Home feed, listings
- **Status:** Merged, 2026-10-15 (#75).
- **Decision:** Every listing gets up to 3 style tags from a fixed list of 20: Vintage, Y2K, Streetwear, Minimal, Classic, Quiet luxury, Boho, Cottagecore, Romantic, Sporty, Outdoor, Preppy, Grunge, Goth, Western, Evening and party, Workwear, Summer and beach, Modest, Everyday basics. Narrow trends fold into a broad tag (coquette and balletcore into Romantic, gorpcore into Outdoor, old money into Quiet luxury). Claude Haiku picks them in the same call that already checks each new or changed listing (D-038), and listings Eden uploads in the admin pages get them too. Existing listings are tagged a batch at a time (up to 100 a night). Home learns styles the way it learns brands and sizes, so someone who keeps opening and saving vintage pieces sees more vintage across brands and categories. Nobody sees the tags (Eden's choice): no chips, no "Because you like" line, nothing for sellers to edit.
- **Rationale:** Brand and category alone miss taste: a vintage lover likes old Levi's and a 90s blazer alike. A fixed, broad list keeps enough items in each tag to learn from. The list was widened after looking at how resale sites and trend writers group styles, since none of the big resale sites publish an official list.
- **Trade-off:** One AI call now does two jobs (safety and taste), which keeps the photo cost at once per listing. If the tags turn out weak, they can move to their own call. Changing the list later means tagging again.
- **Implementation:** `LISTING_STYLES` in `packages/shared/src/enums.ts`, the "style" taste feature in `packages/shared/src/recommendations.ts`, `listings.styles`, the listing check (`lib/listing-check.ts`), the nightly catch up in the jobs.
- **References:** D-038, `docs/unfinished-work.md` (AI features with Claude Haiku)

### D-043 : Ask a question on the Help page, answered only from our help articles

- **Date:** 2026-10-15
- **Area:** Help page, app and website
- **Status:** Merged, 2026-10-15 (#76).
- **Decision:** At the top of the Help page an "Ask a question" box takes a question in the person's own words, in English or Hebrew. Claude Haiku answers in 2 to 4 short sentences using only our own help articles, and links up to 2 of them ("Read more"). Every answer carries a small sparkle and the line "Answer written by AI from our help pages". The AI cannot see anyone's account, orders or messages (Eden's choice): a question like "where is my order" gets a general answer and the right article. When the articles do not cover the question it says so, and the page points to "Write to us". Signed out visitors can ask too, at most 20 new questions an hour per person or internet address, and a repeated question is remembered at no cost. The box sits only on the Help page (Eden's choice). It never invents rules, fees or times, never asks for personal details and never moves anything off the app.
- **Rationale:** People rarely read a list of articles to find one answer. Answering only from our own pages keeps it honest, and a "not in our help pages" answer is better than a guess.
- **Trade-off:** About 0.01 cents a question. It is only as good as our articles, so a common question it cannot answer is a sign an article is missing.
- **Implementation:** shared shapes in `packages/shared/src/help-assist.ts`. Server: `lib/help-answer.ts`, `POST /v1/help/ask`. App and website: the Help page.
- **References:** Milestone 9 Help pages, `docs/unfinished-work.md` (AI features with Claude Haiku)

### D-044 : Order problems reach Eden's Review list with a facts only summary

- **Date:** 2026-10-15
- **Area:** Orders, admin pages (website)
- **Status:** Merged, 2026-10-15 (#77).
- **Decision:** When a buyer reports a problem with an order, Claude Haiku reads the order's timeline (paid, shipped, arrived, problem opened), the listing, the buyer's note and the chat between buyer and seller about it, and writes a short summary for Eden: what happened when, what each side says and what is worth checking. It never suggests an outcome (Eden's choice): no "refund", no "the buyer is right". The order lands in the Review list (D-038) as an urgent "Order problem" with the summary, both people, the amount and the buyer's note. If the AI is off or fails, the order still lands there, without a summary. On the card Eden has "Refund the buyer" and "Release to the seller" (each asks first, both use the support moves the server already had), plus Dismiss and Mark handled. The AI never moves money. The privacy policy's "AI helpers" section says the AI reads an order's details and its chat for this (Eden approved the line).
- **Rationale:** Order problems could be opened but nobody could see them or decide them in the admin pages. A summary saves reading a whole chat, and leaving out a verdict keeps the decision with a person.
- **Trade-off:** About 0.03 cents per problem. Facts only means Eden still weighs each case himself, which is slower than a suggested answer but cannot be nudged by a confident wrong one.
- **Implementation:** the `order` report target and the two actions in `packages/shared/src/review.ts`. Server: `lib/order-summary.ts`, the Review actions in `lib/admin-review.ts`. Website: order cards on the Review page.
- **References:** D-038, D-041, `docs/unfinished-work.md` (AI features with Claude Haiku)

### D-045 : The app item page speaks the card's language

- **Date:** 2026-10-15
- **Area:** App item page
- **Status:** Merged, 2026-10-15 (#79).
- **Decision:** Both the buyer's and the seller's item page show the price like the card and the website (D-040): the seller price in espresso, a drop shows the old price muted and struck with a "% off" badge, and the Coverage price is a quiet line with a BadgeCheck (no cream pill). The buyer's price breakdown has no cream fill: it sits under a hairline with the same content.
- **Description first:** the description sits right under the price in both views, among the first things anyone reads, before the details list (Eden).
- **Rationale:** Eden found the listing page did not match the updated card.
- **Implementation:** `PriceBlock` in `apps/mobile/components/price-pill.tsx`, used by `own-listing-view.tsx` and `buyer-view.tsx`.
- **References:** D-032, D-040

### D-046 : The logo is a gently tilted price tag with a bold Y

- **Date:** 2026-10-15
- **Area:** Brand, app icon, website header
- **Status:** Merged, 2026-10-15 (#89). A first logo "for now", while the name Yadii is not final.
- **Decision:** A price tag outline hanging from its string, tilted a little (8 degrees), with a bold Y inside, drawn in espresso. The app icon is the cream tag on an espresso square. Android uses the same cream tag on espresso, a white one for themed icons. The splash shows the espresso tag on white. The website header and the phone menu put the tag in front of the word Yadii, and the sharing preview shows both.
- **Choice:** Eden picked the price tag from six directions (two hands, a Y shaped hand, the ii as two people, a hanger with a Y hook, a price tag, a plain wordmark), then the tilt of one tag draft with the bold Y of another, and the gentle tilt over the swinging one.
- **Rationale:** A tag reads as second hand clothes at a glance, matches the price pills on our cards, and looks nothing like Vinted's plain word logo (docs/originality.md).
- **Implementation:** The master drawing is `packages/design/brand/logo-mark.svg`. App images in `apps/mobile/assets/images/` (icon, android icon layers, splash, favicon), iOS uses `icon.png` (the Expo placeholder icon file is gone). Website: `apps/web/components/logo-mark.tsx`, `app/icon.png`, `app/apple-icon.png`, `app/opengraph-image.tsx`.
- **References:** D-019, D-040

### D-047 : The Home top is the wordmark, two icons and a full-width search

- **Date:** 2026-10-15
- **Area:** App, Home
- **Status:** Merged, 2026-10-15 (#93). Changes the Home greeting of D-019 (implementation, navigation, item 2).
- **Decision:** Eden picked direction C ("Wordmark and icons") over B ("Search first, no greeting"). The top of Home in the app is the Yadii wordmark at the start. For signed in people, Alerts (a bell with a small espresso dot when something is unread) opens Notifications as its own page that slides in over Home, with a back arrow and swipe back, so you never leave Home. The Inbox keeps its own Notifications section. Saved (a bookmark) opens saved items. Both sit at the end. Under them is a full-width rounded search bar, then the mood chips. The search bar works in place (Eden, 2026-10-15): tapping it types right there with no new page. The wordmark row and the chips step aside, the bar stays at the top with Cancel at its end, and suggestions, recent and saved searches and then the results with their filters replace the feed. Cancel brings the feed back, as it was. Browse still opens the Search page.
- **Rationale:** The big two line greeting took about a fifth of the screen before the first photo, the light and bold split felt loud, and the small round search button looked like an afterthought.
- **Trade-off:** The personal greeting is gone. Saved items and notifications can now each be reached from two places. Eden first saw the bell switch to the Inbox tab and found that jump too direct, so it opens a page instead.
- **Implementation:** `apps/mobile/app/(app)/(tabs)/(home)/index.tsx`. The page is `(home,inbox,profile,shop)/notifications.tsx`. The list lives in `components/inbox/notifications-list.tsx` and is shared with the Inbox tab (the empty, error and loading states are in `components/inbox/list-states.tsx`). The search under the bar is `components/search/search-panel.tsx` (the field, the save bookmark and the panel, plus `useSearchSession`), shared by Home and the Search page (`(home,inbox,profile,shop)/search/index.tsx`). `SearchBar` takes an `onPress` so Home can start the search in place while Browse keeps opening the page.
- **References:** D-019, D-039

## Open decisions

Proposals, not rules, until explicitly promoted above.

| ID | Proposal | Decision needed |
|---|---|---|
| O-003 | Closed on 2026-10-12. Hebrew font is Heebo paired with Aileron (D-011). Currency is ILS (₪), shown as ₪45 in whole shekels with a comma for thousands and a dot for decimals. | None |

## Superseded decisions


### D-048 : Home and search show your shopping groups first

- **Date:** 2026-10-16
- **Area:** Home feed, search, Settings (Shopping preferences), app and website
- **Status:** Merged, 2026-10-16 (#106).
- **Decision:** The answer to "What do you shop for?" (Women, Men, Kids) is a lasting setting, shown at the top of Shopping preferences as three switches with the note "Home and search show these first. Everything else still shows, just a little lower". Items from other groups move a bit lower on Home and are never hidden. Surprise cards stay inside the person's groups, or come from the whole site while those have too few items. Liking something outside your groups lifts only that corner (women's cycling clothes, not dresses), fading at the normal speed. The default order of a word search puts, among items that match the words about as well, the person's groups first, then their taste, then their set sizes. A picked sort (Cheapest, Newest) stays exact. Visitors and people with "Tailor Home to what I do" off see the same order as everyone.
- **Rationale:** A man mostly does not want women's clothes on Home unless he went looking for them, and then only the kind he looked at. Lowering instead of hiding keeps Home full while stock is small.
- **Trade-off:** Without an answer, the groups are worked out from behaviour only once one group holds 60 percent of it, so a mixed shopper sees nothing lowered.
- **Implementation:** `docs/plans/home-feed.md` section 11. `user_settings.shops_for`, `GET` and `PUT /v1/me/personalisation/shops-for`, `resolveGroups` and the group values in `packages/shared/src/recommendations.ts`, `apps/server/src/lib/feed.ts` (score, surprise pile, `searchPersonal`), `lib/events.ts` (corners), `lib/discovery.ts` (`sortSpec`).
- **References:** D-022, D-042, `docs/plans/home-feed.md`

### D-049 : Bundles that people find, with the postage saving shown

- **Date:** 2026-10-16
- **Area:** Item page, seller page, bundle page, checkout, Settings (Bundles), Help, app and website
- **Status:** Merged, 2026-10-16 (#107).
- **Decision:** "Closet deal" is now "Bundle" everywhere a person reads it (Eden, 2026-10-16). The phrase "Bundle discounts" stays banned. In Hebrew it is "באנדל", never "חבילה" (that already means the postage parcel). Every seller has the ladder 2 items 5 percent, 3 items 10, 5 items 15 until they change it, and bundles are on by default (decision 4 of the plan). Under Buy, Send your offer and the seller's card, the item page shows a "Bundle from {seller}" box with the seller's steps and three states: no bundle yet (Add to bundle), a bundle that does not hold this item yet ("2 items in your bundle, 5% off. This one is not in it yet", steps lit for the current count, a main button that says what you gain such as "Add this item to get 10% off", and a separate View bundle), and this item is in ("Your bundle", View bundle, Remove). It is not shown on your own items, sold or reserved items, or for sellers who switched bundles off. On the seller's other items ("More from {seller}") each card gets a small "+ Bundle" pill at the bottom end of the photo, which turns into "In bundle" with a tick. While a bundle with a seller holds items, a slim dark bar sits at the bottom of that seller's item pages and profile only (decision 3): stacked photos, "3 items, 10% off · You save ₪37", the next step line and View bundle. The bundle page gets a steps bar that fills as items are picked, and the summary shows the postage as the struck through sum of separate parcels next to the one parcel price, and one green line "You save ₪37 with this bundle". Checkout shows the same line. Postage is unchanged (decision 1): the biggest parcel sets the price. Sellers switch bundles on or off and edit 1 to 5 steps in Settings, Bundles (items 2 to 20, percent 1 to 50, both growing). An offer on a whole bundle comes later (decision 2).
- **Rationale:** The bundle existed since Milestone 5 but nobody found it, the item page said nothing, the postage saving was invisible and real sellers had no steps, so live bundles gave 0 percent. Showing the saving where the buyer is looking is what makes a second item an easy yes.
- **Trade-off:** Items are not held while they sit in a bundle, only checkout holds them, so an item in a bundle can sell to someone else (the bundle page greys it with "Sold, removed from your bundle").
- **Implementation:** `docs/plans/closet-deals.md`. `user_settings.bundles_on`, `DEFAULT_BUNDLE_LADDER` and `bundleSavedMinor` in `packages/shared`, `loadBundleLadder` and `bundlePostage` in `apps/server/src/lib/bundles.ts` (used by the bundle reply and by `checkout.ts`), `GET /v1/users/:id/bundle-ladder`, `GET` and `PUT /v1/me/bundle-ladder`, `GET /v1/bundles/open`, `postageSeparateMinor`, `postageTogetherMinor` on the bundle and `postageSavedMinor` on the checkout quote. Website: `apps/web/components/bundle/` (box, bar, card button, profile button), `lib/bundle-queries.ts`, `components/settings/bundle-ladder-form.tsx`. App: `apps/mobile/components/bundle/`, `lib/bundle-queries.ts`, `settings/bundles.tsx`.
- **References:** D-019, D-032, `docs/originality.md`, `docs/plans/closet-deals.md`
### D-050 : The bundle pill appears when you add, and the bundle box moves smoothly

- **Date:** 2026-10-17
- **Area:** Item page and seller page, app
- **Status:** Proposed, waiting for Eden's merge.
- **Decision:** The slim dark bundle bar of D-049 is now an espresso pill floating just above the tab bar, with the same height, rounded shape and shadow as the tab bar (Eden, 2026-10-17). It shows only after you tap "+ Bundle" or "Add to bundle" in this visit to the app, and goes away when the bundle is empty, so an old bundle never pops it up by itself. Its first line is "2 items, 5% off", which becomes "2 items · You save ₪37" once the server has the prices, and the second line is the next step. In the item page box, "this item is in" stacks View bundle over Remove (no longer side by side), so it is as tall as the "not in yet" state and adding does not shift the page. The box, the steps, the "+ Bundle" pills and the pill change the moment you tap, and the server catches up behind them. The box grows and shrinks over about a quarter of a second, lit steps fade in, and the pill rises in and sinks away. All motion is off with Reduce Motion. The seller's other items row on the item page shows again (it had collapsed to nothing).
- **Rationale:** Eden found the full width brown block heavy and the bar showing up on its own confusing. Recorded taps showed the jumpiness came from waiting for the server, the box blanking and the page snapping.
- **Trade-off:** For a moment after a tap the screen shows what the server is about to confirm. If it refuses, the box goes back and shows "That item could not be changed". "View bundle" now sits where the add button was, so a fast double tap opens the bundle page.
- **Implementation:** `apps/mobile/components/bundle/bundle-bar.tsx`, `bundle-box.tsx` (SmoothHeight), `steps.tsx`, `card-button.tsx`, `lib/bundle-queries.ts` (count and inBundle include changes on their way, the pill's per seller switch), `components/item/buyer-view.tsx`. The website is unchanged.
- **References:** D-019, D-049

### D-051 : Books and magazines describe condition in reading words

- **Date:** 2026-10-17
- **Area:** Sell form, item page, item cards, admin upload (app and website)
- **Status:** Proposed, waiting for Eden's merge.
- **Decision:** Books and magazines keep the same five condition levels as everything else, but once a book or magazine category is picked the levels read as Brand new, Like new, Very good, Good and Well read, each with a line about reading instead of wearing ("Read once at most, no marks or creases"). The item page, cards and admin upload use the same words. Filters keep the usual names, since one filter covers every category.
- **Rationale:** "Unworn with tags" and "Well loved" are clothing words and read oddly on a book. Eden chose book words on the same levels over a separate list, so the condition filter, search and the AI helper keep working across all items.
- **Implementation:** The wording is `bookCondition` in `packages/locales`. The server sends it with each condition as `forBooks` (`apps/server/src/lib/reference.ts`), and `conditionWords` and `isReadingCategory` in `packages/shared/src/listing-rules.ts` pick the words for a category (paths under `media/books` and `media/magazines`).
- **References:** D-019

### D-052 : Browse tiles show real listings, and the website panel has a Women and Men switch

- **Date:** 2026-10-17
- **Area:** Website Browse panel, drawer and Browse page
- **Status:** Proposed, waiting for Eden's merge.
- **Decision:** Each website Browse tile shows the card-sized cover of the newest active listing in its categories, so the pictures stay real as listings come and go. A tile whose categories have no listing yet shows a stock photo instead, so no tile is ever a blank colour square. The "More" tile now has a photo too. The Browse panel has two pills at the top, Women and Men (the same chips as the filters), that swap the ten tiles to that side. Women keeps Dresses and Skirts, Men swaps them for Accessories and Sportswear. Each side's tiles only look at that side's listings and open the tile page already on that side. The last choice is remembered in the visitor's browser and Women is the start. The app's Browse tab is unchanged.
- **Rationale:** Stock pictures made the site feel empty next to real items. Men and Women shop different shelves.
- **Trade-off:** The website asks the server for one listing per tile, kept for five minutes. Fallback photos still ship with the site.
- **Implementation:** `apps/web/components/browse-tiles.tsx` (cover lookup), `browse-panel.tsx` (the switch), `packages/shared/src/browse-tiles.ts` (`browseTilesFor`), fallback photos and credits in `packages/design/browse/`.
- **References:** D-019, D-030

### D-053 : Website top bar bell panel, Men and Women pills on Home, no greeting, "Categories" in Hebrew

- **Date:** 2026-10-17
- **Area:** Website top bar and Home, Hebrew wording (app and website)
- **Status:** Proposed, waiting for Eden's merge.
- **Decision:** The bell in the website top bar opens a small panel under it with the latest 5 notifications (unread ones tinted with a dot) and a "View all notifications" button to the full list. Home gets a small Women / Men pair of pills after the mood chips, separated by a thin line. They work together with the mood (for example New today and Men), tapping the chosen one again clears it, and the choice lives in the address (`?group=men`). The Home greeting is removed for now. In Hebrew the Browse button and the Browse panel title say "קטגוריות" instead of "גלישה" (which means surfing), which also changes the app's tab label.
- **Rationale:** The bell used to jump to another page, a quick look is lighter. Men and Women are the first thing most shoppers filter by. The greeting pushed the feed down for little value.
- **Implementation:** `BellLink` in `apps/web/components/inbox/inbox-link.tsx` (reuses `NotificationRow`), `HomeFeed` and `lib/feed-url.ts`, `GET /v1/feed?group=women|men` (`feedQuerySchema`, `feedConditions`: the top category and everything under it).
- **References:** D-030, D-039

### D-054 : More shows what is behind it and opens inside the Browse panel

- **Date:** 2026-10-17
- **Area:** Website top bar, Browse panel
- **Status:** Proposed, waiting for Eden's merge.
- **Decision:** The More tile is a small grid of four pictures of the categories behind it, with "More" and how many there are ("9 more categories"), instead of one T-shirt photo. Clicking it no longer leaves the page: the panel grows in place with a short slide and shows the rest under a "More to explore" line as smaller tiles, and More turns into "Show less". The rest follows the Women and Men switch (Men has no Dresses or Skirts, gender-free ones like Home and Kids show on both). The panel scrolls when it is taller than the window and opens at the first ten again next time. With Reduce Motion the slide is off. Without JavaScript More is still a link to the Browse page.
- **Rationale:** Eden: the More picture should hint at the other categories, and opening them in the same window is nicer than moving to a page.
- **Implementation:** `apps/web/components/browse-more.tsx` (`BrowseMoreTile`, `BrowseRest`), `browse-panel.tsx`, `browse-tiles.tsx` (`rest`), `browseRestFor` in `packages/shared/src/browse-tiles.ts`.
- **References:** D-030, D-052

### D-055 : The app's Browse tab gets the Women and Men switch, listing covers and shows every category

- **Date:** 2026-10-17
- **Area:** App Browse tab
- **Status:** Proposed, waiting for Eden's merge.
- **Decision:** The Browse tab matches the website (D-052, D-054), adapted to a phone. Two chips, Women and Men, sit under the search bar and swap the ten tiles (remembered on the phone). Each tile shows the cover of the newest active listing in its categories, with the stock photo underneath until it arrives (and when there is none), and two tiles never show the same listing. Tapping a tile opens its results already on the same side. There is no More on the phone: every category of that side is shown in one grid, the main ten first (Eden, 2026-10-17). An All categories button under the grid opens the whole category tree as rows, so every deeper category (Designer and the rest) stays reachable (D-015, put back 2026-10-17 after Eden missed it).
- **Rationale:** Keep the app and website the same where it fits. On a phone the screen scrolls anyway, so opening and closing More was an extra step for no gain.
- **Implementation:** `apps/mobile/app/(app)/(tabs)/(shop)/browse/index.tsx`, `tile.tsx` (`group` parameter), `lib/browse-covers.ts`, `lib/browse-tiles.ts` (`tilesFor`, `restFor`).
- **References:** D-019, D-052, D-054

### D-056 : Home gets a Price chip instead of Under 50

- **Date:** 2026-10-17
- **Area:** Home on the website and in the app
- **Status:** Proposed, waiting for Eden's merge.
- **Decision:** The Under 50 chip on Home becomes a Price chip in the same place and style. It opens a small panel with From and To fields in whole shekels, four quick picks (Under 50, 50 to 100, 100 to 200, 200 and up), Clear and Show. With a range set the chip is filled and shows it ("Under ₪50", "₪50 to ₪100", "₪200 and up", "₪30 to ₪80"). It works together with Women, Men and the other moods. On the website the range stays in the address (`?priceMin=50&priceMax=100`, whole shekels) so a reload keeps it, and an old `?mood=under_50` link becomes the Price chip with a top of 50. The feed takes `priceMinMinor` and `priceMaxMinor` (inclusive, minor units, swapped when the first is higher). The server keeps the `under_50` mood so installed apps that still send it keep working.
- **Rationale:** Under 50 was one fixed price. A range lets people shop the budget they have, and the chip row stays the same length.
- **Implementation:** `packages/shared/src/discovery.ts` (`feedQuerySchema`), `apps/server/src/lib/feed.ts` (`feedConditions`), `apps/web/components/home-price-chip.tsx`, `home-feed.tsx`, `lib/feed-url.ts`. The panel is drawn on the page body, not inside the chip row, because the row scrolls sideways on a phone and would cut it off. The app side is built separately against the same feed query.
- **References:** D-019, D-030, D-039

### D-057 : Search words stay whole, short words match whole words only

- **Date:** 2026-10-18
- **Area:** Search, app and website (one server rule)
- **Status:** Proposed, waiting for Eden's merge.
- **Decision:** A search word keeps the marks that join its pieces: "H&M", "Levi's", "T-shirt", "A.P.C.", "ג'ינס" (also with the Hebrew ׳ and ״ marks) are each one word, and "h & m" typed with spaces is "H&M". Each word must appear in the item: as a word in the title, brand or description, inside a word of the title or brand (only for words of 3 letters or more, so "shirt" finds "tshirt" and "חולצה" finds "בחולצה"), or as the name of its category. A word of 1 or 2 letters ("hm", "xs", "38") matches whole words only, and a single letter never looks inside the brand name. The joined spellings meet: "levis" finds "Levi's", "גינס" finds "ג׳ינס" and "ג'ינס", "HM" finds "H&M". A whole search that only resembles a brand turns into that brand only when it has no more words than the brand name and is about as long: "nikee" is Nike, "nike air" and "zara xs" are not. In the default order, items with every word at the start of a word in the title or brand come first, then items with the words buried inside longer words, then the rest, newest first within each.
- **Rationale:** The search used to cut "H&M" into "h" and "m" and accept any item with those letters anywhere, so "H&M" found Tommy Hilfiger jeans, and the same happened to "Levi's" and to Hebrew words with an apostrophe. Short pieces inside long words are noise, and the Hebrew spellings with and without the mark are the same word to the person typing.
- **Trade-off:** A word of 3 letters still matches inside longer words, so "גינס" also finds a book by "היגינס" (now at the bottom, not the top). Real Hebrew prefixes need that, so it stays.
- **Implementation:** `apps/server/src/lib/discovery.ts` (`searchTerms`, `termQuery`, `textConditions`, `sortSpec`), `apps/server/src/lib/photo-assist.ts` (`aboutAsLong`), Favourites search in `routes/engagement.ts` uses the same matching. Tests in `lib/discovery.test.ts` and `routes/discovery.test.ts`.
- **References:** D-037

### D-026 : Welcome turns into Log in and Sign up

- **Date:** 2026-10-13
- **Area:** Welcome, log in, sign up, forgot password
- **Status:** Merged (PR #32, 2026-10-13)
- **Decision:** Welcome, Log in and Sign up are one surface. Tapping Log in or Sign up on the welcome screen moves the welcome photo up and shrinks it into the photo band at the top while the white form sheet rises from the bottom, as one smooth motion of about half a second with no bounce. The welcome headline and buttons fade out as it happens. The close X over the band plays it backwards and returns to welcome. The links between Log in and Sign up, and Forgot password with its back arrow, swap the sheet in place with a quick fade, the photo stays put. With reduced motion on, everything jumps with no movement.
- **Rationale:** The first version slid the whole form screen up over the photo, which felt like two separate pages and was not smooth. One photo that travels with the form feels like the welcome screen turning into the form.
- **Implementation:** `apps/mobile/components/auth-motion.tsx` (one motion value, photo scaled and shifted with transforms, sheet moved with a transform, all on the UI thread), `app/(auth)/_layout.tsx` (the three screens are see-through so the photo behind shows through). The routes stay `/log-in`, `/sign-up` and `/forgot-password`.

### D-028 : The photo helper shows its best guesses first and never fills anything

- **Date:** 2026-10-13
- **Area:** Sell form
- **Status:** Merged (PR #36, 2026-10-13). Replaces the auto-fill version first merged in PR #35. (Took D-028 because D-027 may be used by a change in flight.)
- **Decision:** After the first photos finish uploading on a new listing, a quiet line with a small sparkle, "Reading your photos", shows under the photo tiles while the server looks at them, and disappears when it is done. The helper never fills a field by itself and nothing is marked "Suggested". Its guesses are put first inside the pickers the seller goes through anyway, so the right choice is one tap and a wrong guess costs nothing. Category: the first panel starts with a "Looks like" section of up to 3 guessed categories (name with the path above it in small text, for example "Boots" under "Women · Shoes"), then "All options" and the normal tree. Tapping one picks it and closes the panels like any category. While the Category row is empty it also shows the top guess in the muted value style ("Boots?") and opens the panels on tap. Brand: the picker lists "From the tag: Zara" first. If the read brand is not in our list, tapping the row types it into the search so the usual "Ask us to add" link is there. Colours: the detected ones are listed first under "Looks like" (not ticked), then all of them. A picker shows the guesses as they were when it opened, so an open list never jumps. If the helper finds nothing, or fails, the form looks exactly as before. It runs once per new listing, not when editing. Only category, colours and brand are ever guessed (2026-10-14: the title, story and material guesses were removed, the seller writes those). Size, condition, price and parcel are never suggested (a photo cannot show them). (2026-10-14: condition is now guessed from the seller's words, see D-036.)
- **Rationale:** A first version filled the fields itself with a "Suggested" mark. A real test filled boots as "Women's sneakers" with high confidence, which was wrong and felt pushy. Eden wanted it to feel seamless: the recommended option shows up inside the steps the seller does anyway. Three ranked category guesses make a miss cheap.
- **Implementation:** `lib/sell-assist.ts` (`usePhotoAssist`, `categoryGuesses`), `lib/sell-store.ts` (`assist`, `suggestion`), the category panel (`app/(app)/sell-form/category.tsx`), `BrandSheet` (`fromTag`), `PickerRow` (`hint`).
