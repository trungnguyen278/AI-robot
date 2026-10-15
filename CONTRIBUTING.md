# Contributing

These conventions apply to everyone working in this repository, human or AI. This is a long-running project: consistency matters more than speed.

## Language

Everything in the repository — code, comments, documentation and commit messages — is written in English.

## Branches

- `main` is protected and always usable. Never commit to it directly: work on a branch and merge through a pull request.
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

The scope is the affected area: `software`, `firmware`, `protocol`, `hardware`, `docs`, `tools`, `claude`, `ci`.

Example: `feat(firmware): read MG540 encoders with PCNT`

## Adding or removing a component

The repository is a set of independent components: `software/`, each module under `firmware/`, `protocol/` and `tools/`.

- **Add:** create a folder containing a `README.md` (purpose, status, how to build, run and test), its own build configuration and its tests. List it in the parent README (the layout in `README.md`, or the module table in `firmware/README.md`).
- **Remove:** delete the folder and its entry in the parent README. If the removal reflects a design decision, record it in an ADR.
- Build configuration, dependencies and vendored third-party code (in a `third_party/` folder) stay inside the component; the repository root only holds repository-wide files.
- Components never reach into each other's internals; they talk through `protocol/` or another documented interface.

## Documentation travels with the change

- Hardware changes → update `hardware/` in the same commit (skill `hardware-change`).
- Protocol changes → update `protocol/` first, then both sides, in the same pull request.
- Significant technical decisions → an ADR in `docs/decisions/` (skill `adr`).
- End of a work session → an entry in `docs/devlog/` (skill `devlog`).

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
