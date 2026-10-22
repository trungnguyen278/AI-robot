# Contributing

These conventions apply to everyone working in this repository — people and AI assistants alike. This is a long-running project: consistency matters more than speed.

## Design rules

1. **The Pi ⇄ module protocol is defined once**, in `protocol/`. Both sides generate from or share it; never hand-copy definitions.
2. **Networking belongs to the Pi.** The Raspberry Pi 5 has built-in Wi-Fi and Bluetooth LE; the body microcontroller handles real-time I/O only ([ADR-0004](docs/decisions/0004-pi-software-first.md)).
3. **Never hard-code the product name.** The display name (screen, BLE, app) lives in a single configuration file; repositories, packages and identifiers use neutral, descriptive names ([ADR-0003](docs/decisions/0003-neutral-repo-naming.md)).
4. **Electrical safety.** Never power servos or motors from the Pi's 5 V rail. The emergency stop must cut motors and servos. The body controller must bring the robot to a safe state when the Pi's heartbeat is lost.
5. **Build for the long run.** Choose the design that will last, even when it is more work: effort is no reason to settle for less. Do not build stopgaps meant to be replaced later. When the lasting choice is not clear yet, settle it first, with research, measurements or an ADR. Work may still land in steps, as long as each step belongs to the final design. Simulated adapters are not stopgaps: they stay, for tests and for running without hardware.

## Portability

The repository must work for anyone who clones it, on any machine.

- No person- or machine-specific values in committed files: absolute paths, user names, serial port names (`COM3`, `/dev/ttyUSB0`), IP addresses, Wi-Fi names, editor settings. Read them from environment variables or a git-ignored local file, and document the defaults in `.env.example`.
- Hardware specifics (pin numbers, bus addresses, board variants) live in one configuration per component, not scattered through the code, so a part or board can be swapped by changing configuration and drivers only.
- Scripts state the operating system and tools they need; prefer cross-platform tooling.

## Language

Everything in the repository — code, comments, documentation and commit messages — is written in English.

## Branches

- `main` must always be usable. Do not commit to it directly: work on a branch and merge through a pull request.
- Branch names follow `<type>/<short-description>`, e.g. `feat/wake-word`, `fix/servo-timeout`, `hw/power-tree`, `docs/adr-ros2`, `chore/ci`.

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <short summary in the imperative mood>`.

| Type | Use for |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `refactor` | Restructuring without behavior change |
| `test` | Adding or changing tests |
| `chore` | Tooling, configuration, CI, housekeeping |

The scope is the affected area: `software`, `ui`, `firmware`, `protocol`, `hardware`, `docs`, `tools`, `ai`, `ci`.

Example: `feat(firmware): read MG540 encoders with PCNT`

Keep commit messages short. Every commit stays in the history for good, and the diff already shows what changed.

- **The subject** says what changes, in under 72 characters.
- **A body** is optional: at most a few lines on *why*, when the subject does not say it.
- **No inventories.** Leave out lists of files, settings or tests, and test counts.
- **No review narratives.** What a review found belongs in the conversation or the dev log, not in the commit.

## Pull requests

- A pull request carries **exactly one commit**, written as a Conventional Commit. To change it, amend that commit (`git commit --amend`) and update the branch with `git push --force-with-lease`; do not push follow-up commits.
- A branch that already has several commits is squashed locally before pushing: `git reset --soft $(git merge-base origin/main HEAD)`, then commit once.
- Pull requests are merged with a merge commit, the only merge method enabled on GitHub, so each pull request adds one merge commit and its single commit to `main`.
- The description is short, following the template:
  - a few sentences on what changes and why;
  - one line on how it was tested;
  - the checklist.

## Adding or removing a component

The repository is a set of independent components: `software/`, `ui/`, each module under `firmware/`, `protocol/` and `tools/`.

- **Add:** create a folder containing a `README.md` (purpose, status, how to build, run and test), its own build configuration and its tests. List it in the parent README (the layout in `README.md`, or the module table in `firmware/README.md`).
- **Remove:** delete the folder and its entry in the parent README. If the removal reflects a design decision, record it in an ADR.
- Build configuration, dependencies and vendored third-party code (in a `third_party/` folder) stay inside the component; the repository root only holds repository-wide files.
- Components never reach into each other's internals; they talk through `protocol/` or another documented interface.

## Documentation travels with the change

Checklists for these steps live in `.claude/skills/<name>/SKILL.md`.

- Hardware changes → update `hardware/` in the same commit (`hardware-change` checklist).
- Protocol changes → update `protocol/` first, then both sides, in the same pull request.
- Significant technical decisions → an ADR in `docs/decisions/` (`adr` checklist). Anything not explicitly agreed stays `Proposed`.
- End of a work session → an entry in `docs/devlog/` (`devlog` checklist).

## Secrets and large files

- Never commit Wi-Fi passwords, API keys or device tokens. Use `.env` (git-ignored) and commit a `.env.example` without real values.
- Do not commit large binaries (AI models, videos, heavy CAD files, dumps). Use Git LFS or GitHub Releases and link them from the relevant README.

## Facts and sources

- Hardware specifications need a source (datasheet or vendor documentation); otherwise mark them **unverified**.
- Prices and software or firmware versions are always dated.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

- New source files start with an SPDX header: `// SPDX-License-Identifier: MIT` (C/C++, JavaScript), `# SPDX-License-Identifier: MIT` (Python, shell) or `<!-- SPDX-License-Identifier: MIT -->` (HTML).
- Third-party code, models and assets keep their original licenses. List them in `THIRD_PARTY_NOTICES.md` when the first one is added.
