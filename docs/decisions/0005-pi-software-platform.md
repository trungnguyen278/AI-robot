# 0005 — Pi software platform: Raspberry Pi OS, Python with C++ extensions, no ROS 2 for now

- **Status:** Superseded by [0017](0017-ros-2.md)
- **Date:** 2026-10-15

## Context

- Most of the Pi's work is coordination: audio, camera, display, the link to the body and network calls, tied together by behavior. A few paths need speed: audio processing, image processing, drawing the face.
- The AI camera's software (libcamera, Picamera2) comes from Raspberry Pi: Picamera2 supports Raspberry Pi OS (Bullseye or later) and is installed with apt ([camera notes](../../hardware/components/raspberry-pi-ai-camera.md), [Picamera2](https://github.com/raspberrypi/picamera2)).
- Raspberry Pi OS has been based on Debian 13 "Trixie" since October 2025; Debian 13 ships Python 3.13.
- ROS 2 Jazzy (LTS, supported until May 2029) and Kilted support Ubuntu 24.04 and Windows at Tier 1. Debian is Tier 3, and Raspberry Pi OS is not listed.
- The previous generation's face renderer is almost pure C++17 ([legacy.md](../legacy.md)).
- The Pi software must run before the body exists ([ADR-0004](0004-pi-software-first.md)): on any computer and in CI.

## Decision

- **OS:** Raspberry Pi OS (64-bit).
- **Languages:** Python (3.11 or later, asyncio) for the application. C++17 for the code that needs speed, in an optional extension built with pybind11 and scikit-build-core. Every C++ function has a pure-Python fallback with the same behavior, so the software also runs without a compiler.
- **Structure:** one process. Modules (system, motion, voice, vision, face, behavior) talk to each other only through an in-process message bus. Hardware and external services sit behind ports, implemented by adapters (simulated or real) that a configuration profile selects. Details: [architecture](../architecture.md#software-on-the-pi) and [`software/README.md`](../../software/README.md).
- **No ROS 2 for now.** Revisit when navigation (Nav2) or arm motion planning (MoveIt) is needed; a bridge between the bus and ROS 2 can be added then.

## Alternatives considered

| Alternative | Why not |
|---|---|
| ROS 2 on Ubuntu 24.04 | Tier 1 support, Nav2 and MoveIt, but the camera software targets Raspberry Pi OS, and ROS 2 brings its build system, launch files and DDS long before navigation or arm planning is needed. |
| ROS 2 on Raspberry Pi OS | Not a supported platform: build from source, or run it in a container. |
| C++ only | Slower to write and change; the camera, AI and audio libraries are Python-first. |
| Python only | Fine for coordination, but the fast paths would be slow, and the C++ face renderer could not be reused. |

## Consequences

- Positive: quick to develop and to debug (one process); runs on any computer; C++ only where it pays off.
- Negative / accepted trade-offs: a single event loop → blocking calls go to threads (`asyncio.to_thread`) and heavy computation to C++ or another process; no ready-made ROS packages for navigation and manipulation.
- Follow-up: revisit ROS 2 when navigation or arm planning starts; decide where AI runs (camera, Pi, server).

## References

Retrieved 2026-10-15:

- ROS 2 platforms: [Kilted Kaiju release notes](https://docs.ros.org/en/kilted/Releases/Release-Kilted-Kaiju.html), [Jazzy Jalisco announcement](https://discourse.openrobotics.org/t/ros-2-jazzy-jalisco-released/37862), [REP 2000](https://www.ros.org/reps/rep-2000.html).
- [Raspberry Pi OS "Trixie"](https://www.raspberrypi.com/news/trixie-the-new-version-of-raspberry-pi-os/); [Debian 13 release announcement](https://bits.debian.org/2025/08/trixie-released.html) (Python 3.13).
- [pybind11](https://pybind11.readthedocs.io/), [scikit-build-core](https://scikit-build-core.readthedocs.io/).
