# 0013 — Listening on the robot: microWakeWord, Silero VAD, and PipeWire

- **Status:** Accepted
- **Date:** 2026-10-23
- **Amended by:** [ADR-0018](0018-conversations.md): the wake word opens a conversation of many turns, not a single turn

## Context

- What the robot must hear on its own, without the cloud:
  - its wake word, to start a turn (PERF-1: the listening face within 200 ms);
  - voice, for barge-in and for the fallbacks of [ADR-0012](0012-end-of-speech.md).
- It hears through the voice processor of [ADR-0011](0011-audio-voice-processor.md). That processor cancels the echo of what is played through it, so everything the robot plays must go there.
- The wake word must be the robot's name, which can change ([design rule 3](../../CONTRIBUTING.md#design-rules)), and its owners may say it with a Vietnamese accent.
- How others do it:

| System | Wake word | Voice activity | Audio |
|---|---|---|---|
| Previous generation (ESP32-S3) | microWakeWord, "Hi Luni", trained on Colab from synthetic voices. Its training evaluation found a recall of about 0.98 and no false wake in 5.3 hours of party noise. | None: turns ended after 30 s | I2S |
| Home Assistant's Linux satellite (linux-voice-assistant) | microWakeWord or openWakeWord, through pymicro-wakeword and pyopen-wakeword | Left to Home Assistant | PulseAudio, mpv; echo cancelled by an XMOS board |
| Home Assistant Voice Preview Edition | microWakeWord, on its ESP32-S3 | Left to Home Assistant | An XMOS XU316 |
| LiveKit Agents, Pipecat | (server side) | Silero VAD | (server side) |

- What the candidates offer:
  - **microWakeWord**: small streaming models, about 60 kB for "Hi Luni", with a manifest that gives the detection threshold. pymicro-wakeword (Apache-2.0, Open Home Foundation) runs them on Linux, with TensorFlow Lite built in, and loads our own models from their manifest.
  - **openWakeWord**: a frozen feature extractor shared by small per-word models; a Raspberry Pi 3 core runs 15–20 of them. Its pre-trained models are licensed CC BY-NC-SA 4.0, non-commercial.
  - **Porcupine**: light and accurate, but proprietary, and it needs a Picovoice access key.
  - **sherpa-onnx keyword spotting**: its published models are for English (GigaSpeech) or Chinese (WenetSpeech) only.
  - **Silero VAD**: in independent tests it clearly outperforms WebRTC's VAD; on FLEURS-VAD-102 its F1 is 95.95 % against 52.30 %. pysilero-vad (MIT) runs it with its own inference (ggml), without onnxruntime.
  - **PipeWire** has been Raspberry Pi OS's sound server since Bookworm. On Ubuntu, which [ADR-0017](0017-ros-2.md) proposes instead, the robot's image runs it before the robot's nodes. Ubuntu 26.04's PortAudio initializes only when a PulseAudio-compatible server such as PipeWire answers (checked 2026-10-27).

## Decision

1. **The wake word is a microWakeWord model of our own**, run by pymicro-wakeword.
   - It is trained with the previous generation's notebook, from synthetic voices that may include Vietnamese ones, and kept in microWakeWord's manifest format.
   - A new name means a new model; the configuration names the model's manifest.
   - Several models may run at once, for instance a word that stops the robot.
2. **Voice activity is detected with Silero VAD**, run by pysilero-vad.
3. **Sound goes through PipeWire, with the voice processor as the default input and output.** Everything the robot plays then reaches the echo canceller's reference: its voice, a timer's sound, music, a page in the browser.
   - The robot's software reaches PipeWire through PortAudio, with the sounddevice library (MIT).
4. **The two engines sit behind ports, `wake_word` and `voice_activity`**, with simulated adapters for computers without them, like the rest of the robot.

## Alternatives considered

| Alternative | Why not |
|---|---|
| openWakeWord | Heavier, with a shared feature extractor, and its pre-trained models are for non-commercial use. A word of our own would need its training anyway, and the previous generation's training works for microWakeWord. It stays possible behind the same port. |
| Porcupine | Proprietary, tied to an access key and to its vendor. |
| sherpa-onnx keyword spotting | It needs no training per word, but its published models are for English or Chinese only. |
| WebRTC's VAD, or the energy of the signal | Fast, but far less accurate than Silero in independent tests, which barge-in cannot afford. |
| ALSA directly, with the voice processor opened by the robot alone | No mixing: any other sound would have to bypass the voice processor, and with it the echo canceller. |

## Consequences

- Measured on the robot's Pi 5 (2026-10-28), fed a recording in 20 ms chunks as the voice module feeds them:
  - microWakeWord, with one model, takes 1.0 % of one core;
  - Silero VAD takes 2.8 %.
- Positive:
  - one model format and one training pipeline, from the previous generation to Home Assistant's own devices;
  - permissive licences throughout: Apache-2.0 and MIT;
  - the engines can be swapped behind their ports without touching the voice module.
- Negative / accepted trade-offs:
  - each name needs a model, trained on a GPU (about half an hour on Colab, the previous generation found), and checked for false wakes;
  - PipeWire must be set up to make the voice processor the default device, a step of the robot's installation;
  - two native libraries ship inside Python wheels: TensorFlow Lite, and ggml.
- Follow-up:
  - train the robot's wake word for its name, and measure false wakes on the robot;
  - the voice module, on top of these ports;
  - the PipeWire setup, with the voice processor's hardware change.

## References

Retrieved 2026-10-23:

- The previous generation's wake word: [`docs/WAKEWORD.md`](https://github.com/trungnguyen278/Luni_Robot/blob/main/docs/WAKEWORD.md) in Luni_Robot.
- [pymicro-wakeword](https://github.com/OHF-Voice/pymicro-wakeword), 2.5.0; [microWakeWord](https://github.com/kahrendt/microWakeWord).
- [pysilero-vad](https://github.com/rhasspy/pysilero-vad), 3.4.0; [Silero VAD](https://github.com/snakers4/silero-vad).
- [openWakeWord](https://github.com/dscripka/openWakeWord): the models' licence, and its performance.
- [Porcupine](https://picovoice.ai/products/voice/wake-word/).
- sherpa-onnx keyword spotting models: [ModuleLLM tutorial](https://modulellm-tutorial.readthedocs.io/en/latest/model_pages/kws.html).
- Voice activity detectors compared: [Window Size Versus Accuracy Experiments in Voice Activity Detectors](https://arxiv.org/abs/2601.17270) (Google, 2026), [FireRedASR2S](https://arxiv.org/pdf/2603.10420), table of FLEURS-VAD-102.
- [linux-voice-assistant](https://github.com/OHF-Voice/linux-voice-assistant); [Home Assistant Voice Preview Edition](https://www.home-assistant.io/voice-pe/).
- [Bookworm, the new version of Raspberry Pi OS](https://www.raspberrypi.com/news/bookworm-the-new-version-of-raspberry-pi-os/): PipeWire replaces PulseAudio.
- [sounddevice](https://python-sounddevice.readthedocs.io/), 0.5.6.
