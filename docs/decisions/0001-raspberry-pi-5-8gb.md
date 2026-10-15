# 0001 — Dùng Raspberry Pi 5 bản 8GB làm "não"

- **Trạng thái:** Đã chấp nhận
- **Ngày:** 2026-10-15

## Bối cảnh

Thế hệ trước ([Luni_Robot](../legacy.md), ESP32-S3 + ESP32-C5) bị nghẽn phần cứng ở nhiều chỗ:

- Camera: gửi một ảnh QVGA lên server mất ~11 giây (S3 → UART → C5 → WebSocket, ~2.5 KB/s).
- ESP32-C5 không có PSRAM: tăng ring buffer UART lên 40 KB đã làm hỏng TLS handshake.
- ESP32-S3 hết chân: phải bỏ USB-OTG, hoãn thẻ SD, dời nút/I2C/ADC sang C5.
- Không có VAD trên thiết bị: lượt nói kích bằng wake word chỉ kết thúc khi watchdog 30 giây.
- Hai MCU → hai bản định nghĩa trạng thái phải đồng bộ tay; S3 chưa có đường OTA.

Robot mới còn thêm bánh xích, 2 tay, màn 7" và camera AI → cần một máy tính Linux thực thụ.

## Quyết định

Dùng **Raspberry Pi 5 bản 8GB**.

## Phương án đã cân nhắc

| Phương án | Vì sao không chọn |
|---|---|
| Pi 5 16GB | Ước tính RAM: kiến trúc AI ở server ~1–1.5 GB; kịch bản nặng (thêm STT/TTS chạy local + LLM nhỏ 1.5–4B) ~4–5.5 GB → vẫn vừa 8GB. Với AI chạy local, giới hạn của Pi 5 là băng thông RAM (LPDDR4X 32-bit, ~17 GB/s lý thuyết) chứ không phải dung lượng: LLM 7–8B chỉ ~1.5–2 token/s, có RAM chứa được cũng không dùng cho hội thoại được. Giá chênh lớn: niêm yết Mỹ sau đợt tăng 4/2026 khoảng $175 (8GB) so với ~$300 (16GB). |
| Pi 5 4GB | Đủ khi AI ở server, nhưng ít dư địa cho STT/TTS/LLM nhỏ chạy offline. |
| Giữ ESP32 | Không đáp ứng được camera, thị giác, màn lớn, AI. |

## Hệ quả

- Tốt: camera CSI có AI ngay trên cảm biến; một hệ Linux thay cho hai firmware; dư RAM cho xử lý local.
- Phải chấp nhận:
  - Công suất ~3 W khi rảnh, ~9 W khi CPU tải đầy, 12–16 W khi thêm ngoại vi nặng (cặp ESP32 cũ < 1 W) → thời lượng pin giảm.
  - Cần tản nhiệt chủ động, tắt máy an toàn khi pin yếu (mất điện đột ngột dễ hỏng thẻ nhớ), khởi động lâu hơn ESP32.
  - Linux không thời gian thực → điều khiển servo/động cơ giao cho ESP32-S3 ([ADR-0002](0002-esp32-s3-body-controller.md)).
- Nếu sau này cần tăng tốc AI: ưu tiên bộ tăng tốc (AI HAT+, model trên camera IMX500) thay vì nâng RAM.

## Nguồn

- Phân tích code Luni_Robot (xem [legacy.md](../legacy.md)).
- Giá Pi 5 năm 2026: [Tom's Hardware](https://www.tomshardware.com/raspberry-pi/component-shortages-drive-raspberry-pi-prices-up-by-up-to-23-percent-escalating-lpddr4-lpddr5-costs-trigger-the-third-price-hike-of-the-year), [Atomic Creations](https://atomiccreations.co/blogs/news/raspberry-pi-price-increase) — giá 16GB ~$300 chỉ từ nguồn thứ cấp.
- Công suất: [raspberry.tips](https://raspberry.tips/en/?p=9083), [Jeff Geerling](https://www.jeffgeerling.com/blog/2024/new-2gb-pi-5-has-33-smaller-die-30-idle-power-savings/).
- Ước tính RAM và tốc độ LLM: số liệu cộng đồng, chưa tự đo.
