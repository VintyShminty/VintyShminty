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
