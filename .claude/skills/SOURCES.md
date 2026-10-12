# Skill sources

Downloaded on 2026-10-12 with a shallow git clone, read in full, then cleaned. No script from these sources was run.

## From https://github.com/expo/skills (commit d4f484024fec15196bfd3c272e953e3f983972cf)

Path in the repo: `plugins/expo/skills/<name>`. Licence: MIT, Copyright 650 Industries, Inc. (Expo). The LICENSE file is copied into each skill folder. `expo-animation` keeps its own LICENSE (MIT, Emil Kowalski).

Installed: expo-router, expo-native-ui, expo-ui, expo-animation, expo-data-fetching, expo-project-structure, expo-upgrade. All seven names existed exactly. Not installed on purpose: expo-skill-feedback and every other Expo skill.

## From https://github.com/vercel-labs/agent-skills (commit 063bee94c3f4df8453406c830b0a7df0f2860278)

Path in the repo: `skills/react-native-skills` (installed as `react-native-skills`, its frontmatter name is `vercel-react-native-skills`). Licence: MIT (stated in the skill frontmatter and the repo README, the repo has no LICENSE file, so a note was added to the skill description).

## What was removed or changed

All eight skills:
- Removed the "Submitting Feedback" section (the `npx --yes submit-expo-feedback@latest` command and the pointer to expo-skill-feedback) from every Expo SKILL.md.
- Added a "Project override" note under the frontmatter: our design system (NativeWind, React Native Reusables, docs/design.md) wins over skill advice on native look and styling, and no feedback or data-sending command may be run.

Expo skills:
- Not copied: the `agents/openai.yaml` files (metadata for OpenAI tools, unused here).
- expo-ui: did not copy `scripts/list-components.js` (a read-only local script, not needed). Removed the `allowed-tools` frontmatter line that pre-approved running it, and replaced the "run the list-components script" bullets in `references/swift-ui.md` and `references/jetpack-compose.md` with "read the installed .d.ts files". Note added that we keep Gorhom Bottom Sheet and Reusables.
- expo-upgrade: removed one line in `references/new-architecture.md` that suggested running `bunx xcobra expo eval`.

Vercel skill:
- Not copied: `AGENTS.md` (a generated copy of the rules, 73 KB, checked line by line against the rule files) and `README.md` (contributor notes). Removed the SKILL.md pointer to AGENTS.md. Added the licence note to the description.

## Flagged, not removed

- Style conflicts with our stack: expo-native-ui says "CSS and Tailwind are not supported, use inline styles" and prefers system colours via `Color`; expo-ui says to use `@expo/ui` BottomSheet instead of Gorhom; expo-project-structure puts StyleSheet at the bottom of component files; react-native-skills ui-native-modals prefers native sheets over JS sheets and ui-styling says to avoid multiple font sizes. The override note and CLAUDE.md say design.md wins.
- expo-upgrade `references/react-navigation-to-expo-router.md` mentions `npx expo-codemod ...` (an official Expo package that would be downloaded and run). Only run it with the founder's approval.
- Ordinary tooling commands appear (`npx expo install`, `npx expo prebuild`, `npx expo-doctor`). These are normal Expo CLI use and not data-sending.
- Checked for and found none: curl or wget pipes, telemetry, hidden or zero-width characters, HTML comments, instructions to disable permissions, prompt-injection text.
