---
name: adr
description: Record an architecture or design decision as an ADR (Architecture Decision Record) in docs/decisions/. Use when a significant technical choice is made, revisited or reversed — compute platform, OS, frameworks (e.g. ROS 2 or not), languages, the Pi⇄ESP32 protocol format, power architecture, how work is split between the Pi, the ESP32 and the server — or when the user asks to write down a decision or to explain why something was chosen.
---

# Recording a decision (ADR)

1. Read `docs/decisions/README.md` to get the next number and check for related ADRs.
2. Copy `docs/decisions/0000-template.md` to `docs/decisions/NNNN-short-title.md` (four digits, kebab-case).
3. Fill in Context → Decision → Alternatives considered (with why each was rejected) → Consequences (positive and negative) → References. Keep it short; include numbers and sources where available.
4. Status: `Proposed` while under discussion, `Accepted` once the user agrees. Never mark something `Accepted` that the user has not agreed to.
5. To change an earlier decision, **do not rewrite the old ADR**: set its status to `Superseded by NNNN` and write a new one.
6. Add a row to the table in `docs/decisions/README.md`.
7. Commit with the scope `docs`, e.g. `docs(decisions): add ADR-0004 on ROS 2`.
