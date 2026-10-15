# 0006 — Screen: a browser renderer with a procedural face, driven by the Pi software

- **Status:** Proposed
- **Date:** 2026-10-16

## Context

- The face comes from the previous generation's design ([ui/legacy/](../../ui/legacy/README.md)): 256 hand-written variants, each a loop drawn on a fixed 320 × 240 stage. It was made for an ESP32-S3 and a 2" TFT; its C++ port lost quality, and changing expression cuts from one loop to the next ([legacy.md](../legacy.md)).
- This robot has a Raspberry Pi 5 and a 7" 1024 × 600 touch display ([display notes](../../hardware/components/waveshare-7inch-dsi-lcd-c.md)). Its face should look at people, react to a voice, blend from one expression to the next, and stay alive while the software is busy.
- The design is edited in the browser (Claude Design, then a claude.ai Artifact), so a renderer built on web technology can be both the design tool and the robot's screen.
- How larger robots and assistants do it:

| Project | What it shows |
|---|---|
| Anki Cozmo and Vector | A procedural face: about twenty numbers per eye (centre, scale, angle, corner radii, upper and lower lids with angle and bend, glow). Animations are keyframes on tracks (face, head, lift, treads, audio, lights). |
| Mycroft GUI and OpenVoiceOS | The assistant decides what to show and a separate client draws it: pages and their data go over a WebSocket, all of it again when a client connects. Screens form a stack: the top one is shown and the idle screen sits at the bottom. A screen stays for a set time or until it is removed. |
| ROS `twist_mux` | Commands from several sources, each with a priority and a timeout: the highest source still active wins, and when it times out the next one takes over. |
| Misty II | The display is a stack of named layers (image, text, video, web page) that the robot's skills update. |
| Stack-chan (`m5stack-avatar`) | Face parts read shared state (expression, gaze, breathing, palette); behaviours such as lip sync run as tasks. |
| Raspberry Pi | The documented way to show a page full screen: Chromium in kiosk mode, started from labwc's autostart. |

## Decision

1. **The software decides what to show, the renderer how.** The Pi software's `screen` module picks the expression and the status (battery). A page in `ui/` draws it: it runs the frame loop, the transitions and the life of the face (blinking, glances, breathing, the gaze, the voice) on its own. On the robot it runs in Chromium in kiosk mode, and in any browser elsewhere.
2. **One protocol between them**, in [`protocol/screen/`](../../protocol/screen/README.md): JSON messages over a WebSocket served by the software (`web` adapter of the `screen` port). The software sends the whole state on every change and to every page that connects. It sends gaze and voice level as separate messages, and the page reports its size and taps.
3. **Priorities and timeouts decide the expression.** Every module may ask for one, with a priority and an optional duration; the highest request still valid wins, and `neutral` when there is none. This replaces the previous generation's hold modes and random idle rotation.
4. **A procedural face.** An expression is data: eye, lid, brow and mouth numbers, plus a colour, a motion, an effect and how much of each life layer it keeps. Any expression blends into any other, even in the middle of a transition.
5. **Any screen.** The face is laid out from the screen's size and shape (rectangular or round); there is no fixed stage.
6. **Plain JavaScript modules drawing on a 2D canvas**: no build step and no framework, so the same files run on the robot, in a browser, in headless tests and in an Artifact. WebGL waits until a measurement on the Pi 5 calls for it.
7. **The previous library becomes the reference** (`ui/legacy/`): its designs move into the new renderer one by one (14 expressions to start with), and it is deleted when they all have.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Play the 256 JSX variants in the kiosk browser | The browser compiles about 13,500 lines of JSX at every start and React rebuilds the drawing every frame. The stage stays fixed at 320 × 240, and changing expression still cuts. |
| Port the face to Python (pygame or Skia) | No browser on the robot, but the design could no longer be edited and previewed in a browser, and layout, text and touch would have to be rebuilt. The protocol keeps this open: a Python renderer could speak it. |
| Qt Quick / QML, like Mycroft's screen | A GPU scene graph built for devices, but the designs would have to be rewritten in QML, and they could no longer be edited in an Artifact. |
| Rive (state machines with a GPU runtime) | Production-grade interactive animation, but the designs live in Rive's own editor rather than in code that can be reviewed and edited here. |
| Server-sent events plus HTTP requests instead of a WebSocket | Would avoid the dependency, but needs two channels for the two directions and a hand-written HTTP server. aiohttp serves the files and the WebSocket in the same asyncio loop. |

## Consequences

- Positive: transitions between any two expressions; a face that follows a gaze and a voice and stays alive while the software is busy; any screen size or shape. The same code runs on the robot, in a browser, in tests and in the Artifact. Either side can be replaced without touching the other, and both are tested against the protocol's vocabulary.
- Negative / accepted trade-offs: a browser on the robot (memory, start-up time). The software gets its first runtime dependency, aiohttp. The previous library's 82 categories have to be ported: 14 expressions exist, and no scene (clock, weather, timers…) or status screen yet.
- Follow-up: measure frame rate, CPU and memory on a Pi 5 with the 7" display (`chrome://gpu`, the studio's frame-rate readout). Set up the kiosk (labwc autostart). Port the scenes as pages, have behaviors request expressions, and have vision send `LookAt`.

## References

Retrieved 2026-10-16:

- Vector's eye parameters: [vector-animations-build](https://github.com/digital-dream-labs/vector-animations-build); animation tracks: [Vector SDK, `anki_vector.animation`](https://developer.anki.com/vector/docs/generated/anki_vector.animation.html).
- [Mycroft GUI transport protocol](https://github.com/MycroftAI/mycroft-gui/blob/master/transportProtocol.md); [ovos-gui](https://github.com/OpenVoiceOS/ovos-gui) (namespace stack, idle screen, per-screen duration).
- [twist_mux](https://github.com/ros-teleop/twist_mux) (`config/twist_mux_topics.yaml`: `topic`, `timeout`, `priority`).
- [Misty II display and LED API](https://lessons.mistyrobotics.com/python-elements/misty-python-api/display-and-led).
- [m5stack-avatar](https://github.com/stack-chan/m5stack-avatar) (`DESIGN.md`).
- [Raspberry Pi kiosk mode tutorial](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/).
- [aiohttp](https://docs.aiohttp.org/) 3.14.5, the latest release on PyPI on 2026-10-16.
