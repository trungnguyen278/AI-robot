# firmware/ — microcontroller modules

One sub-folder per module. Each module is self-contained: its own README, build configuration and tests.

| Module | MCU | Role | Status |
|---|---|---|---|
| [body-controller](body-controller/README.md) | Not chosen (concept v0: ESP32-S3) | Real-time I/O for the robot's body | Deferred |

Modules implement the [robot-body contract](https://github.com/trungnguyen278/ai-robot-design/blob/main/interfaces/robot-body.md); any microcontroller that does so can replace another. Toolchains are chosen per module once its MCU is chosen.
