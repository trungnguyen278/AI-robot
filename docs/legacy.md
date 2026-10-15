# Thế hệ trước: Luni_Robot

Repo: <https://github.com/trungnguyen278/Luni_Robot> (lưu trữ). Robot để bàn, màn 2" 320×240, hai MCU: **ESP32-S3** (màn, audio, camera, render) + **ESP32-C5** (Wi-Fi, WebSocket, BLE, OTA, servo/IMU), nối với nhau qua SPI (audio) + UART (điều khiển). Repo đi kèm: `Luni_Cloud` (FastAPI), `Luni_App` (Flutter).

## Có thể tái dùng

| Thứ | Ở đâu trong Luni_Robot | Ghi chú |
|---|---|---|
| Quy trình train wake word miễn phí (microWakeWord trên Colab) | `tools/train_wakeword.ipynb`, `docs/WAKEWORD.md` | Tên robot mới → train lại từ khóa mới. Model `.tflite` về lý thuyết chạy được trên Linux (chưa thử) |
| Thiết kế cảm xúc/scene (đôi mắt, 9 tone màu, ~238 biến thể) | `ui_design/` (JSX/SVG), `ui_design/REQUIREMENTS.md` | Giữ ngôn ngữ thiết kế; renderer cũ viết cho 320×240 qua SPI, màn 7" mới nên làm lại |
| Engine render thủ tục C++ | `esp32-s3/lib/display/`, `esp32-s3/src/ui/` | Gần như C++17 thuần (chỉ 3 file dính ESP-IDF) |
| Giao thức WebSocket với cloud (auth, Opus 16 kHz/60 ms, sync_data) | `docs/modules/network.md`, `docs/modules/inter-mcu.md` | Tham khảo khi làm `ai-robot-server` |
| BLE provisioning (GATT, 3 mức quyền, HMAC) | `esp32-c5/docs/BLE_APP_DEV.md`, `docs/modules/ble-provisioning.md` | Tham khảo cho `ai-robot-app` |
| State machine kết nối + retry theo loại lỗi | `docs/modules/state-machine.md` | |

## Bài học

- **Tách hai MCU tốn kém:** hai firmware, hai bản `StateTypes` phải đồng bộ tay, S3 không có OTA → giờ dùng một máy Linux + một MCU, giao thức định nghĩa một lần.
- **Đường ảnh camera nghẽn:** ~11 giây cho một ảnh QVGA (UART 460800 + C5 không có PSRAM + gửi WebSocket từng chunk cách nhau 100 ms).
- **Không có VAD trên thiết bị:** lượt nói kích bằng wake word chỉ kết thúc khi watchdog 30 giây.
- **Đổi tên bằng find-replace làm hỏng code** (`sounddevice` → `sounddLunice`) → [ADR-0003](decisions/0003-neutral-repo-naming.md).
- **Thiếu chân GPIO** khiến chức năng bị dời qua lại giữa hai MCU → lập [`hardware/pinmap.md`](../hardware/pinmap.md) ngay từ đầu.
