# Architecture overview

> Draft — refined through the ADRs in [decisions/](decisions/README.md).

```
              ┌──────────────── Raspberry Pi 5 — brain ────────────────┐
 Mic ──I2S──▶ │ voice: wake word, VAD, AEC, conversation               │
 Speaker ◀─── │ vision: AI camera (IMX500)                             │ ◀─ Wi-Fi ─▶ ai-robot-server
 Camera ─CSI▶ │ screen: the face on the 7" display (ui/)               │ ◀─ BLE ───▶ ai-robot-app
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
| `ai-robot-server` (later) | The core AI: speech recognition, conversation, voice, and probably moods; storage, device management, updates | Physical safety: the robot checks every call locally |
| `ai-robot-app` (later) | Pairing, settings, remote control | |

## Principles

- Pi first ([ADR-0004](decisions/0004-pi-software-first.md)): the Pi software is built before the rest, against simulated hardware.
- The Pi may hang or reboot at any time, so the body controller brings the robot to a safe state when the Pi's heartbeat is lost.
- The Pi ⇄ body protocol is defined once, in [`protocol/`](../protocol/body/README.md); so is the protocol between the Pi software and the screen ([`protocol/screen/`](../protocol/screen/README.md)).
- Software on the Pi is split into modules that talk only through messages, so each one can be added, replaced or removed without touching the others.
- Where heavy AI runs (camera, Pi or server) is decided in an ADR, not implicitly in code.

## Software on the Pi

Proposed in [ADR-0005](decisions/0005-pi-software-platform.md): one Python process (asyncio) with an optional C++ extension. Modules own the ports of the hardware they use; adapters implement the ports, simulated until the real parts exist. Details, and how to run and extend it: [`software/README.md`](../software/README.md).

```
modules    system · motion · voice · vision · screen · cloud · behavior
             │  talk to each other only through messages on the bus
             │  each one owns some ports
ports      audio_in · audio_out · camera · screen · cloud · daylight
           drive · joints · range · power · lights · safety
             │  implemented by
adapters   sim (any computer, CI)  |  real (on the robot), chosen per profile
```

Until the body controller exists, the body ports (`drive`, `joints`, `range`, `power`, `lights`, `safety`) stay simulated; then one adapter implements them over the link to the body controller.

The screen is the exception that is real already: the `screen` module decides what it shows (the expression, a scene such as the clock or the weather, the gaze, the battery), and a renderer page in [`ui/`](../ui/README.md), shown full screen by a browser, draws it and keeps the face alive on its own. They talk over the [screen protocol](../protocol/screen/README.md) (proposed in [ADR-0006](decisions/0006-screen-renderer.md)).

The `cloud` module links the robot to `ai-robot-server` over the [cloud protocol](../protocol/cloud/README.md). Its transport is WebRTC through a LiveKit server ([ADR-0009](decisions/0009-cloud-link-webrtc.md), in place of the WebSocket of [ADR-0007](decisions/0007-cloud-link-transport.md)), and its messages are proposed in [ADR-0008](decisions/0008-cloud-link-messages.md).
- **Capabilities.** The cloud drives the robot through MCP tools, which the modules offer on the bus: each module offers the capabilities of what it owns, such as the screen's expressions and scenes. The robot checks every call against the capability's schema and safety class.
- **Events.** Modules declare events, and the cloud subscribes to those it wants.
- **Conversations.** The module that holds them takes turns and plays the answers; the `cloud` module carries them, with their audio, over the link. That module will be `voice`, once it has a wake word.
- **Without a server.** A simulated cloud stands in for it.

## Open questions (each should become an ADR)

- [ ] OS, ROS 2 or not, language on the Pi, how its modules communicate — proposed in [ADR-0005](decisions/0005-pi-software-platform.md).
- [ ] Which microcontroller becomes the body controller ([ADR-0004](decisions/0004-pi-software-first.md)).
- [ ] Pi ⇄ body link (concept v0 shows UART/I2C) and the packet format.
- [ ] Does the body controller or the Pi drive the motor driver?
- [ ] How AI work is split between the camera, the Pi and the server. The core AI runs in the cloud; the robot ⇄ cloud link's requirements are drafted in [`protocol/cloud/requirements.md`](../protocol/cloud/requirements.md). The transport is WebRTC through LiveKit ([ADR-0009](decisions/0009-cloud-link-webrtc.md)), the robot proves its identity with a key in a TPM ([ADR-0010](decisions/0010-device-identity.md)), and the messages are proposed in [ADR-0008](decisions/0008-cloud-link-messages.md). Version 2.0 of the protocol is implemented on the robot, with tokens it makes for a development server; the token endpoint comes with the robot's identity. Updates and where moods live come next.
- [ ] Audio: ReSpeaker HAT or MAX98357A — they cannot share the I2S pins; see [hardware/README.md](../hardware/README.md).
- [ ] How the robot draws its screen — proposed in [ADR-0006](decisions/0006-screen-renderer.md): a renderer in a full-screen browser ([ui/](../ui/README.md)), driven by the Pi software over the [screen protocol](../protocol/screen/README.md).
