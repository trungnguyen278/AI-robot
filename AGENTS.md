# AGENTS.md

Guidance for AI coding assistants working in this repository. Read [README.md](README.md) for the project overview and [CONTRIBUTING.md](CONTRIBUTING.md) for the conventions and design rules — they apply to assistants exactly as they do to people.

## How to work here

- Reply in the language the user writes in; everything committed to the repository is in English.
- Check the newest file in `docs/devlog/` to see where things stand, and add an entry when a work session ends.
- Never make a decision on someone's behalf: record significant decisions as ADRs in `docs/decisions/`, and leave anything that has not been explicitly agreed as `Proposed`.
- Build for the long run ([design rule 5](CONTRIBUTING.md#design-rules)): propose the design that will last, even when it is bigger, rather than one to replace later. "For now", "provisional" or "until X" in a proposal is a sign to settle the choice first.
- Never state hardware specifications from memory: look them up and cite the source.
- Keep commit messages and pull request descriptions short, as [CONTRIBUTING.md](CONTRIBUTING.md#commits) says:
  - a subject, and at most a few lines on why;
  - for a pull request, a few sentences and the template's checklist.

  Lists of files, settings and tests, and what a review found, go in the conversation or the dev log, never in git.
- **No hard-coded values.** Before writing a number, a name or a duration in code, decide where it belongs:
  - a value someone may want to tune (a timing, a rate, a limit, a threshold, a colour, a hardware value) goes in the component's configuration (`software/config/base.toml` for the robot software, `ui/src/settings.js` for the renderer), with a comment. The code takes it as a required setting, with no default, so that the configuration shows what the robot really uses;
  - a value a protocol fixes (a version, a code, a field's limit) lives in `protocol/` and, once, in the code that speaks the protocol, named and pointing to the spec;
  - a fact (a physical or mathematical constant, a unit conversion, a published formula) stays in the code, named, with its source;
  - a value for one robot or one machine (an address, a path, a port, a credential) is never committed: `local.toml` or an environment variable;
  - design content, such as the face's shapes, motions and colours, stays in the renderer's data files (`ui/src/expressions.js`, `tones.js`…), edited with the studio.

## Task checklists

Each folder in `.claude/skills/` holds one step-by-step checklist in plain Markdown (`SKILL.md`); its header says when to use it. Follow the matching checklist before changing hardware documentation, Raspberry Pi configuration, decisions or the dev log, and the `review` checklist before handing a pull request over.
