# 0011 — Audio: a USB voice processor that hears past the robot's own voice

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

- What the robot must do with sound ([vision](../vision.md), [cloud requirements](https://github.com/trungnguyen278/ai-platform/blob/main/protocols/cloud/requirements.md)):
  - hear a wake word, and a person a few metres away, over its own motors and tracks;
  - be interrupted while it speaks (barge-in, PERF-3), which needs acoustic echo cancellation (AEC): the robot must remove its own voice from what its microphones hear;
  - turn its head towards whoever speaks, which a microphone array can estimate (direction of arrival, DoA);
  - send speech at 16 kHz or more (PERF-4), and have a mute that cuts the microphones (PRIV-1).
- Concept v0 planned the ReSpeaker 2-Mics Pi HAT V2.0 and a MAX98357A amplifier. That plan has three problems:
  - both need the header's only I2S pin group ([open issue 1](../../hardware/README.md#open-issues));
  - the HAT drives its three APA102 LEDs from SPI0's data and clock pins (GPIO10 and GPIO11), and APA102 LEDs have no chip select, so they take in whatever else SPI0 carries. The TPM of [ADR-0010](0010-device-identity.md) needs SPI0, on pins 17 to 26, under the HAT;
  - the HAT has two microphones and no echo cancellation.
- An echo canceller subtracts what the loudspeaker plays from what the microphones hear, so it needs that signal (the reference), in step with the microphones:
  - the XVF3800 plays the host's audio out of its own DAC and takes the same left channel as its reference;
  - cancelling in software instead, with WebRTC's audio processing (which LiveKit's SDK includes as `AudioProcessingModule`), needs the delay between playing and capturing set by hand (`set_stream_delay_ms`). XMOS warns, for its own chip, that a reference delay that changes while running severely degrades cancellation.
- How others do it:

| Product | Audio front end |
|---|---|
| Reachy Mini (Pollen Robotics, Hugging Face) | A 4-microphone array on Seeed's reSpeaker XMOS XVF3800 and a 5 W 4 Ω speaker. Echo cancellation is on by default; the direction of a voice is read from the array. |
| Mycroft Mark II | Its XMOS voice processor became the sound card for both recording and playback. |
| Home Assistant Voice Preview Edition | An XMOS XU316 for echo cancellation, noise suppression and gain control; a mute switch that physically cuts the microphones' power. |

## Decision

1. **The robot hears through one USB voice processor: Seeed's reSpeaker XMOS XVF3800**, a circular array of four microphones, in the version without a XIAO board, which ships with the USB firmware.
   - The XVF3800 cancels the echo, forms beams, suppresses noise and reverberation, and sets the gain. The Pi receives processed speech at 16 kHz over USB Audio Class 2.0, with no driver.
   - It estimates the direction of a voice, which the Pi reads over USB to turn the head.
2. **The robot speaks through the same array.** The Pi plays to it over USB, and its amplifier, an LM48511, drives a 4 Ω, 5 W speaker. The echo canceller always has the reference.
   - The array and the speaker sit on the same part of the robot, so that the neck's movements do not change the path from speaker to microphones: moving the loudspeaker makes the canceller start over.
3. **The header carries no audio.** The ReSpeaker HAT and the MAX98357A leave the plan, which closes open issue 1 and leaves SPI0 to the TPM.
4. **The array takes its power over USB, budgeted on the 5 V rail.** Seeed documents only the USB-C port, for power and data. At full power the amplifier gives 5.4 W into 4 Ω at 80 % efficiency, about 1.35 A from 5 V. That is more than the Pi's USB ports supply when the Pi is powered through the header (about 600 mA, open issue 4). The array's draw at the robot's speaking volume is measured first. Then either the Pi's USB limit is raised, with a supply that really delivers 5 A, or the array's USB power comes from the 5 V rail through a power injector.
5. **The mute is the array's mute button**, which mutes the microphones in the voice processor.

## Alternatives considered

| Alternative | Why not |
|---|---|
| The ReSpeaker 2-Mics Pi HAT V2.0 of concept v0, with echo cancellation in software | It takes the header's only I2S pins, which the amplifier also needs, and drives its LEDs from SPI0, which the TPM needs. Two microphones give no beams and no direction. Cancelling in software needs a delay that stays fixed between two separate audio paths. |
| I2S MEMS microphones and the MAX98357A, sharing the I2S pins, with WebRTC's audio processing in software | Cheap, and one I2S clock for both keeps them in step, which suits cancellation. But one stereo input gives two microphones, so no direction; all the processing runs on the Pi; and cancellation and noise suppression with the motors running are unproven. |
| Seeed's ReSpeaker Lite: an XMOS XU316 and two microphones, on USB | The same kind of front end, smaller (35 × 86 mm), from the XMOS family of Home Assistant Voice. But two microphones reach 3 m instead of 5 m, and its documentation mentions neither beamforming nor direction of arrival, so the head could not turn towards a voice. |

## Consequences

- Positive:
  - barge-in rests on hardware echo cancellation that a comparable robot ships with;
  - beamforming and noise suppression against the robot's own motors, and the direction of a voice for the head;
  - no audio on the header: no I2S conflict, and SPI0 free for the TPM;
  - one USB device of a standard class, with no driver.
- Negative / accepted trade-offs:
  - cost: $60.99 at Seeed, against a few dollars for discrete microphones;
  - size: 108 × 108 × 18 mm, which the head or the body must make room for, with the microphones' openings clear;
  - the processing is XMOS's closed firmware. The Pi gets two processed channels, or two raw microphones at a time, never all four;
  - the mute works inside the voice processor; it does not cut the microphones' power, as Home Assistant Voice's switch does;
  - full volume needs power beyond what the Pi's USB gives by default;
  - the canceller takes a few seconds to converge after a restart, and over-suppresses speech meanwhile.
- Follow-up:
  - a hardware change: the array and a 5 W speaker into the BOM, the HAT and the MAX98357A out, the power budget, and where the array and the speaker sit; then the TPM on SPI0;
  - the voice module: wake word and voice activity on the processed speech, playback through the array, the direction of a voice for the head;
  - on the robot: measure cancellation and wake words with the motors and servos running.

## References

Retrieved 2026-10-22:

- reSpeaker XMOS XVF3800: [Seeed wiki](https://wiki.seeedstudio.com/respeaker_xvf3800_introduction/) (microphones, LM48511 amplifier, LED ring, mute button, USB firmware by default without XIAO), [Seeed store](https://www.seeedstudio.com/ReSpeaker-XVF3800-USB-Mic-Array-p-6488.html) ($60.99), [The Pi Hut](https://thepihut.com/products/respeaker-xmos-xvf3800-ai-powered-4-mic-array-for-clear-voice-even-in-noise) (108 × 108 × 18 mm).
- [XMOS XVF3800 user guide](https://www.xmos.com/documentation/XM-014888-PC/pdf/xvf3800_user_guide_v3.2.1.pdf), v3.2.1: the left channel as the AEC reference (§2.4.1) and the far end played out of the DAC (§2.5.1), convergence and moving the loudspeaker (§2.5.4), a constant delay on the reference (§4.1.1).
- [TI LM48511 datasheet](https://www.ti.com/document-viewer/LM48511/datasheet) (SNAS416K): 5.4 W into 4 Ω at 5 V, 80 % efficiency.
- Reachy Mini: [hardware](https://wiki.seeedstudio.com/reachymini_platforms_reachy_mini_hardware/) and [media controls](https://wiki.seeedstudio.com/reachymini_platforms_reachy_mini_media_advanced_controls/) (echo cancellation by default, direction of arrival, stereo output).
- Mycroft Mark II: [update of October 2020](https://community.openconversational.ai/t/mark-ii-update-october-2020/9688).
- [Home Assistant Voice Preview Edition](https://www.home-assistant.io/voice-pe/).
- [ReSpeaker Lite](https://wiki.seeedstudio.com/reSpeaker_usb_v3/).
- ReSpeaker 2-Mics Pi HAT V2.0 pins: [BeagleY-AI pinout](https://pinout.beagleboard.io/pinout/respeaker_2_mics_phat).
- LiveKit's Python SDK, `rtc.AudioProcessingModule` (livekit 1.1.21): `process_reverse_stream` and `set_stream_delay_ms`.
