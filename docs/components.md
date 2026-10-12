# Component inventory

What we build, mapped from the Vinted UX spec's app screens (`/Users/edenbachar/Desktop/Homarim/VINTED/vinted-ux-spec.html`) to the components of our own app. Look and feel come from `docs/design.md`. A live version of every component, in the Espresso and cream tokens, is in `docs/mockups/component-sheet.html`.

How to read it:
- One component with variants, never five similar ones.
- **Source** says where it comes from. "Reusables: X" is off the shelf from React Native Reusables, then restyled to Kept's look. "Gorhom Bottom Sheet" is the sheet library (D-004). "Custom" is built by us from primitives. "Expo/RN built-in" is already in the platform.
- **First flows** components are needed for browse feed, item page, sell form and inbox. **Later** ones wait.
- Every colour, radius and space comes from tokens, never raw values.

Totals: Foundation 7, Core 23, Marketplace patterns 30, 60 components.

## Foundation

Tokens, typography, icons and layout primitives. Everything else is built from these.

### Tokens

The single place every colour, radius, spacing step and text style is named. Nothing else holds raw values.

- **Variants and states:** Colour (23 roles), radius (12 / 20 / 32 / full), spacing (4 to 40), type styles. Light only for now.
- **Screens:** Every screen
- **Source:** Custom (Theme file read by NativeWind: colour, radius, spacing, type styles)
- **Phase:** First flows

### Text

The one text component. Every piece of copy in the app uses a named style from the type scale.

- **Variants and states:** Styles: display (light plus heavy emphasis), title, subtitle, itemName, heading, sectionLabel, smallLabel, cardTitle, cardSubtitle, body, bodySmall. Colour steps: primary, secondary, muted, faint, accent, error.
- **Screens:** Every screen
- **Source:** Reusables: Text
- **Phase:** First flows

### Icon

A thin outline icon from one set (Lucide) that always takes the colour of its surroundings.

- **Variants and states:** Sizes: 13, 16, 20 (default), 24. Stroke 1.75. Filled only for the saved heart and star ratings.
- **Screens:** Every screen
- **Source:** Reusables: Icon (Lucide icons, drawn with the current text colour, never emoji)
- **Phase:** First flows

### Screen

The page container. It handles the safe area, 16px side padding and clearance above the tab bar.

- **Variants and states:** With tab bar clearance, without tab bar (task pages), fixed header, scrolling or static body.
- **Screens:** Every screen
- **Source:** Custom (Wraps Expo safe area. One scroll owner per screen)
- **Phase:** First flows

### Separator

A thin line, or a wider pale band, that splits a page into sections.

- **Variants and states:** Hairline, band (24px pale gap between groups), inset (starts after the avatar).
- **Screens:** Item page, Settings, Profile menu, Balance, Inbox, Conversation thread
- **Source:** Reusables: Separator
- **Phase:** First flows

### Photo

Shows a listing or profile picture cropped to fit, with initials or a placeholder when the picture fails to load.

- **Variants and states:** Ratios: 3:4 (cards), square (thumbnails), full width. States: loading (skeleton), loaded, failed (initials).
- **Screens:** Home feed, Search and results, Item page, Sell form, Inbox, My orders, Own profile
- **Source:** Custom (Wraps Expo Image. Never tinted)
- **Phase:** First flows

### Pressable

Wraps anything tappable so it gives the same press feedback everywhere.

- **Variants and states:** Press styles: scale (cards), surface (rows), opacity (text links). 150ms.
- **Screens:** Every screen
- **Source:** Expo/RN built-in (React Native Pressable plus a small press animation)
- **Phase:** First flows

## Core

The small reusable controls: buttons, inputs, chips, badges, avatars, rows, windows.

### Button

The main way to act. One component, four looks.

- **Variants and states:** Variants: primary, outline, ghost, destructive. Sizes: large 48, medium 40, small 32, full width. States: default, pressed, disabled, loading (spinner plus label). Optional leading icon.
- **Screens:** Item page, Sell form, Conversation thread, Own profile, Seller profile, Settings, Filter page
- **Source:** Reusables: Button
- **Phase:** First flows

### IconButton

A round or square button that holds only an icon, such as back, close or more.

- **Variants and states:** Variants: plain, floating (glass chip over a photo), circle action (60px with a label underneath). Sizes 32, 40, 60. States: default, pressed, disabled.
- **Screens:** Item page, Conversation thread, Balance, Sell form, Search and results
- **Source:** Custom (Composed from Pressable and Icon)
- **Phase:** First flows

### TextField

A labelled box to type into, one line or several.

- **Variants and states:** Variants: single line, multiline, with prefix (currency), with trailing icon. States: default, focused, filled, error with message, disabled. Text 16px.
- **Screens:** Sell form, Filter page (price), Search and results, Conversation thread, Settings
- **Source:** Reusables: Input (Reusables Input plus Label, with helper and error text added. Multiline uses Reusables Textarea)
- **Phase:** First flows

### Checkbox

A square tick box for yes or no choices, and for picking several options from a list.

- **Variants and states:** States: off, on, disabled. With label row.
- **Screens:** Filter page (size, brand, condition), Sell form
- **Source:** Reusables: Checkbox
- **Phase:** First flows

### Radio

A round dot for picking exactly one option from a list.

- **Variants and states:** States: off, on, disabled. With label row.
- **Screens:** Category picker (leaf rows), Filter page (sort), Sell form (parcel size)
- **Source:** Reusables: Radio Group
- **Phase:** First flows

### Switch

A sliding on and off toggle for settings.

- **Variants and states:** States: off, on, disabled. With label row.
- **Screens:** Settings, Own profile (bundle discounts)
- **Source:** Reusables: Switch
- **Phase:** First flows

### Chip

A small fully rounded pill used to filter and to switch views.

- **Variants and states:** Variants: outline (idle), filled (selected), with count, with dropdown arrow, with leading icon (Filter), removable. States: default, pressed, disabled.
- **Screens:** Home feed, Search and results, Catalog and filters, My orders, Own profile, Seller profile
- **Source:** Custom (Composed from Pressable and Text. Single-choice sets can sit on Reusables Toggle Group)
- **Phase:** First flows

### Badge

A tiny uppercase label that tells you a status or a quality.

- **Variants and states:** Variants: new (tint), sold (success), reserved (warning), removed (error), outline, seller badge with icon. Text 10px tracked.
- **Screens:** Item page, Seller profile, Own profile, Home feed, My orders
- **Source:** Reusables: Badge
- **Phase:** First flows

### Avatar

A round picture of a person, or their initial when there is no picture.

- **Variants and states:** Sizes: 24, 40, 52, 72. Variants: photo, initial, silhouette (no photo), with verified tick. Overlapping stack.
- **Screens:** Item page, Seller profile, Inbox, Conversation thread, Own profile, Profile menu
- **Source:** Reusables: Avatar
- **Phase:** First flows

### Tabs

Switches between views on one screen with a line under the active one.

- **Variants and states:** Variants: underline (equal widths, 2px accent line). 2 to 3 tabs. States: active, idle, pressed. Optional count.
- **Screens:** Inbox, Seller profile, Own profile, My orders, Search and results
- **Source:** Reusables: Tabs
- **Phase:** First flows

### ListRow

A full-width tappable line with an icon, a label, an optional value and a chevron.

- **Variants and states:** Variants: navigation (chevron), with value, with leading icon, with switch, destructive. States: default, pressed, disabled. 54 to 62px tall.
- **Screens:** Settings, Profile menu, Catalog and filters, Balance, Category picker, Search and results
- **Source:** Custom (Composed from Pressable, Icon and Text)
- **Phase:** First flows

### SectionHeader

A small uppercase label that titles a group of content, with an optional action on the right.

- **Variants and states:** Variants: label only, with action link, with count.
- **Screens:** Home feed, Settings, Balance, Sell form, Own profile
- **Source:** Custom (Composed from Text)
- **Phase:** First flows

### TopBar

The bar at the top of a task page with a back arrow, a centred title and an optional action.

- **Variants and states:** Variants: back plus title, close plus title, title only (tab pages), with right action (text or icon), over photo (transparent).
- **Screens:** Item page, Conversation thread, Sell form, Settings, Favourites, Catalog and filters, My orders, Balance
- **Source:** Custom (Composed from IconButton and Text. Sits inside Screen)
- **Phase:** First flows

### TextLink

Inline tappable text such as Learn more or How you are covered.

- **Variants and states:** Variants: accent underline, plain, with trailing icon. States: default, pressed.
- **Screens:** Item page, Conversation thread, Sell form, Own profile, Catalog and filters
- **Source:** Custom (Composed from Pressable and Text)
- **Phase:** First flows

### StarRating

Five stars that show an average or one review score.

- **Variants and states:** Sizes: 12, 16, 32. Variants: display (part-filled last star), with count, large score. Gold is not in our palette, so stars use the accent colour.
- **Screens:** Item page, Seller profile, Own profile, Conversation thread
- **Source:** Custom (Composed from Icon)
- **Phase:** First flows

### ExpandableText

A paragraph cut after a few lines with a more link that opens the rest.

- **Variants and states:** States: collapsed (3 lines), expanded.
- **Screens:** Item page
- **Source:** Custom (Composed from Text and TextLink)
- **Phase:** First flows

### Dialog

A centred window for a quick yes or no decision.

- **Variants and states:** Variants: confirm (two actions), destructive confirm, info (one action). Backdrop dim. 20px radius.
- **Screens:** Sell form (save changes before closing), Item page
- **Source:** Reusables: Alert Dialog
- **Phase:** First flows

### BottomSheet

A window that slides up from the bottom over a dimmed page. The base for filters, pickers, offers and price breakdown.

- **Variants and states:** Heights: content-sized, 88% tall. Header: title, optional back arrow, close. States: closed, open, dragging. 20px top corners, 300ms ease-out.
- **Screens:** Catalog and filters, Category picker, Item page, Sell form
- **Source:** Gorhom Bottom Sheet (Gorhom Bottom Sheet with our header, fill and backdrop)
- **Phase:** First flows

### ActionMenu

A small menu that opens from a more button, such as share or report.

- **Variants and states:** Item types: default, destructive, with icon. States: closed, open, pressed row.
- **Screens:** Item page, Seller profile, Own profile, Conversation thread
- **Source:** Reusables: Dropdown Menu
- **Phase:** First flows

### Collapsible

A header that opens and closes a section of content with a smooth height change.

- **Variants and states:** States: closed, open (rotating arrow). Content mounts on first open.
- **Screens:** Help (later), Sell form advanced details
- **Source:** Reusables: Collapsible
- **Phase:** Later

### Skeleton

A soft grey placeholder shape shown while content loads, instead of a blank screen.

- **Variants and states:** Shapes: block, line, circle. Presets: card, row. Soft pulse, 700 to 1200ms.
- **Screens:** Home feed, Search and results, Item page, Inbox
- **Source:** Reusables: Skeleton
- **Phase:** First flows

### Spinner

A small turning ring for short waits.

- **Variants and states:** Sizes: 16, 20, 32. Colours: accent, on-accent (inside primary buttons). Holds at least one full cycle.
- **Screens:** Home feed (infinite scroll), Search and results, Button loading
- **Source:** Expo/RN built-in (React Native ActivityIndicator)
- **Phase:** First flows

### Progress

A thin bar that shows how far along something is.

- **Variants and states:** Determinate 0 to 100. Thin 4px.
- **Screens:** Profile menu (badges earned), Sell form (upload)
- **Source:** Reusables: Progress
- **Phase:** Later

## Marketplace patterns

The pieces that make this a second-hand marketplace. Built from Foundation and Core.

### ItemCard

The tile for one listing: tall photo, brand, size and condition, and the price the buyer really pays.

- **Variants and states:** Variants: browse (default), sold (green band), favourited (filled heart), promoted (Bumped label), own listing (price, views, favourites, Bump), loading (skeleton). States: default, pressed (scale 0.98).
- **Screens:** Home feed, Search and results, Seller profile, Favourites, Own profile
- **Source:** Custom (Composed from Photo, HeartPill, Badge, Text and PriceBlock)
- **Phase:** First flows

### HeartPill

A small white pill with a heart and the number of people who saved the item.

- **Variants and states:** States: not saved (outline), saved (filled, red), pressed. With or without count. On photo or inline.
- **Screens:** Home feed, Search and results, Item page, Seller profile, Favourites
- **Source:** Custom (Composed from Pressable, Icon and Text)
- **Phase:** First flows

### PriceBlock

Shows the seller price and what the buyer pays, with the buyer protection shield, so fees are never a surprise.

- **Variants and states:** Sizes: card (small), item page (large), sticky bar. Variants: with protection line, seller price only (own listing), strikethrough old price (offer). Protection line opens the price breakdown.
- **Screens:** Home feed, Item page, Conversation thread, My orders, Search and results
- **Source:** Custom (Composed from Text and Icon)
- **Phase:** First flows

### SearchBar

The big rounded search box at the top of Home and Browse, with a camera for photo search.

- **Variants and states:** States: idle (tap opens search), focused, filled with clear, busy (Searching...). Camera icon on the right. 32px radius.
- **Screens:** Home feed, Browse, Search and results
- **Source:** Custom (Composed from TextField styling, Icon and Pressable)
- **Phase:** First flows

### FilterBar

The scrolling row of filter chips above search results, with Filter first and a result count underneath.

- **Variants and states:** Variants: with Filter button, category chips (Home), status chips. Count row: 500+ results.
- **Screens:** Home feed, Search and results, My orders, Own profile
- **Source:** Custom (A horizontal row of Chips with the results count)
- **Phase:** First flows

### CategoryTile

A picture tile on Browse that opens one category.

- **Variants and states:** Variants: icon tile, photo tile. States: default, pressed. 2 or 3 per row.
- **Screens:** Browse
- **Source:** Custom (Composed from Pressable, Icon and Text)
- **Phase:** First flows

### ItemGrid

The two-column feed of item cards with infinite scroll and a loading spinner at the end.

- **Variants and states:** Columns: 2 on phone, 3 on tablet. Footer: spinner, end of list. Empty and loading states.
- **Screens:** Home feed, Search and results, Seller profile, Favourites, Own profile
- **Source:** Custom (Wraps FlatList with two columns)
- **Phase:** First flows

### BottomTabBar

The five tabs at the bottom: Home, Browse, Sell, Inbox, Profile.

- **Variants and states:** States per tab: idle (outline icon, muted label), active (accent icon and label), pressed. Inbox unread count pill. Hidden on task pages. Sits above the home indicator.
- **Screens:** Home feed, Browse, Search and results, Inbox, Profile menu, Favourites, My orders
- **Source:** Custom (Built on the Expo Router tab bar)
- **Phase:** First flows

### StickyActionBar

A bar fixed to the bottom of the item page with the price and the buy actions.

- **Variants and states:** Variants: buyer (Make an offer plus Buy now), your own item (Edit plus Mark as sold), sold (disabled with note), with protection link. Sits above the home indicator.
- **Screens:** Item page, Sell form (Upload), Catalog and filters (Show results)
- **Source:** Custom (Composed from Button and PriceBlock)
- **Phase:** First flows

### Banner

A rounded message strip that informs, warns or promotes.

- **Variants and states:** Tones: info, warning, promo, safety card (shield and link), notice strip (pinned above the tab bar). Dismissible cross. Optional action.
- **Screens:** Home feed, Conversation thread, Settings, Own profile, Item page
- **Source:** Custom (Composed from Reusables Alert styling, Icon and Button)
- **Phase:** First flows

### EmptyState

What a screen shows when there is nothing to show, and why.

- **Variants and states:** Reasons: no items yet, no results, no permission, error with retry, offline. Icon, title, one line of help, optional button.
- **Screens:** My orders, Inbox, Favourites, Search and results, Own profile
- **Source:** Custom (Composed from Icon, Text and Button)
- **Phase:** First flows

### PhotoCarousel

The big swipeable photo at the top of the item page with page dots.

- **Variants and states:** Overlays: back and more buttons, heart pill, dots. States: loading, 1 photo (no dots), many photos. Sold overlay.
- **Screens:** Item page
- **Source:** Custom (Composed from Photo with a paging scroll view. Reusables has no carousel)
- **Phase:** First flows

### SellerRow

Who is selling: avatar, name, stars and a button to ask them a question.

- **Variants and states:** Variants: item page (with Ask seller), compact (thread header), with seller badge. States: pressed.
- **Screens:** Item page, Conversation thread
- **Source:** Custom (Composed from Avatar, StarRating, Badge and Button)
- **Phase:** First flows

### ProfileHeader

The top of a member's profile with identity, trust details and the follow button.

- **Variants and states:** Variants: other member (Follow), own profile (Edit). States: following, not following. Verified rows, location, last seen.
- **Screens:** Seller profile, Own profile
- **Source:** Custom (Composed from Avatar, StarRating, Badge, ListRow and Button)
- **Phase:** First flows

### ReviewSummary

The big average score with stars and a count, and a split of reviews by source.

- **Variants and states:** Variants: with member and automatic split, member only. Empty (no reviews yet).
- **Screens:** Seller profile, Own profile
- **Source:** Custom (Composed from StarRating and ListRow)
- **Phase:** First flows

### ReviewRow

One review: who wrote it, when, the stars and the text.

- **Variants and states:** Variants: member review, automatic review, with seller Reply. Translate link (later).
- **Screens:** Seller profile, Own profile
- **Source:** Custom (Composed from Avatar, StarRating and Button)
- **Phase:** First flows

### ConversationRow

One line of the inbox: who, a preview, the time and a small thumbnail of the item.

- **Variants and states:** Variants: message, notification (thumbnail and up to 4 lines), system message (app avatar). States: read, unread (bold plus dot), pressed.
- **Screens:** Inbox, Notifications
- **Source:** Custom (Composed from Avatar, Photo and Text)
- **Phase:** First flows

### ItemStrip

A thin row with an item thumbnail, its title and price, used to pin the item in a chat and to list orders.

- **Variants and states:** Variants: thread (pinned top), order row (status line, chevron, check badge when complete). States: pressed.
- **Screens:** Conversation thread, My orders
- **Source:** Custom (Composed from Photo and PriceBlock)
- **Phase:** First flows

### MessageBubble

One chat message.

- **Variants and states:** Variants: theirs (white, thin border, left), yours (filled, right), intro card, photo message. States: sending, sent, failed.
- **Screens:** Conversation thread
- **Source:** Custom (Composed from Text)
- **Phase:** First flows

### OfferBubble

A chat bubble that shows an offer: the new price, the old price struck through, and its status.

- **Variants and states:** Statuses: sent, accepted, declined, countered, expired. Buyer view: waiting. Seller view: Accept and Decline buttons.
- **Screens:** Conversation thread
- **Source:** Custom (Composed from MessageBubble, PriceBlock and Badge)
- **Phase:** First flows

### OrderTimeline

The story of an order as dated dividers: Sold, Order shipped, Delivered, then Sale complete with next steps.

- **Variants and states:** Steps: sold, shipped, delivered, complete. Variants: divider (in thread), full tracker (order page). States: done, current, upcoming.
- **Screens:** Conversation thread, My orders
- **Source:** Custom (Composed from Text and Separator, shown inside the chat)
- **Phase:** First flows

### MessageComposer

The box at the bottom of a chat where you type, attach a photo and send.

- **Variants and states:** States: empty (send greyed), typing (send active), with photo, disabled (order closed). Sits above the keyboard.
- **Screens:** Conversation thread
- **Source:** Custom (Composed from TextField styling and IconButton)
- **Phase:** First flows

### FilterSheet

The page of filters: sort, category, size, brand, condition, colour and price, with one Show results button.

- **Variants and states:** Header: Close, Filter, Clear all. Rows show the current value. Sub-pages: price range, size list, brand list with search. Button shows live count.
- **Screens:** Search and results, Catalog and filters
- **Source:** Gorhom Bottom Sheet (Gorhom Bottom Sheet (88%) holding ListRows, price fields and a sticky button)
- **Phase:** First flows

### OptionListSheet

A sheet with a flat list of options to pick from, such as size, brand, condition, colour or parcel size.

- **Variants and states:** Selection: single (radio), multiple (checkbox). Optional search field. Sticky Show results or Done button.
- **Screens:** Sell form, Catalog and filters
- **Source:** Gorhom Bottom Sheet (Gorhom Bottom Sheet with a Checkbox or Radio list and optional search)
- **Phase:** First flows

### CategoryPicker

A sheet where you drill down through categories until you pick one leaf, with a search shortcut.

- **Variants and states:** Levels: top (Women, Men, Kids...), branch (chevron), leaf (radio). Header with back arrow and the current level name. Find a category search.
- **Screens:** Category picker, Sell form, Catalog and filters
- **Source:** Gorhom Bottom Sheet (Gorhom Bottom Sheet with a drill-down list of ListRows and Radios)
- **Phase:** First flows

### PhotoUploader

The row of photo tiles on the sell form where you add, remove and order your pictures.

- **Variants and states:** States: empty (large dashed box), adding (dashed plus tile), with photos (Main label on the first), uploading (progress), error. Up to 20 photos.
- **Screens:** Sell form
- **Source:** Custom (Composed from Photo, IconButton and Expo Image Picker)
- **Phase:** First flows

### PickerRow

An outlined form row that opens a sheet. A plus means empty, a pencil means filled.

- **Variants and states:** States: empty (plus), filled (value and pencil), error, disabled (until category is chosen).
- **Screens:** Sell form
- **Source:** Custom (Composed from ListRow with an outline)
- **Phase:** First flows

### PriceBreakdown

The sheet that explains what you pay: item price, buyer protection fee, postage and total.

- **Variants and states:** Variants: buyer view, seller view (what you earn). With info line about protection.
- **Screens:** Item page
- **Source:** Custom (Content for BottomSheet)
- **Phase:** First flows

### OfferSheet

The sheet to make an offer: type a price, see what the buyer would pay, and send.

- **Variants and states:** States: empty, valid, too low (error), sending. Suggested offers as chips.
- **Screens:** Item page
- **Source:** Gorhom Bottom Sheet (Gorhom Bottom Sheet with a TextField, suggested prices and Button)
- **Phase:** First flows

### BalanceHeader

The top of the balance screen: pending amount, a large available amount and circle actions.

- **Variants and states:** States: zero balance (Withdraw greyed), with balance, pending hold. Actions: Withdraw, Shop.
- **Screens:** Balance
- **Source:** Custom (Composed from Text, IconButton and ListRow)
- **Phase:** Later

## Not needed yet

Things Vinted has that we are deliberately leaving out for now.

- **Ad slots.** The native ad strip pinned above the tab bar in Inbox and Notifications, the right-hand ad rail on web catalog pages, and in-feed ads. Noise we do not want.
- **Paid promotion (Bump, Boost your visibility, Bumped label).** Paying to push a listing. The promoted card variant stays in ItemCard as a hook but is not built until there is a payment flow.
- **Invite a friend promo card and badges earned card.** Referral and gamification. Banner already covers the look if we want them later.
- **Photo search flow.** The camera icon is in SearchBar, but the camera and results flow was never captured. The icon stays hidden until we build it.
- **Translate conversation and Tap to translate links.** Needs a translation service. TextLink covers the look later.
- **Bundle discounts and Create bundle strip.** Needs bundle pricing rules. Banner covers it later.
- **Personalisation and Promotional tools pages.** Not captured in the spec.
- **Withdraw to bank, Payments and Postage settings screens.** Need a payment provider. BalanceHeader is listed as Later for the same reason.
- **Toast or snackbar.** Not seen in the spec. Reusables has none, so add a Custom one when the first save or copy confirmation needs it.
- **Slider, Calendar, Table, Pagination.** Not used by any captured screen. The feed uses infinite scroll.
- **Dark mode theme.** Deferred (D-002).

## Build order

1. **Foundation first.** Tokens (Espresso and cream, D-006), Aileron loading, Text, Icon, Screen, Separator, Pressable, Photo. Install and restyle the Reusables Text, Icon and Separator. Nothing else starts until these read from tokens only.
2. **Core controls.** Button, IconButton, TextField, Chip, Badge, Avatar, Tabs, ListRow, SectionHeader, TextLink, StarRating, Skeleton, Spinner. Then Checkbox, Radio, Switch, TopBar, ExpandableText, ActionMenu, Dialog. Add Gorhom Bottom Sheet and build BottomSheet.
3. **Browse feed (Home).** BottomTabBar, SearchBar, FilterBar, HeartPill, PriceBlock, ItemCard, ItemGrid, Banner (notice strip), EmptyState.
4. **Item page.** PhotoCarousel, SellerRow, Banner (safety card), PriceBreakdown, StickyActionBar, OfferSheet.
5. **Sell form.** PhotoUploader, PickerRow, OptionListSheet, CategoryPicker, then Dialog for save changes.
6. **Inbox and chat.** ConversationRow, ItemStrip, MessageBubble, MessageComposer, OfferBubble, OrderTimeline.
7. **Search and filters.** FilterSheet and the results states.
8. **Profiles and orders.** ProfileHeader, ReviewSummary, ReviewRow, then My orders on ItemStrip.
9. **Later.** BalanceHeader, Collapsible, Progress.

Decision for Eden when we reach StarRating: Vinted uses gold stars, and gold is not in our palette. Default is the accent brown. Gold would be a new token.
