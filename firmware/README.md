# firmware/ — microcontroller modules

One sub-folder per module. Each module is self-contained: its own README, build configuration and tests.

| Module | MCU | Role |
|---|---|---|
| [body-controller](body-controller/README.md) | ESP32-S3-DevKitC-1 | Real-time I/O for the robot's body |

- Toolchain: not decided yet (the previous generation used ESP-IDF 5.5 + PlatformIO, C++17).
- With ESP-IDF, commit `sdkconfig.defaults`, never the generated `sdkconfig` (git-ignored).
