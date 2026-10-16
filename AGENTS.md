# AGENTS.md

Guidance for AI coding assistants working in this repository. Read [README.md](README.md) for the project overview and [CONTRIBUTING.md](CONTRIBUTING.md) for the conventions and design rules — they apply to assistants exactly as they do to people.

## How to work here

- Reply in the language the user writes in; everything committed to the repository is in English.
- Check the newest file in `docs/devlog/` to see where things stand, and add an entry when a work session ends.
- Never make a decision on someone's behalf: record significant decisions as ADRs in `docs/decisions/`, and leave anything that has not been explicitly agreed as `Proposed`.
- Never state hardware specifications from memory: look them up and cite the source.

## Task checklists

Each folder in `.claude/skills/` holds one step-by-step checklist in plain Markdown (`SKILL.md`); its header says when to use it. Follow the matching checklist before changing hardware documentation, Raspberry Pi configuration, decisions or the dev log, and the `review` checklist before handing a pull request over.
