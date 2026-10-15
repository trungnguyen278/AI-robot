# Architecture decision records (ADRs)

Each significant decision is a short file: context, decision, alternatives considered and consequences — so that years from now we still know **why**.

- Template: [0000-template.md](0000-template.md). How to write one: the `adr` checklist (`.claude/skills/adr/SKILL.md`).
- Never edit an old ADR to change a decision; write a new one and mark the old one "Superseded by …".

| # | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-raspberry-pi-5-8gb.md) | Raspberry Pi 5 (8 GB) as the robot's brain | Accepted | 2026-10-15 |
| [0002](0002-esp32-s3-body-controller.md) | ESP32-S3 as body controller for real-time I/O only | Superseded by [0004](0004-pi-software-first.md) | 2026-10-15 |
| [0003](0003-neutral-repo-naming.md) | Descriptive repository names without the product name | Accepted | 2026-10-15 |
| [0004](0004-pi-software-first.md) | Raspberry Pi software first; body controller not chosen yet | Accepted | 2026-10-15 |
| [0005](0005-pi-software-platform.md) | Pi software platform: Raspberry Pi OS, Python with C++ extensions, no ROS 2 for now | Proposed | 2026-10-15 |
| [0006](0006-screen-renderer.md) | Screen: a browser renderer with a procedural face, driven by the Pi software | Proposed | 2026-10-16 |
