# 0002 — ESP32-S3 làm body-controller, chỉ lo I/O thời gian thực

- **Trạng thái:** Đã chấp nhận
- **Ngày:** 2026-10-15

## Bối cảnh

- Linux trên Pi 5 không đảm bảo thời gian thực, trong khi đếm encoder, điều khiển servo bus và dừng khẩn cấp cần độ trễ ổn định.
- Thân robot có 8 servo bus STS3215, 2 động cơ MG540 có encoder, cảm biến ToF VL53L1X, LED NeoPixel.
- **Pi 5 có sẵn Wi-Fi (802.11ac, 2.4/5 GHz) và Bluetooth 5.0/BLE** (chip Infineon CYW43455) → không cần ESP làm card mạng.

## Quyết định

Dùng **ESP32-S3** (ESP32-S3-DevKitC-1) làm **body-controller**: servo, động cơ + encoder, cảm biến, LED, đo pin, watchdog an toàn. Pi 5 lo mạng (Wi-Fi/BLE), AI, audio, thị giác, khuôn mặt. Hai bên nói chuyện bằng giao thức trong [`protocol/`](../../protocol/README.md).

## Phương án đã cân nhắc

| Phương án | Vì sao không chọn |
|---|---|
| ESP làm card Wi-Fi cho Pi | Pi 5 đã có Wi-Fi/BLE. Nếu khung kim loại làm yếu sóng → dùng USB Wi-Fi có ăng-ten ngoài, đơn giản hơn nhiều so với bắc cầu mạng qua ESP. |
| Pi điều khiển trực tiếp mọi thứ | Không thời gian thực; servo bus half-duplex và encoder dễ lỗi khi Linux bận; robot mất an toàn khi Pi treo. |
| MCU khác (RP2040/RP2350, STM32) | Khả thi. Chọn ESP32-S3 vì đã quen ESP-IDF từ thế hệ trước và ngoại vi đủ dùng (PCNT cho encoder, RMT cho NeoPixel, nhiều UART). |

## Hệ quả

- Tốt: điều khiển ổn định; robot tự dừng an toàn khi Pi treo/khởi động lại; tái dùng kinh nghiệm ESP-IDF.
- Phải chấp nhận: thêm một codebase firmware và một giao thức phải giữ khớp → định nghĩa một lần trong `protocol/` (thế hệ trước phải đồng bộ tay hai bản `StateTypes`).
- Việc cần làm tiếp: chốt định dạng giao thức và kênh vật lý (UART dự kiến) bằng ADR.

## Nguồn

- Wi-Fi/BLE của Pi 5: [product brief](https://cdn.sparkfun.com/assets/9/9/0/d/e/raspberry-pi-5-product-brief.pdf), [CYW43455 trên Pi 5](https://wifidiving.substack.com/p/raspberry-pi-5-in-built-wifi).
- Concept v0: [`hardware/images/concept-v0.webp`](../../hardware/images/concept-v0.webp).
