# Glossary

Plain-words meanings. Added by the `compile-memory` skill.

- **Monorepo.** One folder holding the app, the server and the database code together.
- **Milestone.** A stage of the roadmap that ends with something Eden can use on his phone. See `docs/roadmap.md`.
- **Branch.** A separate line of work that does not affect the main version until it is merged.
- **Pull request (PR).** A request to merge a branch into another, where checks run and Eden reviews.
- **Worktree.** A second folder on the Mac holding another branch, so two agents never step on each other.
- **CI.** The automatic checks GitHub runs on every upload: types, style, tests.
- **Migration.** A saved step that changes the database structure, so every machine ends up the same.
- **Seed.** Starting data loaded into a development database. Reference seed is real (categories, brands). Sample seed is fake.
- **Server.** The program online that holds the rules and talks to the database. The app asks it for everything.
- **Zod schema.** A written description of what valid data looks like, checked by both app and server.
- **State machine.** The fixed list of steps an order or offer can go through and the moves allowed between them.
- **RTL.** Right to left layout for Hebrew. The whole screen mirrors.
- **Token.** A named design value (a colour, a gap, a text size) so it is changed in one place.
- **Simulated checkout.** In version 1 Pay always succeeds and no money moves.
- **Minor units.** Money as whole agorot (cents), stored as an integer to avoid rounding errors.
- **Better Auth.** The sign in library used from Milestone 1.
- **Cloudflare R2.** Online storage for photos, planned for when the app goes online.
- **Expo.** The tool that builds the phone app and lets Eden preview it.
- **Development build.** A version of the app built for the Mac and simulator that can do Face ID and real right to left, unlike Expo Go.
- **Expo Go.** The quick preview app. Good for fast looks, but no Face ID and no forced right to left.
- **Supply chain.** The outside libraries the app is built from. We only install versions at least 7 days old and scan for known vulnerabilities.
- **Trailing and leading edge.** The end and start of a line. Right and left in English, left and right in Hebrew.
- **Push panel.** A full-screen page that slides in from the trailing edge and shoves the current screen aside. Used for categories and filters.
- **Product spec.** The Vinted UX deconstruction. Where we have not decided something ourselves, we follow it for how things work, never for names, wording or looks (`docs/originality.md`).
