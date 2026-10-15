# software/ — robot software on the Raspberry Pi 5

> Empty — built first. Waiting for the software platform decision ([ADR-0005](https://github.com/trungnguyen278/ai-robot-design/blob/main/decisions/0005-pi-software-platform.md), Proposed).

Implements the [robot architecture](https://github.com/trungnguyen278/ai-robot-design/blob/main/robot/architecture.md):

- **Modules** — behavior, voice, vision, face, motion, system — talk to each other through messages only.
- **Ports** give modules access to hardware and external services; each port has a `sim` adapter plus real adapters.
- **Profiles** pick one adapter per port: `desktop` (any PC, everything simulated), `pi` (Pi devices real, body simulated) and `robot` (everything real).

Because the body is reached only through ports, this software runs on a PC or on the Pi alone before the body controller is chosen. The robot's display name lives in a single configuration file and is never hard-coded.
