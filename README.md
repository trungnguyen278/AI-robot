# ai-robot

> **Status:** early development — the Raspberry Pi software skeleton runs against simulated hardware and already drives the robot's face, drawn in a web browser; no hardware has been built yet.

A mobile AI robot on a tracked chassis, with **two arms**, a **2-DOF neck** carrying a 7" display as an expressive face, voice interaction, and an AI camera.

- **Brain:** Raspberry Pi 5 (8 GB) — audio, vision, face, AI and networking (built-in Wi-Fi and Bluetooth LE).
- **Body:** a microcontroller for real-time control of servos, motors and encoders, sensors and LEDs — not chosen yet (concept v0 shows an ESP32-S3; [ADR-0004](docs/decisions/0004-pi-software-first.md)). Until then the body is simulated.

![Concept v0](hardware/images/concept-v0.webp)

*Concept v0 — a quick sketch (labels in Vietnamese); the arm design may still change.*

## What it should do

A first outline of the product, not a specification: details and priorities are settled along the way. More ideas and notes: [docs/vision.md](docs/vision.md).

- **Talk:** a wake word, spoken conversation with an AI assistant, and being interrupted while it speaks.
- **Express:** animated eyes and emotions on the face display; full-screen scenes for everyday information (time, weather, timers, reminders, music); status screens (start-up, connection, updates, battery); touch input, and interactive screens such as settings, opened by a tap or by voice.
- **See:** notice people, faces and objects with the camera, and show the AI what it sees.
- **Move:** drive on its tracks while avoiding obstacles, turn its head towards people, gesture with its arms, perhaps pick up light objects.
- **Sense:** obstacles ahead and the battery level, with more sensors as the need arises.
- **Connect:** Wi-Fi for the AI service and for software updates; set-up and settings on the robot's own touch screen, or from a phone app over Bluetooth LE, which also handles remote control.
- **Stay safe:** an emergency stop, a safe stop if the software hangs, status lights, and a clean shutdown before the battery runs out.

## Repository layout

```
ai-robot/
├── software/    Robot software on the Raspberry Pi 5 (Python + C++)
├── ui/          The screen renderer: the robot's face, in a browser, on any screen
├── firmware/    Microcontroller modules (body-controller: microcontroller not chosen yet)
├── protocol/    Protocols between components (Pi ⇄ body, software ⇄ screen, robot ⇄ cloud)
├── hardware/    Bill of materials, power tree, pin map, component notes, CAD
├── docs/        Vision, architecture, decision records (ADRs), dev log
├── tools/       Utility scripts
└── .claude/     Task checklists for AI assistants (see AGENTS.md)
```

Each folder is an independent component with its own README; see [Contributing](CONTRIBUTING.md#adding-or-removing-a-component) for how to add or remove one.

## Documentation

- [docs/](docs/README.md) — vision, architecture, decision records (ADRs), dev log
- [hardware/](hardware/README.md) — parts, power tree, pin map, open issues
- [ui/](ui/README.md) — the screen renderer, the studio to try every expression, and the previous emotion library
- [protocol/](protocol/README.md) — the protocols between components
- [CONTRIBUTING.md](CONTRIBUTING.md) — branches, commits, documentation, secrets, licensing

## Related repositories

| Repository | Role | Status |
|---|---|---|
| `ai-robot-server` | AI backend and device management | Not created yet |
| `ai-robot-app` | Mobile companion app | Not created yet |
| [Luni_Robot](https://github.com/trungnguyen278/Luni_Robot) | Previous generation (ESP32-S3 + ESP32-C5) | Superseded — see [docs/legacy.md](docs/legacy.md) |

## License

Released under the [MIT License](LICENSE).
