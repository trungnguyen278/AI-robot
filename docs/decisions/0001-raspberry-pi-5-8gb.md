# 0001 — Raspberry Pi 5 (8 GB) as the robot's brain

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

The previous generation ([Luni_Robot](../legacy.md), ESP32-S3 + ESP32-C5) hit hardware limits in several places:

- Camera: uploading one QVGA image took ~11 s (S3 → UART → C5 → WebSocket, ~2.5 KB/s).
- The ESP32-C5 has no PSRAM: growing a UART buffer to 40 KB broke the TLS handshake.
- The ESP32-S3 ran out of pins: native USB and the SD card were sacrificed, and buttons, I2C and the battery ADC moved to the C5.
- No on-device VAD: a voice turn started by the wake word only ended at a 30 s watchdog.
- Two MCUs meant two hand-synchronized copies of the state definitions, and no OTA path for the S3.

The new robot adds tracks, two arms, a 7" display and an AI camera — it needs a real Linux computer.

## Decision

Use a **Raspberry Pi 5 with 8 GB of RAM**.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Pi 5, 16 GB | Estimated memory use is ~1–1.5 GB with AI on the server and ~4–5.5 GB in a heavy local setup (on-device STT/TTS plus a small 1.5–4B LLM) — still within 8 GB. For local AI the Pi 5 is limited by memory bandwidth (32-bit LPDDR4X, ~17 GB/s theoretical), not capacity: a 7–8B LLM runs at only ~1.5–2 tokens/s, too slow for conversation even when it fits. The price gap is large: about $175 versus ~$300 at US list prices after the April 2026 increase. |
| Pi 5, 4 GB | Enough with AI on the server, but little headroom for offline STT/TTS or a small LLM. |
| Stay on ESP32 | Cannot handle the camera, vision, a large display or AI. |

## Consequences

- Positive: a CSI camera with on-sensor AI; one Linux system instead of two firmwares; spare memory for local processing.
- Negative / accepted trade-offs:
  - Power draw of ~3 W idle, ~9 W at full CPU load and 12–16 W with heavy peripherals (the old ESP32 pair drew under 1 W) — shorter battery life.
  - Needs active cooling and a clean shutdown on low battery (sudden power loss can corrupt the SD card), and boots slower than an ESP32.
  - Linux is not real-time, so servo and motor control belong to the ESP32-S3 ([ADR-0002](0002-esp32-s3-body-controller.md)).
- Follow-up: if more AI performance is needed, prefer accelerators (AI HAT+, models on the IMX500 camera) over more RAM.

## References

- Analysis of the Luni_Robot code (see [legacy.md](../legacy.md)).
- Pi 5 prices in 2026: [Tom's Hardware](https://www.tomshardware.com/raspberry-pi/component-shortages-drive-raspberry-pi-prices-up-by-up-to-23-percent-escalating-lpddr4-lpddr5-costs-trigger-the-third-price-hike-of-the-year), [Atomic Creations](https://atomiccreations.co/blogs/news/raspberry-pi-price-increase). The ~$300 figure for 16 GB comes from secondary sources only.
- Power draw: [raspberry.tips](https://raspberry.tips/en/?p=9083), [Jeff Geerling](https://www.jeffgeerling.com/blog/2024/new-2gb-pi-5-has-33-smaller-die-30-idle-power-savings/).
- Memory and LLM speed figures are community estimates, not measured here.
