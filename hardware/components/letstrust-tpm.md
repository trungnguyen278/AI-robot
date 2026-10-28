# LetsTrust TPM (Infineon OPTIGA TPM SLB 9672)

> Component note, created with the `hardware-change` checklist. Last updated: 2026-10-23. The TPM is required by [ADR-0010](../../docs/decisions/0010-device-identity.md); this module is proposed.

- **Role in the robot:** it holds the robot's identity key, which never leaves the chip, and signs the assertions that get the robot its tokens (ADR-0010). It also seals the robot's other secrets.
- **Exact model / variant:** LetsTrust TPM by pi3g, with Infineon's OPTIGA TPM SLB 9672, a TPM 2.0. Retailers give firmware 15.23 or later; the values below come from the datasheet for firmware 16.x, so check the delivered part (`tpm2_getcap properties-fixed`).
- **Quantity:** 1
- **Connected to:** the Pi 5's SPI0 with chip select CE1, on header pins 17 to 26, raised over the Active Cooler by a stacking header.

## Key specifications

| Parameter | Value | Source |
|---|---|---|
| Chip | Infineon OPTIGA TPM SLB 9672, TPM 2.0 (TCG library family 2.0, revision 1.59) | The Pi Hut; buyzero; Infineon datasheet |
| Supply | 3.0–3.6 V, or 1.65–1.95 V; absolute maximum 4.1 V | Infineon datasheet, tables 7 and 8 |
| Current | At most 35 mA active; 120 µA asleep, after 50 ms without a command | Infineon datasheet, table 9 |
| Interface | SPI mode 0 only, up to 34.65 MHz (33 MHz typical). RST# is active low, with a weak pull-up; PIRQ# is open drain, without one | Infineon datasheet, tables 3 and 14 |
| Keys | ECC NIST P-256, BN P-256 and NIST P-384; RSA up to 4096 bits; endorsement keys with certificates for RSA 2048, RSA 3072, ECC P-256 and ECC P-384 | Infineon datasheet |
| Memory | 51 kB of NV memory; up to 7 persistent and 3 loaded transient objects | Infineon datasheet |
| Certification | Common Criteria EAL4+ (AVA_VAN.4); FIPS 140-2 level 2 targeted | Infineon datasheet |
| Temperature | −40 to 85 °C (SLB 9672XU2.0) | Infineon datasheet |
| Linux | The `tpm-slb9670` overlay: the `tpm_tis_spi` driver on SPI0, CE1, at 32 MHz, with no reset or interrupt line | Raspberry Pi overlay README and source |
| Header | 2 × 5 pins, from pin 17 to pin 26 | The Pi Hut; buyzero |
| Reset | GPIO24, pulled low to reset the chip (LetsTrust's script, for development only) | LetsTrust repository |
| Raspberry Pi 5 | Supported; with a standard cooler it needs a stacking header | buyzero |
| Price | €25.00 at buyzero, pi3g's shop; £25.90 at The Pi Hut (2026-10-22) | buyzero; The Pi Hut |

## Pins and wiring

| Header pin | Pi 5 | TPM |
|---|---|---|
| 17 | 3.3 V | VDD |
| 18 | GPIO24 | RST# |
| 19 | GPIO10, SPI0 MOSI | MOSI |
| 20 | GND | GND |
| 21 | GPIO9, SPI0 MISO | MISO |
| 22 | GPIO25 | covered by the module; whether it is connected is **unverified** |
| 23 | GPIO11, SPI0 SCLK | SCLK |
| 24 | GPIO8, SPI0 CE0 | covered by the module, not the TPM's chip select |
| 25 | GND | GND |
| 26 | GPIO7, SPI0 CE1 | CS# |

- In `config.txt`: `dtoverlay=tpm-slb9670`. The kernel then offers `/dev/tpm0` and `/dev/tpmrm0`; the robot uses `/dev/tpmrm0`, through the kernel's resource manager.

## Notes for this robot

- Nothing else on SPI0 may listen without a chip select. That is why the ReSpeaker 2-Mics HAT, whose LEDs sit on SPI0's data and clock, leaves the plan in [ADR-0011](../../docs/decisions/0011-audio-voice-processor.md).
- The overlay drives neither reset nor interrupt. Leave GPIO24 as an input, which the chip's pull-up keeps high, and use neither GPIO24 nor GPIO25 for anything else.
- A factory reset clears the TPM's owner hierarchy, which destroys the robot's key and the secrets it sealed (ADR-0010).
- What the robot keeps there, through its `tpm` adapter (`software/src/ai_robot/adapters/tpm/`):
  - its key, a primary key of the owner hierarchy that the TPM derives from its seed at every start, so no persistent slot is used;
  - its identifier, in the owner's NV index 0x01800100, written once and then locked.
- The user who runs the robot needs access to `/dev/tpmrm0`, through the `tss` group.

## Open questions

- Is GPIO25 (pin 22) wired, for instance to PIRQ#?
- The firmware version of the delivered part.
- How the module is held against the chassis' vibration: [open issue 12](../README.md#open-issues).

## References (retrieved 2026-10-22)

- [LetsTrust TPM — buyzero (pi3g)](https://buyzero.de/products/letstrust-hardware-tpm-trusted-platform-module)
- [LetsTrust TPM for Raspberry Pi — The Pi Hut](https://thepihut.com/products/letstrust-tpm-for-raspberry-pi)
- [OPTIGA TPM SLB 9672 TPM2.0 data sheet, revision 1.1, 2023-04-27 — Infineon (via DigiKey)](https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/7160/SLB9672XU20FW1612XTMA1.pdf)
- [Overlay README](https://github.com/raspberrypi/linux/blob/rpi-6.12.y/arch/arm/boot/dts/overlays/README) and [`tpm-slb9670-overlay.dts`](https://github.com/raspberrypi/linux/blob/rpi-6.12.y/arch/arm/boot/dts/overlays/tpm-slb9670-overlay.dts) — raspberrypi/linux, branch rpi-6.12.y
- [`TPM_reset_with_GPIO.sh` — LetsTrust repository](https://github.com/PaulKissinger/LetsTrust/blob/master/Scripts/TPM_reset_with_GPIO.sh)
