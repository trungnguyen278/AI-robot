# AGENTS.md

Guidance for AI coding assistants working in this repository. Read [README.md](README.md) for the project overview and [CONTRIBUTING.md](CONTRIBUTING.md) for the conventions and design rules — they apply to assistants exactly as they do to people.

## How to work here

- Reply in the language the user writes in; everything committed to the repository is in English.
- The architecture, decisions and interface contracts live in [ai-robot-design](https://github.com/trungnguyen278/ai-robot-design). Follow them; if a change needs a new decision or a contract change, make it there first.
- Never make a decision on someone's behalf: new decisions are ADRs in ai-robot-design with status `Proposed` until they are explicitly agreed.
- Never state hardware specifications from memory: look them up and cite the source.
- Check the newest file in `docs/devlog/` to see where things stand, and add an entry when a work session ends.

## Task checklists

Each folder in `.claude/skills/` holds one step-by-step checklist in plain Markdown (`SKILL.md`); its header says when to use it. Follow the matching checklist before changing hardware documentation, Raspberry Pi configuration or the dev log.
