# 0002 — ESP32-S3 as body controller for real-time I/O only

- **Status:** Superseded by [0004](0004-pi-software-first.md)
- **Date:** 2026-10-15

## Context

- Linux on the Pi 5 is not real-time, while counting encoder pulses, driving the servo bus and stopping in an emergency all need predictable latency.
- The body has 8 STS3215 bus servos, 2 MG540 motors with encoders, a VL53L1X ToF sensor and NeoPixel LEDs.
- **The Pi 5 has built-in Wi-Fi (802.11ac, 2.4/5 GHz) and Bluetooth 5.0/BLE** (Infineon CYW43455), so no ESP is needed as a network card.

## Decision

Use an **ESP32-S3** (ESP32-S3-DevKitC-1) as the **body controller**: servos, motors and encoders, sensors, LEDs, battery voltage and a safety watchdog. The Pi 5 handles networking (Wi-Fi/BLE), AI, audio, vision and the face. They communicate through the protocol in [`protocol/`](../../protocol/README.md).

## Alternatives considered

| Alternative | Why not |
|---|---|
| ESP as the Pi's Wi-Fi card | The Pi 5 already has Wi-Fi and BLE. If the metal chassis weakens the signal, a USB Wi-Fi adapter with an external antenna is far simpler than bridging the network through an ESP. |
| Pi drives everything directly | Not real-time; the half-duplex servo bus and the encoders misbehave when Linux is busy, and the robot is unsafe if the Pi hangs. |
| Another MCU (RP2040/RP2350, STM32) | Viable. The ESP32-S3 was chosen because the previous generation's ESP-IDF code and tooling carry over and its peripherals are sufficient (PCNT for encoders, RMT for NeoPixel, several UARTs). |

## Consequences

- Positive: stable control; the robot stops safely if the Pi hangs or reboots; ESP-IDF code and tooling from the previous generation carry over.
- Negative / accepted trade-offs: one more firmware codebase and a protocol to keep consistent — hence a single definition in `protocol/` (the previous generation hand-synchronized two copies of `StateTypes`).
- Follow-up: decide the protocol format and the physical link (UART planned) in an ADR.

## References

- Pi 5 Wi-Fi/BLE: [product brief](https://cdn.sparkfun.com/assets/9/9/0/d/e/raspberry-pi-5-product-brief.pdf), [CYW43455 on the Pi 5](https://wifidiving.substack.com/p/raspberry-pi-5-in-built-wifi).
- Concept v0: [`hardware/images/concept-v0.webp`](../../hardware/images/concept-v0.webp).
