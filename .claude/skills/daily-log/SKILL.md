---
name: daily-log
description: Write the day's entry in the Vinty knowledge base (docs/log/YYYY-MM-DD.md). Use at the END of every working session or when Eden says "log the day", "daily log", "wrap up" or "end of session". Never at the start of a session.
version: 1.0.0
---

# Daily log

Captures what happened in a working session so the next session (and Eden) does not start cold.

## When

At the end of a session, after the work is committed. If a session produced nothing worth recording, say so and skip it.

## Where

`docs/log/YYYY-MM-DD.md`, one file per day. If today's file exists, append a new section headed with the time or topic. Never overwrite earlier entries.

## How

1. Gather facts first. Do not write from memory:
   - `git log --since=midnight --format='%h %s'` and `git branch --show-current`
   - `git status` for unfinished work
   - the conversation, for decisions Eden made and problems hit
2. Write in plain language Eden can read. Describe what he can now see or do. No code in prose. Gloss any technical word in a few plain words. No em or en dashes, no semicolons.
3. Link to commits by short hash and to PRs by number. Link to docs by path rather than copying their content.
4. Never write secrets, tokens, emails of users or personal data.
5. If a decision was made, also make sure it is recorded in its real home (`docs/design.md` for design, `docs/blueprint/data-model.md` for data, `docs/roadmap.md` for scope) and link to it from the log. The log points, it does not replace them.

## Format

```
# YYYY-MM-DD

Branch: `name`

## What was done
Plain bullets of outcomes. What can Eden see or do now?

## Decisions
- What was decided, by whom, and why. Link to where it is recorded (D-011, data-model open item 4, roadmap).

## Problems and fixes
- Problem in plain words. Root cause. Fix. Lesson.
  If it took 2+ tries, list what was tried and why it failed.

## Open questions
- Questions waiting for Eden, with a suggested default.

## Next steps
- The first thing to do next session, then what follows.

## Links
- Commits: `abc1234` short message
- PRs: #n
```

Leave out an empty section's content but keep the heading with "None".

## After writing

- Update the milestone status in `docs/roadmap.md` if a milestone started or shipped.
- Tell Eden in 2 or 3 lines: where the entry is and the one open question, if any.
- Do not commit unless asked. The log is part of the repo and goes in with the next commit.
