# Waveshare 7inch DSI LCD (C)

> Last updated: 2026-10-15.

- **Role in the robot:** the face — shows the eyes and expressions.
- **Exact model / variant:** Waveshare 7inch DSI LCD **(C)**.
- **Quantity:** 1
- **Connected to:** the Pi 5 DSI port.

## Key specifications

| Parameter | Value | Source |
|---|---|---|
| Panel | 7" IPS, 1024×600 | Waveshare |
| Touch | 5-point capacitive | Waveshare |
| Support | Pi 5/4B/CM4/3B+/…; Raspberry Pi OS | Waveshare |
| Pi 5 connection | "DSI-Cable-12cm" ribbon into the 22-pin DSI port; 5 V power; touch over I2C (per the wiki) | Waveshare wiki |
| Current draw | unverified | — |

## Notes for this robot

- Take the `dtoverlay` line from the wiki page of the exact (C) version — the older 800×480 7" panel uses a different overlay.
- The display sits on the 2-DOF neck → include its weight (unverified) in the neck servo torque budget.

## References (retrieved 2026-10-15)

- [Waveshare wiki — 7inch DSI LCD (C)](https://www.waveshare.com/wiki/7inch_DSI_LCD_(C))
- [Product page](https://www.waveshare.com/product/raspberry-pi/7inch-dsi-lcd-c.htm)
