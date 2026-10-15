# Architecture overview

> Draft — refined through the ADRs in [decisions/](decisions/README.md).

```
              ┌──────────────── Raspberry Pi 5 — brain ────────────────┐
 Mic ──I2S──▶ │ voice: wake word, VAD, AEC, conversation               │
 Speaker ◀─── │ vision: AI camera (IMX500)                             │ ◀─ Wi-Fi ─▶ ai-robot-server
 Camera ─CSI▶ │ face: expressive eyes on the 7" display                │ ◀─ BLE ───▶ ai-robot-app
 Display ◀DSI │ motion · system · behavior                             │
              └───────────────────────────┬────────────────────────────┘
                                          │ link and protocol: not decided yet (protocol/)
              ┌───────────────────────────▼────────────────────────────┐
              │ Body controller — microcontroller, not chosen yet      │
              │ STS3215 servo bus ×8 · MG540 motors ×2 + encoders      │
              │ VL53L1X · NeoPixel · battery voltage · safety watchdog │
              └────────────────────────────────────────────────────────┘
```

## Responsibilities

| Block | Owns | Does not own |
|---|---|---|
| Raspberry Pi 5 | Audio, vision, face, AI, networking (built-in Wi-Fi/BLE), behavior | Real-time control loops |
| Body controller (microcontroller not chosen yet — [ADR-0004](decisions/0004-pi-software-first.md)) | Servos, motors and encoders, distance sensor, LEDs, battery voltage, safe stop when the Pi goes silent | Networking |
| `ai-robot-server` (later) | STT/LLM/TTS, storage, device management | |
| `ai-robot-app` (later) | Pairing, settings, remote control | |

## Principles

- Pi first ([ADR-0004](decisions/0004-pi-software-first.md)): the Pi software is built before the rest, against simulated hardware.
- The Pi may hang or reboot at any time, so the body controller brings the robot to a safe state when the Pi's heartbeat is lost.
- The Pi ⇄ body protocol is defined once, in [`protocol/`](../protocol/README.md).
- Software on the Pi is split into modules that talk only through messages, so each one can be added, replaced or removed without touching the others.
- Where heavy AI runs (camera, Pi or server) is decided in an ADR, not implicitly in code.

## Software on the Pi

Proposed in [ADR-0005](decisions/0005-pi-software-platform.md): one Python process (asyncio) with an optional C++ extension. Modules own the ports of the hardware they use; adapters implement the ports, simulated until the real parts exist. Details, and how to run and extend it: [`software/README.md`](../software/README.md).

```
modules    system · motion · voice · vision · face · behavior
             │  talk to each other only through messages on the bus
             │  each one owns some ports
ports      audio_in · audio_out · camera · display · ai_backend
           drive · joints · range · power · lights · safety
             │  implemented by
adapters   sim (any computer, CI)  |  real (on the robot), chosen per profile
```

Until the body controller exists, the body ports (`drive`, `joints`, `range`, `power`, `lights`, `safety`) stay simulated; then one adapter implements them over the link to the body controller.

## Open questions (each should become an ADR)

- [ ] OS, ROS 2 or not, language on the Pi, how its modules communicate — proposed in [ADR-0005](decisions/0005-pi-software-platform.md).
- [ ] Which microcontroller becomes the body controller ([ADR-0004](decisions/0004-pi-software-first.md)).
- [ ] Pi ⇄ body link (concept v0 shows UART/I2C) and the packet format.
- [ ] Does the body controller or the Pi drive the motor driver?
- [ ] How AI work is split between the camera, the Pi and the server.
- [ ] Audio: ReSpeaker HAT or MAX98357A — they cannot share the I2S pins; see [hardware/README.md](../hardware/README.md).
