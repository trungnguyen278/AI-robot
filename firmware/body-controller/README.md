# body-controller

> Deferred — the microcontroller is not chosen yet (concept v0 shows an ESP32-S3). Until it exists, the robot software uses simulated adapters ([ADR-0004](https://github.com/trungnguyen278/ai-robot-design/blob/main/decisions/0004-pi-first-hardware-abstraction.md)).

## Responsibilities

Implements the [robot-body contract](https://github.com/trungnguyen278/ai-robot-design/blob/main/interfaces/robot-body.md):

- Drive: motor driver and wheel encoders.
- Joints: neck and arm servos (unless the Pi drives the servo bus directly — an open question in the robot architecture).
- Range sensors, status lights, battery measurement.
- **Safety:** when the Pi's heartbeat is lost, stop the drive and bring the joints to their safe state.

## Out of scope

- Networking — it belongs to the Raspberry Pi 5.

## Link to the Pi

Transport not chosen yet; the machine-readable protocol lives in [`protocol/`](../../protocol/README.md). Pins: [`hardware/pinmap.md`](../../hardware/pinmap.md).
