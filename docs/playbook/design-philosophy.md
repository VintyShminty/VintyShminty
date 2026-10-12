# Design Philosophy

What Kept's design language taught us. Product: VintyShminty (working name), a phone app. Decision (Eden, 2026-10-11): **take all of Kept's design as inspiration except the colour palette.** Method rules and Kept's look (type, spacing, shapes, chrome, motion, voice) carry over. Colours are decided fresh for this product. The concrete values live in `docs/design.md`. Rules below were written for desktop web. Phone-app adaptations are noted inline and in D-005.

## Method rules (carry over)

### Principles
- Make the user's next useful action visible before supporting tools or detail.
- Preserve working journeys before changing layout. A redesign must never remove a save, recovery or return path.
- Empty, loading, error, recovery, large text and one-handed reach are normal design states, designed up front, not patched at the end.
- Clarity over decoration: content-critical surfaces (forms, reading panes, checkout) are solid and readable; translucency is for chrome only.
- An empty screen must say *why* it is empty (no items vs no permission vs error).
- Never seed a real screen with fake data. Use an honest empty state.

### Tokens, not screens
- All colour, spacing, radius, shadow and type go through named tokens defined in one place. Change the token, not 1,200 call sites.
- Define tokens at the root of the app (the theme provider) so sheets and out-of-shell screens resolve them too.
- A token sweep by name misses hand-typed literals: grep for the raw value as well.
- Pair each substitution against the original value at each site, never by pattern.
- Add a test that caps hard-coded colours so the count can only fall.

### Light and dark are both first-class (PAUSED: light mode only for now, D-002)

These rules are kept for when dark mode returns.

- Design and check every new window in both themes before calling it done.
- Light mode is not an automatic inversion. Kept's light alphas were solved per rung to match the dark theme's measured contrast (dark-on-light reads weaker than light-on-dark).
- Name surfaces that deliberately ignore the theme (text over photos stays white; a photo is neither light nor dark).
- Inline `style` props are invisible to stylesheet audits. In the native app, keep colour in tokens (NativeWind classes), never hand-typed in style props.
- Icons that must follow the theme are drawn with `currentColor`. Emoji can never take a palette.

### Layering and overlays
- Any overlay, menu or sheet inside an animated or clipped parent: render it at the app root (Gorhom Bottom Sheet's provider does this) and position from the trigger. The web "portal to document.body" rule is n/a in the native app.
- Every nested sheet or modal sits above its parent.
- One scroll owner per surface. Never two nested scrollers fighting.

### Motion
- Frequent one-click gestures stay under ~200ms total. Rare, high-ceremony moments can take longer.
- Animating between two windows of different sizes holding real text: animate real width/height, hide content mid-resize, fade it in after (container transform). A `scale()` morph stretches text.
- Cursor-following motion: n/a on phones. For any finger-following motion, use wall-clock easing (`1 - exp(-dt/tau)`), never a per-frame fraction.
- Close easing is the mathematical reverse of open easing.
- A spinner that can finish faster than one cycle looks broken: minimum hold 700-1200ms.
- An element faded to `opacity: 0` still runs its animations. Unmount it.
- Never animate layout properties (padding, margin, width) on grid containers; use transforms. The CSS grid height trick is n/a in the native app. Use the native layout animation.

### Mobile
- Mobile is not "desktop but narrower". For a structurally complex component, build a mobile sibling component rather than piling overrides on the desktop one.
- iOS web zoom on small inputs: n/a in the native app. Still set a shared control size, inputs at 16px.
- Reserve space for the bottom tab bar and safe area inside the real scroller, per screen.
- `overscroll-behavior: contain`: n/a in the native app. Nested scrollers are avoided instead.
- There is no hover on phones. Hover states become press feedback.

### Performance is design
- Paint cached content instantly, refresh in the background (stale-while-revalidate). Never blank a screen while reloading.
- Defer analytics and non-critical scripts until after first load on public pages.
- Optimize images yourself (resize and compress at upload or in the image pipeline). WebP via build tools is n/a in the native app.

### Words in the UI
- No em dashes or en dashes in anything a user reads. Use a comma, period, colon or "and/but/so".
- No semicolons in user-facing messages or AI-generated text.
- Headings and short labels carry no full stop.
- Proper capitalisation always, even in a casual tone.
- Warm, direct, human. No corporate filler ("I hope this finds you well", "synergies", "circle back").
- Don't rename load-bearing labels in a visual pass. Users recognize controls by their words.
- AI-generated text gets the same rules, enforced twice: in the prompt and in a cleanup pass on the output.

### Process
- Two or more meaningful layout options → static mockup first, real tokens, real width, light mode only for now (both themes once dark returns). Approve, then build.
- Build mockups from the app's actual CSS or a real screenshot, never from memory.
- From a design handoff, read the source values. Screenshots lie about font weight, ratios and gradients.
- Tune visual changes against a screenshot at normal viewing size; a source-level opacity change can be invisible.
- Record every approved decision in `docs/design.md` (format below). Proposals stay in "Open decisions" until explicitly approved. Superseded decisions are kept with the date and why.
- If a window fails because of contrast, portal ancestry, z-index or scroll, update `docs/design.md` in the same change that fixes it.

## Kept's look (carry over, except colour)

Adopted from Kept:
- Quiet, editorial, restrained. Content leads; chrome stays out of the way.
- Contrast of weight as the signature: very light display type (200-300, large headings only, never small text) against heavy names and emphasis (700-800); small uppercase section labels with wide tracking.
- Hairline borders, soft blur on floating chrome, no heavy drop shadows. Depth comes from borders, a slightly brighter top edge and surface shifts, not shadows.
- Near-opaque, readable windows; light dim behind them, never a heavy blackout.
- Pills for filters and statuses, rounded but not bubbly; thin borders.
- Instant navigation between pages; small entrance animations inside a page.
- Banned: heavy card shadows, thick rounded borders, dense data tables, hamburger menus, corporate/sales jargon in the UI.

**Not carried over:** Kept's palette (monochrome white-on-near-black, no accent hue). This product picks its own colours in `docs/design.md`. The colour *method* above still applies: tokens only, contrast measured. Light mode only for now (D-002). Since a second-hand marketplace is photo-led, choose a palette that frames listing photos rather than competing with them.

## Decision log format (`docs/design.md`)

```markdown
### D-### : Short decision name

- **Date:** YYYY-MM-DD
- **Area:** Navigation, Home, Listing, Checkout, Messaging, accessibility, workflow...
- **Status:** Approved, Implemented, or Superseded
- **Decision:** What is now true
- **Rationale:** Why it was chosen
- **Implementation:** Where it lives or what remains
- **References:** Mockup, test, handoff link
```
