# reSpeaker XMOS XVF3800 USB 4-Mic Array

> Component note, created with the `hardware-change` checklist. Last updated: 2026-10-23. Chosen in [ADR-0011](../../docs/decisions/0011-audio-voice-processor.md).

- **Role in the robot:** its ears and its voice.
  - The XVF3800 cleans up what the four microphones hear: echo cancellation, beamforming and noise suppression.
  - It estimates the direction of a voice.
  - Its amplifier drives the speaker.
- **Exact model / variant:** Seeed reSpeaker XMOS XVF3800 USB 4-Mic Array, circular, **without** the XIAO ESP32S3. That version ships with the USB firmware; the XIAO version ships with the I2S firmware.
- **Quantity:** 1
- **Connected to:** a USB port of the Pi 5, for power and data; the speaker on its JST connector.

## Key specifications

| Parameter | Value | Source |
|---|---|---|
| Voice processor | XMOS XVF3800: echo cancellation, gain control, direction of arrival, voice activity, dereverberation, beamforming, noise suppression | Seeed store; Seeed wiki |
| Microphones | 4 PDM MEMS, in a circle; −26 dBFS sensitivity, 64 dBA SNR, 120 dBL acoustic overload point | Seeed wiki; The Pi Hut |
| Pickup | 360°, up to 5 m | Seeed wiki |
| Host interface | USB-C, USB Audio Class 2.0, for power and data; no driver on Raspberry Pi OS | Seeed wiki |
| Firmware images | 16 kHz with 2 channels, 16 kHz with 6 channels, 48 kHz with 2 channels | Seeed wiki |
| Channels to the host | Each output channel is chosen among processed beams, single microphones and the echo reference (`AUDIO_MGR_OP_L`, `AUDIO_MGR_OP_R`), so never all four raw microphones at once | XMOS user guide §3.6.1, §4.2.2; Seeed wiki (Reachy Mini) |
| Echo reference | The left channel of what the host plays, which is also what the DAC plays | XMOS user guide §2.4.1, §2.5.1 |
| Amplifier | TI LM48511, class D with a boost converter: 5.4 W into 4 Ω at 5 V (1 % THD+N), 80 % efficiency, 13.5 mA quiescent | Seeed wiki; TI datasheet |
| Outputs | JST speaker connector, for "5W amplified speakers" (connector series **unverified**); 3.5 mm jack | Seeed wiki |
| Other | 12 × WS2812 RGB LEDs; a mute button; XMOS GPIOs for the mute LED and microphone mute (X0D30), amplifier enable (X0D31), LED power (X0D33) | Seeed wiki |
| Power | Through the USB-C port. The Pi Hut also lists an external 5 V input, which Seeed does not mention: **unverified** | Seeed wiki; The Pi Hut |
| Current | Not published. The amplifier alone needs about 1.35 A from 5 V at full power (5.4 W ÷ 0.8 ÷ 5 V): **inference** | TI datasheet |
| Size | 108 × 108 × 18 mm | The Pi Hut |
| Price | $60.99 at Seeed, in stock; £52.80 at The Pi Hut, sold out (2026-10-22) | Seeed store; The Pi Hut |

## Pins and wiring

- USB-C to a USB port of the Pi 5. Nothing on the 40-pin header.
- A 4 Ω, 5 W speaker on the JST connector.

## Notes for this robot

- The robot's voice plays through the array and nothing else, so that the echo canceller has its reference (ADR-0011).
- The array and the speaker sit on the same part of the robot: moving the loudspeaker makes the canceller start over (XMOS user guide §2.5.4).
- After a restart the canceller takes a few seconds to converge, and suppresses speech too much meanwhile (§2.5.4).
- At full volume the array needs more current than the Pi's USB ports give by default: [open issue 10](../README.md#open-issues).
- The direction of a voice is read with the XMOS control commands, such as `DOA_VALUE`, through Seeed's `xvf_host` tool or its protocol over USB (XMOS user guide §3.5.2).

## Open questions

- Does the mute GPIO (X0D30, "mic mute control") cut the microphones in hardware, or only inside the voice processor? PRIV-1 asks for a mute that cuts them.
- The array's current at the robot's speaking volume, and at full volume.
- The series of the speaker's JST connector.

## References (retrieved 2026-10-22)

- [Getting started with reSpeaker XVF3800 — Seeed wiki](https://wiki.seeedstudio.com/respeaker_xvf3800_introduction/)
- [reSpeaker XMOS XVF3800 — Seeed store](https://www.seeedstudio.com/ReSpeaker-XVF3800-USB-Mic-Array-p-6488.html)
- [ReSpeaker XMOS XVF3800 — The Pi Hut](https://thepihut.com/products/respeaker-xmos-xvf3800-ai-powered-4-mic-array-for-clear-voice-even-in-noise)
- [XVF3800 user guide v3.2.1 — XMOS](https://www.xmos.com/documentation/XM-014888-PC/pdf/xvf3800_user_guide_v3.2.1.pdf)
- [LM48511 datasheet, SNAS416K — TI](https://www.ti.com/document-viewer/LM48511/datasheet)
- [Reachy Mini media controls — Seeed wiki](https://wiki.seeedstudio.com/reachymini_platforms_reachy_mini_media_advanced_controls/)
