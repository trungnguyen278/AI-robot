# Raspberry Pi 5 (8 GB)

> Last updated: 2026-10-15. Several entries rely on a copy of the product brief and on secondary sources (marked as such); re-check them against the official documentation.

- **Role in the robot:** the brain — audio, vision, face, networking, AI.
- **Exact model / variant:** Raspberry Pi 5, 8 GB RAM.
- **Quantity:** 1
- **Connected to:** 5 V DC-DC through the header; display (DSI), camera (CSI), ReSpeaker HAT (header), body controller (UART or USB, not chosen yet).

## Key specifications

| Parameter | Value | Source |
|---|---|---|
| SoC | Broadcom BCM2712, 4 × Arm Cortex-A76 @ 2.4 GHz; VideoCore VII GPU | Product brief |
| RAM | 8 GB LPDDR4X-4267 | Product brief |
| Wi-Fi / Bluetooth | 802.11ac 2.4/5 GHz; Bluetooth 5.0 / BLE — Infineon CYW43455 over SDIO | Product brief; wifidiving |
| USB | 2 × USB 3.0 + 2 × USB 2.0 | Product brief |
| Camera / display | 2 × 4-lane MIPI transceivers (22-pin connectors), each usable for a camera or a display | Product brief; Waveshare wiki |
| PCIe | PCIe 2.0 x1 (needs an M.2 HAT or adapter) | Product brief |
| Other | RTC (external battery on the J5 BAT connector, `/dev/rtc0`), power button, fan connector, 3-pin debug UART connector | Product brief; Waveshare wiki |
| Power input | 5 V / 5 A over USB-C with Power Delivery | Product brief |
| Header | 40 pins, 28 GPIOs from the RP1 I/O chip; **3.3 V logic, not 5 V tolerant** | CNX Software; zbotic |
| RP1 (whole chip) | 5 × UART, 6 × SPI, 4 × I2C, 2 × I2S (1 clock producer + 1 clock consumer), 4-channel PWM | CNX Software (RP1 datasheet summary) |
| Not present | 3.5 mm audio jack, ADC | Product brief (not listed) |

## Commonly used header pins

| Function | GPIO (physical pin) | Notes |
|---|---|---|
| I2C1 | 2 SDA (3), 3 SCL (5) | Enable with `dtparam=i2c_arm=on` |
| UART0 | 14 TX (8), 15 RX (10) | Full PL011 UART; the console lives on the separate debug connector. Secondary sources enable it with the `uart0-pi5` overlay — unverified |
| I2S / PCM | 18 BCLK (12), 19 LRCLK (35), 20 DIN (38), 21 DOUT (40) | **The only I2S pin group on the header**; enable with `dtparam=i2s=on` or the HAT's overlay |
| Hardware PWM | 12, 13, 18, 19 | 18/19 overlap with I2S |
| SPI0 | 7–11 | Enable with `dtparam=spi=on` |

## Power

| Item | Value | Source |
|---|---|---|
| Recommended supply | 5 V / 5 A USB-C PD (27 W) | Product brief |
| USB current limit | 3 A supply → ~600 mA total for all USB ports; 5 A PD supply → ~1.6 A | White paper RP-009856 |
| Lifting the limit | `usb_max_current_enable=1` (`config.txt`) or `PSU_MAX_CURRENT=5000` (EEPROM, `sudo rpi-eeprom-config --edit`) — only with a genuine 5 A supply | Secondary sources (Waveshare, forums) |
| Powered through the 5 V header pins | No PD negotiation → likely treated as a supply below 5 A | Inference — to be tested |
| Measured power draw | ~3 W idle (headless, Wi-Fi); ~8.8–9.8 W at full CPU load; 12–16 W with NVMe, video or accelerators | raspberry.tips; Jeff Geerling |
| When halted | ~1.2–1.6 W by default; `POWER_OFF_ON_HALT=1` (EEPROM) → ~0.01 W, may upset some HATs | Jeff Geerling |

## Thermals

- Soft throttling starts around 80 °C and hard throttling around 85 °C. *(secondary sources)*
- Active Cooler fan curve: 0 % below 50 °C → 30 % at 50 °C → 50 % at 60 °C → 70 % at 67.5 °C → 100 % at 75 °C, with 5 °C hysteresis. *(secondary sources)* In a 52Pi test it held the CPU around 60 °C at full load.

## Software

- **OS:** 64-bit Raspberry Pi OS, currently based on Debian 13 "Trixie" (latest image seen: 2026-04-21, kernel 6.12). Re-check at install time.
- **GPIO:** `RPi.GPIO` **does not work** on the Pi 5 (GPIO lives on the RP1). Use `gpiozero` (with the `lgpio` backend), `lgpio` or `libgpiod`; `rpi-lgpio` runs legacy RPi.GPIO code.
- **gpiochip numbering:** the header used to be `gpiochip4`; newer kernels add a `gpiochip0` alias → never hard-code it, use `gpiodetect`/`gpioinfo`.
- **Camera:** libcamera, Picamera2, rpicam-apps.

## AI performance (estimates, see ADR-0001 in ai-robot-design)

- Theoretical memory bandwidth is ~17 GB/s (LPDDR4X-4267 on a 32-bit bus), so local LLMs run at roughly 1.5–2 tokens/s for 7–8B models, 4–6 tokens/s for 3B and 8–12 tokens/s for 1.5B. Community figures, not measured here.

## Notes for this robot

- Powered from the 5 V DC-DC through the header → see Power; never power servos or motors from the Pi's 5 V rail.
- A metal chassis can weaken Wi-Fi → fallback: a USB Wi-Fi adapter with an external antenna.
- Sudden power loss can corrupt the SD card → shut down cleanly on low battery; consider a read-only/overlay root filesystem or NVMe.

## References (retrieved 2026-10-15)

- [Raspberry Pi 5 product brief](https://cdn.sparkfun.com/assets/9/9/0/d/e/raspberry-pi-5-product-brief.pdf)
- [RP1 datasheet summary — CNX Software](https://cnx-software.com/2023/10/07/raspberry-pi-rp1-datasheet-block-diagram/)
- [USB Power Delivery on Raspberry Pi 5 — white paper RP-009856](https://pip-assets.raspberrypi.com/categories/685-app-notes-guides-whitepapers/documents/RP-009856-WP-1-USB%20Power%20delivery%20on%20Raspberry%20Pi%205.pdf)
- [Raspberry Pi 5 — Waveshare wiki](https://waveshare.com/wiki/Raspberry_Pi_5)
- [Raspberry Pi power consumption — raspberry.tips](https://raspberry.tips/en/?p=9083)
- [New 2GB Pi 5 — Jeff Geerling](https://www.jeffgeerling.com/blog/2024/new-2gb-pi-5-has-33-smaller-die-30-idle-power-savings/)
- [Reducing Raspberry Pi 5's power consumption by 140x — Jeff Geerling](https://www.jeffgeerling.com/blog/2023/reducing-raspberry-pi-5s-power-consumption-140x/)
- [Raspberry Pi 5 in-built Wi-Fi](https://wifidiving.substack.com/p/raspberry-pi-5-in-built-wifi)
- [raspberrypi/linux PR #6144 — gpiochip alias](https://github.com/raspberrypi/linux/pull/6144)
- [RPi.GPIO alternatives on the Pi 5 — raspberry.tips](https://raspberry.tips/en/raspberrypi-tutorials/raspberry-pi-5-gpio-rpigpio-not-working-alternatives)
- [Raspberry Pi UART — zbotic](https://zbotic.in/raspberry-pi-uart-serial-communication-with-sensors/)
- [I2S / PCM pins — pinout.xyz](https://pinout.xyz/pinout/pcm)
- [Active Cooler fan curve — SunFounder docs](https://docs.sunfounder.com/projects/pironman5/en/latest/hardware/fans.html)
- [Raspberry Pi OS downloads](https://www.raspberrypi.com/software/operating-systems/)
