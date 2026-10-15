# Previous generation: Luni_Robot

Repository: <https://github.com/trungnguyen278/Luni_Robot> (archived). A desktop robot with a 2" 320×240 display and two MCUs — an **ESP32-S3** (display, audio, camera, rendering) and an **ESP32-C5** (Wi-Fi, WebSocket, BLE, OTA, servos and IMU) — linked by SPI (audio) and UART (control). Companion repositories: `Luni_Cloud` (FastAPI) and `Luni_App` (Flutter).

## What can be reused

| What | Where in Luni_Robot | Notes |
|---|---|---|
| Free wake-word training (microWakeWord on Colab) | `tools/train_wakeword.ipynb`, `docs/WAKEWORD.md` | A new robot name means training a new keyword. The `.tflite` model should also run on Linux (untested) |
| Emotion and scene design (eyes, 9-tone palette, ~238 variants) | `ui_design/` (JSX/SVG), `ui_design/REQUIREMENTS.md` | Keep the design language; the old renderer targets a 320×240 SPI display, so the 7" face needs a new one |
| Procedural C++ renderer | `esp32-s3/lib/display/`, `esp32-s3/src/ui/` | Almost pure C++17 — only 3 files depend on ESP-IDF |
| Cloud WebSocket protocol (auth, Opus 16 kHz / 60 ms, sync_data) | `docs/modules/network.md`, `docs/modules/inter-mcu.md` | Reference for `ai-robot-server` |
| BLE provisioning (GATT, 3 access levels, HMAC) | `esp32-c5/docs/BLE_APP_DEV.md`, `docs/modules/ble-provisioning.md` | Reference for `ai-robot-app` |
| Connection state machine with per-error retry policy | `docs/modules/state-machine.md` | |

## Lessons learned

- **Two MCUs are expensive:** two firmwares, two hand-synchronized copies of `StateTypes`, no OTA for the S3. Now: one Linux computer plus one MCU, with the protocol defined once.
- **The camera path was a bottleneck:** ~11 s per QVGA image (UART at 460800 baud, no PSRAM on the C5, WebSocket chunks paced at 100 ms).
- **No on-device VAD:** wake-word turns only ended at a 30 s watchdog.
- **A find-and-replace rename broke code** (`sounddevice` → `sounddLunice`) → [ADR-0003](decisions/0003-neutral-repo-naming.md).
- **Running out of GPIO** pushed functions back and forth between the two MCUs → keep [`hardware/pinmap.md`](../hardware/pinmap.md) from day one.
