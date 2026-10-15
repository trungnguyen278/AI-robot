# Kiến trúc tổng quan

> Bản nháp — sẽ chi tiết dần qua các ADR trong [decisions/](decisions/README.md).

```
              ┌──────────────── Raspberry Pi 5 — "não" ────────────────┐
 Mic ──I2S──▶ │ audio: wake word, VAD, AEC, hội thoại                   │
 Loa ◀─────── │ vision: camera AI (IMX500)                              │ ◀─ Wi-Fi ─▶ ai-robot-server
 Camera ─CSI▶ │ face: khuôn mặt biểu cảm trên màn 7"                    │ ◀─ BLE ───▶ ai-robot-app
 Màn ◀──DSI── │ behavior: điều phối hành vi                             │
              └───────────────────────────┬─────────────────────────────┘
                                          │ UART (dự kiến) — giao thức trong protocol/
              ┌───────────────────────────▼─────────────────────────────┐
              │ ESP32-S3 — body-controller (thời gian thực)             │
              │ servo bus STS3215 ×8 · động cơ MG540 ×2 + encoder       │
              │ VL53L1X · NeoPixel · đo điện áp pin · watchdog an toàn  │
              └─────────────────────────────────────────────────────────┘
```

## Phân vai

| Khối | Lo việc gì | Không lo |
|---|---|---|
| Raspberry Pi 5 | Audio, thị giác, khuôn mặt, AI, kết nối mạng (Wi-Fi/BLE có sẵn), ra quyết định hành vi | Vòng điều khiển thời gian thực |
| ESP32-S3 (body-controller) | Servo, động cơ + encoder, cảm biến khoảng cách, LED, đo pin, dừng an toàn khi mất liên lạc với Pi | Mạng (không dùng Wi-Fi/BLE của ESP32) |
| `ai-robot-server` | STT/LLM/TTS, lưu trữ, quản lý thiết bị | |
| `ai-robot-app` | Ghép nối, cài đặt, điều khiển từ xa | |

## Nguyên tắc

- Pi có thể treo hoặc khởi động lại bất cứ lúc nào → ESP32-S3 tự đưa robot về trạng thái an toàn khi mất heartbeat từ Pi.
- Giao thức Pi ⇄ ESP32 định nghĩa một lần trong [`protocol/`](../protocol/README.md).
- AI nặng chạy ở server hay ngay trên Pi/camera: chốt bằng ADR, không quyết ngầm trong code.

## Câu hỏi còn mở (mỗi câu nên thành một ADR)

- [ ] OS: Raspberry Pi OS (camera AI được hỗ trợ tốt nhất) hay Ubuntu?
- [ ] Có dùng ROS 2 không? (MoveIt cho tay, Nav2 cho di chuyển — đổi lại độ phức tạp)
- [ ] Ngôn ngữ chính trên Pi: Python, C++, hay kết hợp?
- [ ] Liên kết Pi ⇄ ESP32: UART (dự kiến; concept ghi UART/I2C) và định dạng gói tin.
- [ ] Driver động cơ do ESP32-S3 hay Pi điều khiển?
- [ ] Chia việc AI giữa camera, Pi và server thế nào?
- [ ] Audio: ReSpeaker HAT hay MAX98357A (không dùng chung nhóm I2S được) — xem [hardware/README.md](../hardware/README.md).
