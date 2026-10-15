# Architecture overview

> Draft — refined through the ADRs in [decisions/](decisions/README.md).

```
              ┌──────────────── Raspberry Pi 5 — brain ────────────────┐
 Mic ──I2S──▶ │ audio: wake word, VAD, AEC, conversation               │
 Speaker ◀─── │ vision: AI camera (IMX500)                             │ ◀─ Wi-Fi ─▶ ai-robot-server
 Camera ─CSI▶ │ face: expressive eyes on the 7" display                │ ◀─ BLE ───▶ ai-robot-app
 Display ◀DSI │ behavior: orchestration                                │
              └───────────────────────────┬────────────────────────────┘
                                          │ UART (planned) — protocol defined in protocol/
              ┌───────────────────────────▼────────────────────────────┐
              │ ESP32-S3 — body-controller (real time)                 │
              │ STS3215 servo bus ×8 · MG540 motors ×2 + encoders      │
              │ VL53L1X · NeoPixel · battery voltage · safety watchdog │
              └────────────────────────────────────────────────────────┘
```

## Responsibilities

| Block | Owns | Does not own |
|---|---|---|
| Raspberry Pi 5 | Audio, vision, face, AI, networking (built-in Wi-Fi/BLE), behavior | Real-time control loops |
| ESP32-S3 (body-controller) | Servos, motors and encoders, distance sensor, LEDs, battery voltage, safe stop when the Pi goes silent | Networking (its Wi-Fi/BLE stay unused) |
| `ai-robot-server` | STT/LLM/TTS, storage, device management | |
| `ai-robot-app` | Pairing, settings, remote control | |

## Principles

- The Pi may hang or reboot at any time, so the ESP32-S3 brings the robot to a safe state when the Pi's heartbeat is lost.
- The Pi ⇄ ESP32 protocol is defined once, in [`protocol/`](../protocol/README.md).
- Software on the Pi is split into loosely coupled modules (audio, vision, face, body link, behavior, networking) behind defined interfaces, so each one can be added, replaced or removed without touching the others.
- Where heavy AI runs (camera, Pi or server) is decided in an ADR, not implicitly in code.

## Open questions (each should become an ADR)

- [ ] OS: Raspberry Pi OS (best support for the AI camera) or Ubuntu?
- [ ] ROS 2 or not? (MoveIt for the arms and Nav2 for navigation, at the cost of complexity)
- [ ] Main language on the Pi: Python, C++, or both?
- [ ] How the Pi software modules communicate (ROS 2 topics, a local message bus, …).
- [ ] Pi ⇄ ESP32 link: UART (planned; the concept says UART/I2C) and the packet format.
- [ ] Does the ESP32-S3 or the Pi drive the motor driver?
- [ ] How AI work is split between the camera, the Pi and the server.
- [ ] Audio: ReSpeaker HAT or MAX98357A — they cannot share the I2S pins; see [hardware/README.md](../hardware/README.md).
