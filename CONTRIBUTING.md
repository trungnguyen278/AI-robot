# Contributing

These conventions apply to everyone working in this repository — people and AI assistants alike. This is a long-running project: consistency matters more than speed.

The system design — architecture, decisions (ADRs) and interface contracts — lives in [ai-robot-design](https://github.com/trungnguyen278/ai-robot-design). This repository implements it.

## Design rules

1. **Hardware behind ports.** Software on the Pi reaches hardware and external services only through the ports of the [robot architecture](https://github.com/trungnguyen278/ai-robot-design/blob/main/robot/architecture.md). Real or simulated adapters are selected by profile, so the Pi software runs before the body exists ([ADR-0004](https://github.com/trungnguyen278/ai-robot-design/blob/main/decisions/0004-pi-first-hardware-abstraction.md)).
2. **Contracts are defined once.** The Pi ⇄ body protocol in `protocol/` implements the [robot-body contract](https://github.com/trungnguyen278/ai-robot-design/blob/main/interfaces/robot-body.md); both sides generate from or share it, never hand-copy definitions.
3. **Networking belongs to the Pi.** It has built-in Wi-Fi and Bluetooth LE; body microcontrollers handle real-time I/O only.
4. **Never hard-code the product name.** The display name (screen, BLE, app) lives in a single configuration file; repositories, packages and identifiers use neutral, descriptive names ([ADR-0003](https://github.com/trungnguyen278/ai-robot-design/blob/main/decisions/0003-neutral-repo-naming.md)).
5. **Electrical safety.** Never power servos or motors from the Pi's 5 V rail. The emergency stop must cut motors and servos. The body controller must bring the robot to a safe state when the Pi's heartbeat is lost.

## Portability

The repository must work for anyone who clones it, on any machine.

- No person- or machine-specific values in committed files: absolute paths, user names, serial port names (`COM3`, `/dev/ttyUSB0`), IP addresses, Wi-Fi names, editor settings. Read them from environment variables or a git-ignored local file, and document the defaults in `.env.example`.
- Hardware specifics (device names, pin numbers, bus addresses, board variants, calibration) live in profiles and per-component configuration, not in code, so a part or board can be swapped by changing configuration and adapters only.
- Scripts state the operating system and tools they need; prefer cross-platform tooling.

## Language

Everything in the repository — code, comments, documentation and commit messages — is written in English.

## Branches

- `main` must always be usable. Do not commit to it directly: work on a branch and merge through a pull request.
- Branch names follow `<type>/<short-description>`, e.g. `feat/wake-word`, `fix/servo-timeout`, `hw/power-tree`, `docs/devlog`, `chore/ci`.

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

The scope is the affected area: `software`, `firmware`, `protocol`, `hardware`, `docs`, `tools`, `ai`, `ci`.

Example: `feat(software): add simulated drive base adapter`

## Adding or removing a component

The repository is a set of independent components: `software/`, each module under `firmware/`, `protocol/` and `tools/`.

- **Add:** create a folder containing a `README.md` (purpose, status, how to build, run and test), its own build configuration and its tests. List it in the parent README (the layout in `README.md`, or the module table in `firmware/README.md`).
- **Remove:** delete the folder and its entry in the parent README. If the removal reflects a design decision, record it as an ADR in ai-robot-design.
- Build configuration, dependencies and vendored third-party code (in a `third_party/` folder) stay inside the component; the repository root only holds repository-wide files.
- Components never reach into each other's internals; they talk through `protocol/` or another documented interface.

## Documentation travels with the change

- Hardware changes → update `hardware/` in the same commit (`hardware-change` checklist in `.claude/skills/`).
- Protocol changes → update the contract in ai-robot-design first, then `protocol/` and both sides.
- Significant technical decisions → an ADR in ai-robot-design. Anything not explicitly agreed stays `Proposed`.
- End of a work session → an entry in `docs/devlog/` (`devlog` checklist in `.claude/skills/`).

## Secrets and large files

- Never commit Wi-Fi passwords, API keys or device tokens. Use `.env` (git-ignored) and commit a `.env.example` without real values.
- Do not commit large binaries (AI models, videos, heavy CAD files, dumps). Use Git LFS or GitHub Releases and link them from the relevant README.

## Facts and sources

- Hardware specifications need a source (datasheet or vendor documentation); otherwise mark them **unverified**.
- Prices and software or firmware versions are always dated.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

- New source files start with an SPDX header: `// SPDX-License-Identifier: MIT` (C/C++) or `# SPDX-License-Identifier: MIT` (Python, shell).
- Third-party code, models and assets keep their original licenses. List them in `THIRD_PARTY_NOTICES.md` when the first one is added.
