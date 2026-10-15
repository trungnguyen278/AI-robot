# Pololu D24V90F5 — 5 V step-down regulator

> Last updated: 2026-10-15.

- **Role in the robot:** produces the 5 V rail for the Pi 5 and peripherals from the 3S battery.
- **Exact model / variant:** Pololu D24V90F5 (item #2866).
- **Quantity:** 1
- **Connected to:** the 3S battery (after the fuse and emergency stop) → 5 V rail.

## Key specifications

| Parameter | Value | Source |
|---|---|---|
| Input voltage | 5–38 V; in practice ≥ 5 V plus a 0.5–1.5 V dropout that grows with load; undervoltage lockout ~4.2 V | Pololu |
| Output voltage | 5 V | Pololu |
| Output current | "~9 A" (headline); typical continuous 4–8 A depending on input voltage and cooling | Pololu |
| Efficiency | 80–95 % | Pololu |
| Protection | Reverse voltage, short circuit, thermal shutdown (~160 °C), soft start | Pololu |

## Notes for this robot

- A 3S pack (9.0–12.6 V depending on charge) sits comfortably inside the input range.
- Do not design around 9 A: the Pi 5 (up to 5 A under heavy load with USB) plus display, HAT, amplifier, body controller and LEDs → keep a power budget in [`hardware/README.md`](../README.md) with headroom.

## References (retrieved 2026-10-15)

- [Pololu — D24V90F5](https://www.pololu.com/product/2866)
