# CLAUDE.md

Guidance for Claude Code in this repository. The project overview and the contribution conventions are imported at the end of this file; everything above them is specific to working with Claude.

## Working with the user

- The user writes in Vietnamese: reply in Vietnamese. Everything committed to the repository is in English.
- This is a long-running, spare-time project. Favor clarity, documentation and recorded decisions over speed; do not optimize prematurely.
- To see where things stand, read the newest file in `docs/devlog/` (skill `devlog`).

## Invariants

1. **No ESP as a network card.** The Pi 5 has built-in Wi-Fi and Bluetooth LE; the ESP32-S3 handles real-time I/O only (ADR-0002).
2. **The Pi ⇄ module protocol is defined once**, in `protocol/`. Both sides generate from or share it; never hand-copy definitions.
3. **Never hard-code the product name.** It is not final and may change. The display name (screen, BLE, app) lives in a single configuration file; repositories, packages and identifiers use neutral, descriptive names (ADR-0003).
4. **Electrical safety.** Never power servos or motors from the Pi's 5 V rail. The emergency stop must cut motors and servos. The ESP32-S3 must bring the robot to a safe state when the Pi's heartbeat is lost.
5. **Do not decide for the user.** Record significant decisions as ADRs (skill `adr`); anything the user has not agreed to stays `Proposed`.
6. **No specifications from memory.** Look them up and cite the source (skills `hardware-change` and `pi5-platform`).

Project skills live in `.claude/skills/` and are discovered automatically.

## Project overview

@README.md

## Conventions

@CONTRIBUTING.md
