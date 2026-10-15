# VL53L1X — time-of-flight distance sensor

> Last updated: 2026-10-15.

- **Role in the robot:** measures the distance ahead for obstacle avoidance.
- **Exact model / variant:** VL53L1X on a breakout board (board not chosen yet).
- **Quantity:** 1
- **Connected to:** the body controller over I2C.

## Key specifications

| Parameter | Value | Source |
|---|---|---|
| Range | Up to 400 cm, up to 50 Hz ranging | ST datasheet |
| Field of view | 27° (can be narrowed with a ROI) | ST datasheet |
| I2C address | 0x29 by default, changeable (use XSHUT when several sensors share a bus) | Breakout listings |
| Supply | 2.8 V for the bare chip; breakouts usually add a regulator and level shifting (e.g. the Pololu carrier accepts 2.6–5.5 V) — board-dependent | ST datasheet; Pololu |

## Notes for this robot

- Check the actual breakout: its supply range and whether it already has I2C pull-ups.

## References (retrieved 2026-10-15)

- [VL53L1X datasheet](https://www.makerguides.com/wp-content/uploads/2024/10/VL53L1X-Datasheet.pdf)
- [Pololu VL53L1X carrier](https://pololu.com/product/3415/specs)
