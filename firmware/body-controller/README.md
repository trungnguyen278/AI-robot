# body-controller (ESP32-S3)

> Empty — the role is defined in [ADR-0002](../../docs/decisions/0002-esp32-s3-body-controller.md).

## Responsibilities

- STS3215 servo bus × 8 (neck 2 + arms 3 + 3) — half-duplex, needs an adapter.
- MG540 motors × 2: drive the motor driver and read the encoders (PCNT planned).
- VL53L1X (I2C) and NeoPixel LEDs (RMT planned).
- Battery voltage (ADC + voltage divider).
- **Safety:** if the Pi's heartbeat is lost beyond a threshold, stop the motors and bring the servos to a safe state.

## Out of scope

- The ESP32-S3's Wi-Fi and BLE stay unused — networking belongs to the Pi 5.

## Link to the Pi

UART (planned), using the protocol defined in [`protocol/`](../../protocol/body/README.md). Pins: [`hardware/pinmap.md`](../../hardware/pinmap.md).
