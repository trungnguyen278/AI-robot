# ai-robot

> **Status:** early setup — project skeleton and documentation only; no code yet.

A mobile AI robot with **two arms**, a **neck** carrying a display as an expressive face, voice interaction and an AI camera. Concept v0 uses a tracked chassis.

- **Brain:** Raspberry Pi 5 (8 GB) — the only part that is fixed. Audio, vision, face, AI and networking (built-in Wi-Fi and Bluetooth LE).
- **Body controller:** a microcontroller for real-time I/O — motors and encoders, joints, sensors, lights. Not chosen yet (concept v0 shows an ESP32-S3); until then the body is simulated.

The system design — architecture, decisions and contracts — lives in [ai-robot-design](https://github.com/trungnguyen278/ai-robot-design). This repository holds the implementation.

![Concept v0](hardware/images/concept-v0.webp)

*Concept v0 — a quick sketch (labels in Vietnamese); the arm design may still change.*

## Repository layout

```
ai-robot/
├── software/    Robot software on the Raspberry Pi 5 — built first
├── firmware/    Microcontroller modules (body-controller: MCU not chosen yet)
├── protocol/    Machine-readable Pi ⇄ body protocol, implementing the robot-body contract
├── hardware/    Bill of materials, power tree, pin map, component notes, CAD
├── docs/        Development log
├── tools/       Utility scripts
└── .claude/     Task checklists for AI assistants (see AGENTS.md)
```

Each folder is an independent component with its own README; see [Contributing](CONTRIBUTING.md#adding-or-removing-a-component) for how to add or remove one.

## Documentation

- [ai-robot-design](https://github.com/trungnguyen278/ai-robot-design) — system overview, robot architecture, decisions (ADRs), interface contracts
- [hardware/](hardware/README.md) — parts, power tree, pin map, open issues
- [docs/](docs/README.md) — development log
- [CONTRIBUTING.md](CONTRIBUTING.md) — design rules, portability, branches, commits, licensing

## Related repositories

| Repository | Role | Status |
|---|---|---|
| [ai-robot-design](https://github.com/trungnguyen278/ai-robot-design) | System design: architecture, ADRs, contracts | Active |
| `ai-robot-server` | AI backend and device management | Deferred |
| `ai-robot-app` | Mobile companion app | Deferred |
| [Luni_Robot](https://github.com/trungnguyen278/Luni_Robot) | Previous generation (ESP32-S3 + ESP32-C5) | Superseded |

## License

Released under the [MIT License](LICENSE).
