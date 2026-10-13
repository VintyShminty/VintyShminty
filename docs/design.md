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

**Item card (D-007, superseded in part by D-019: the price tag card, heart in the price row, small capitals line, price pill. See the D-019 implementation note).** Portrait 3:4 photo with 12px rounded corners and no border. A white circle heart (32px) sits top-right on the photo. A badge sits bottom-left on the photo, using the standard outline badge (D-008): Bumped and Price drop in espresso, Sold in green. Below the photo: brand in bold with the favourite count (small heart and number) at the right, a description of up to two lines, size and condition, then the price. Price drop: the sale price in espresso, with a struck-through "Was: €X" line and the percentage off (for example "24% off"). Sold: the photo is washed out with white, the price is muted and struck through, and there is no heart. Under the price, the buyer price with the protection shield ("€20,55 incl."). Sale emphasis is espresso, never red. Green appears only for Sold. Press feedback is a 0.98 scale.

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

### D-007 : ItemCard is Option C, Badge forward (superseded in part by D-019)

- **Date:** 2026-10-12
- **Area:** Components, Item card
- **Status:** Approved
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
- **Status:** Approved
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
- **Implementation:** `direction: "ltr"` on the tab bar style in `apps/mobile/app/(app)/(tabs)/_layout.tsx`.
- **References:** D-011, CLAUDE.md Right to left

### D-017 : The tab bar stays on every page opened from a tab

- **Date:** 2026-10-13
- **Area:** Navigation
- **Status:** Approved (Eden, 2026-10-13)
- **Decision:** The bottom tab bar stays visible on the item page, a member's profile, Search, Favourites, Saved searches, Settings and Edit profile. Each tab (Home, Browse, Inbox, Profile) has its own stack, so a page opened from a tab pushes inside that tab and the tab keeps its own history. Tapping the active tab again goes back to its first screen. The pages with no tab bar are the task pages: the sell form (D-015), the Filter panel and its sub-pages (D-014), the conversation screen, and the Face ID offer.
- **Rationale:** Opening an item from Browse and finding yourself in no tab at all felt lost. With a stack per tab you always know where you are, and Back returns to the same scroll position in the same tab.
- **Implementation:** `apps/mobile/app/(app)/(tabs)/` holds one group per tab (`(home)`, `(browse)`, `(inbox)`, `(profile)`), each with a stack layout (`components/navigation/tab-stack.tsx`). Pages shared by every tab live once in `(home,browse,inbox,profile)/` (listing, user, search, favourites, saved-searches). Settings and Edit profile live in `(profile)/`. To link to an item or a person from any screen use `router.push({ pathname: "/listing/[id]", params: { id } })` and `{ pathname: "/user/[id]", params: { id } }`. The current tab is kept. To open one in a specific tab use the group in the path, for example `/(profile)/listing/123`. A cold link (notification tap, deep link) has no current tab and opens in the first group alphabetically (Browse). Inside the tab stacks the bottom safe area is zero because the tab bar already clears the home indicator.
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
- **Status:** Approved (Eden, 2026-10-13). Phase A (wording pass) built on branch milestone-6. Visual parts (item card, tab bar, Home, Browse, reviews, badges look, condition slider, price pill) not built yet
- **Decision:** Keep Vinted's structure and flows, change what reads as Vinted. The voice is "Friends' closets" (people first, warm and local). The item card becomes a price tag card (price first, then brand, size and condition in small capitals, then the buyer price pill). Buyers see the seller price plus a soft pill with the buyer price, never the shield and "incl." line, and the protection gets its own name. Home opens with a large greeting and a small round search button beside it, then mood chips (For you, New today, Under ₪50, Your sizes, Near you) and the grid. Browse uses photo tiles by item type. Users are "sellers" in search. The item page has one Buy button, "make your price" as a link and Message on the seller row. Condition is a slider with five stops: Unworn with tags, Unworn, Like new, Worn, Well loved. Reviews are one list plus a line for automatic ones. Seller badges are our own outline stamps. The tab bar is a floating rounded bar, icons only (each tab keeps a hidden name for screen readers), with a raised round Sell button with a camera. Holiday mode is "Away mode", Personalisation is "My sizes". Order progress is a tracker card at the top of the chat: a line of step icons with dates, plus Track parcel and I got it buttons. Every user-facing sentence copied from Vinted is rewritten.
- **Rationale:** Legal and App Store risk. Nobody owns how an app works, but the look, names and wording must be ours. Research and the rule are in `docs/originality.md`.
- **Implementation:** Phase A, wording (2026-10-13): every banned word is gone from both locale files, the server push text and the seed, with a test that keeps them out (`apps/mobile/tests/no-banned-words.test.ts`). Done in phase A: sellers instead of members, Buzz (names only, the feature is not built), the sell form words, condition names, Settings and Alerts names, Away mode with a moon and return date, My sizes under Shopping preferences, the "incl." line removed. The protection name is a placeholder in one key (`protectionName`, English "Covered"), rename it there. Choices, open questions and the checklist in `docs/originality.md`, options in `docs/mockups/originality-choices.html` and `originality-round-2.html`. Changes parts of D-007 (item card), D-008 (Bumped badge) and D-009 (tab labels, Browse grid). The paid boost is "Buzz" for now (button "Give it buzz", badge "Buzzing"). Still open: the protection name (wait for the app name), the voice guide.
- **Implementation, card and item page (branch m6-card):** the buyer price pill (`components/price-pill.tsx`, check icon, "{price} with {protectionName}") replaces the shield and the "incl." line on cards, the sell form price preview, the offer sheet, the checkout line and the order note. The item card is the price tag card (big seller price with the heart at the end of that row, brand, size and condition in small capitals, pill, badges on the photo, "Buzzing" with a zap icon; the favourite count and the two line description left the card). The item page shows a breakdown card (Item, protection, You pay, how you are covered) and one "Buy for X" button with "Or make your price" as a link and a "Message" chip on the seller row. The sell form condition is a five stop slider (`components/sell/condition-slider.tsx`, drag, tap or VoiceOver adjustable, runs right to left in Hebrew). Seller badges are outline stamps (`components/seller-stamp.tsx`, no rings). The Bumped badge of D-008 is superseded in part by Buzzing.
- **References:** `docs/originality.md`, `docs/mockups/originality-choices.html`

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

| ID | Proposal | Decision needed |
|---|---|---|
| O-003 | Closed on 2026-10-12. Hebrew font is Heebo paired with Aileron (D-011). Currency is ILS (₪), shown as ₪45 in whole shekels with a comma for thousands and a dot for decimals. | None |

## Superseded decisions
