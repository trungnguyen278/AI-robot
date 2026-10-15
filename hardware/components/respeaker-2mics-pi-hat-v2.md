# ReSpeaker 2-Mics Pi HAT V2.0

> Last updated: 2026-10-15.

- **Role in the robot:** voice capture (2 microphones), optionally speaker output.
- **Exact model / variant:** ReSpeaker 2-Mics Pi HAT **V2.0**.
- **Quantity:** 1
- **Connected to:** the Pi 5 40-pin header (I2S + I2C).

## Key specifications

| Parameter | Value | Source |
|---|---|---|
| Codec | TLV320AIC3104 (V2.0 replaces the WM8960 of V1) | Product datasheet (DigiKey) |
| Pi 5 support | Yes (thanks to the new codec) | Product datasheet (DigiKey) |
| Sample rate | 8–96 kHz | Product datasheet (DigiKey) |
| Outputs | JST 2.0 speaker connector + 3.5 mm jack | BeagleY-AI pinout |
| Power | Micro USB connector; extra power recommended when driving a speaker | BeagleY-AI pinout |

## Notes for this robot

- Takes the Pi's only I2S pin group (GPIO18–21) → it cannot be used alongside the MAX98357A in the usual way. Pick one: use the HAT's speaker output (check it can drive the 4 Ω 3 W speaker) or drop the HAT.
- Only 2 microphones and no hardware echo cancellation → hard to interrupt the robot by voice while it speaks, and motor and track noise reaches the microphones. Options: software AEC (WebRTC APM, speexdsp) or a USB microphone array with hardware AEC.
- The codec's I2C address is unverified.

## References (retrieved 2026-10-15)

- [ReSpeaker 2-Mics Pi HAT V2.0 — datasheet (DigiKey)](https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/8891/107100001_1.pdf)
- [ReSpeaker 2-Mics pHAT — BeagleY-AI pinout](https://pinout.beagleboard.io/pinout/respeaker_2_mics_phat)
