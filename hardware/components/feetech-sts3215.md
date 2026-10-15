# FEETECH STS3215 — bus servo

> Last updated: 2026-10-15. Sources are mostly shop listings → re-check against the Feetech datasheet when available.

- **Role in the robot:** 2-DOF neck and 3-DOF per arm.
- **Exact model / variant:** the **12 V** version (ST-3215-C018, "30 kg·cm"). The STS3215 name is also used for a 6–8.4 V version (19.5 kg·cm) — **never feed that one 12 V**.
- **Quantity:** 8
- **Connected to:** the ESP32-S3 through a half-duplex servo bus adapter; 12 V servo branch.

## Key specifications

| Parameter | 12 V version | 7.4 V version | Source |
|---|---|---|---|
| Voltage | 4–14 V (nominal 12 V) | 6–7.4 V (nominal 7.4 V) | RobotShop; Eckstein |
| Stall torque | 30 kg·cm at 12 V | 19.5 kg·cm at 7.4 V | RobotShop; Sigmanortec |
| Stall current | 2.7 A at 12 V | 2.0 A at 6 V | RobotShop; Eckstein |
| No-load current | 180 mA | — | RobotShop |
| No-load speed | 0.222 s/60° | — | RobotShop |
| Encoder | Magnetic, 12-bit: 4096 steps per 360° | (shared) | Several sources |
| Interface | **Half-duplex** TTL serial, 38400 bps – 1 Mbps, IDs 0–253 | (shared) | RobotShop |
| Feedback | Position, speed, voltage, current, load | (shared) | Several sources |
| Size / weight | 45.2 × 24.7 × 35 mm, ~55 g | (shared) | Several sources |

## Notes for this robot

- Single-wire half-duplex → **do not wire the ESP32 TX/RX directly**; use a bus servo adapter or a tri-state buffer (e.g. 74HC126) with a direction pin.
- 8 servos × 2.7 A stall = **~21.6 A** if they all stall at once → the servo branch needs its own fuse, adequately sized wiring and a supply that can handle the peaks. Real-world current is usually far lower, but protection must be designed for the worst case.
- The STS3215 is also the servo used by the SO-100/SO-101 arms of the LeRobot project — a useful reference if the arms are redesigned.

## References (retrieved 2026-10-15)

- [RobotShop — FeeTech 12V 30kg.cm STS3215](https://uk.robotshop.com/products/feetech-12v-30kgcm-magnetic-encoding-servo-sts3215)
- [Eckstein — STS3215 / ST-3215-C018](https://eckstein-shop.de/Motors?mf=1602)
- [Eckstein — STS3215, 7.4 V version](https://eckstein-shop.de/Motors?mf=1611)
- [Sigmanortec — STS3215, 7.4 V](https://sigmanortec.ro/en/servo-smart-serial-sts3215-360-degrees-19kg-12-bit-encoder-74v)
