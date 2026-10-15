---
name: devlog
description: Keep continuity in this long-running project. At the start of a work session, read the latest dev log entry to recall where things stand; at the end, append a dated entry (what was done, decisions, problems, next steps). Use when starting or resuming work ("where were we", "continue", "what did we do last time") or when wrapping up ("summarize the session", "log today's work").
---

# Development log

Work on this project can pause for weeks or months. The log is its shared memory.

## At the start

1. Read the newest file in `docs/devlog/` (named `YYYY-MM.md`).
2. Summarize in 3–5 lines: what happened last time, what is unfinished, and the recorded next steps.

## At the end

1. Append an entry to `docs/devlog/YYYY-MM.md`, creating the file for a new month:

   ```markdown
   ## YYYY-MM-DD — <short title>

   **Done:** …
   **Decisions:** … (link ADRs)
   **Problems / unfinished:** …
   **Next:** …
   ```

2. Keep it short — it is a memory aid, not a report. Link commits and ADRs instead of repeating them.
