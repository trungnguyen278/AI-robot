# 0004 — Raspberry Pi software first; body controller not chosen yet

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

- Only the Raspberry Pi 5 is fixed ([ADR-0001](0001-raspberry-pi-5-8gb.md)). The ESP32-S3 chosen in [ADR-0002](0002-esp32-s3-body-controller.md) is not settled: it is one candidate, and the body may use a different microcontroller.
- `ai-robot-server` and `ai-robot-app` do not exist yet.
- Work should start where it does not depend on these open choices.

## Decision

- Build the Raspberry Pi 5 software first. The body controller (its microcontroller, its firmware and the Pi ⇄ body protocol), the server and the app wait until they are needed.
- The Pi software reaches hardware through interfaces that have simulated implementations, so it runs and is tested before the real parts exist.
- Unchanged from ADR-0002: networking (Wi-Fi, Bluetooth LE) belongs to the Pi; real-time body I/O (servos, motors and encoders, sensors, LEDs, the safety watchdog) belongs to a separate microcontroller, to be chosen in a later ADR.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep ADR-0002 (ESP32-S3 now) | The choice is not settled, and the Pi software does not need it yet. |
| Wait until all the hardware is chosen | Delays all software work. |

## Consequences

- Positive: work starts now on the part that is decided; the Pi software runs on any computer and in CI.
- Negative / accepted trade-offs: a simulation hides problems that only real hardware shows (timing, noise, power) → test on the real parts as soon as they arrive.
- Follow-up: an ADR choosing the body microcontroller, then one for the Pi ⇄ body link and protocol format (`protocol/`).

## References

- Supersedes [ADR-0002](0002-esp32-s3-body-controller.md).
- How the Pi software is built: [ADR-0005](0005-pi-software-platform.md).
