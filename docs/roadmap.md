# Roadmap

> Thứ tự có thể đổi. Xong một mục → tick và ghi devlog; quyết định lớn → ADR.

## Giai đoạn 0 — Khởi tạo dự án

- [x] Tạo repo, cấu trúc thư mục, quy ước, skill cho Claude
- [x] ADR: Pi 5 8GB, ESP32-S3 làm body-controller, đặt tên repo trung tính
- [ ] Chốt danh sách linh kiện đợt 1 ([`hardware/bom.csv`](../hardware/bom.csv))
- [ ] Giải quyết các vấn đề mở trong [`hardware/README.md`](../hardware/README.md)

## Giai đoạn 1 — Bring-up phần cứng (chạy thử từng phần)

- [ ] Nguồn: pin 3S → cầu chì → công tắc khẩn cấp → các nhánh; đo thử không tải
- [ ] Pi 5 + Active Cooler + OS, SSH, Wi-Fi
- [ ] Màn 7" DSI, camera AI, mic + loa
- [ ] ESP32-S3: động cơ + encoder, servo bus, VL53L1X, NeoPixel
- [ ] Liên kết Pi ⇄ ESP32 (bản thử)

## Giai đoạn 2 — Nền tảng phần mềm

- [ ] Chốt OS / ROS 2 / ngôn ngữ (ADR)
- [ ] Giao thức Pi ⇄ ESP32 v1 trong `protocol/`
- [ ] Khung service trên Pi: cấu hình, log, tự khởi động
- [ ] Firmware body-controller v1 + watchdog an toàn

## Giai đoạn 3 — Tương tác

- [ ] Khuôn mặt biểu cảm trên màn 7"
- [ ] Giọng nói: wake word, VAD, hội thoại (STT/LLM/TTS)
- [ ] Cổ nhìn theo người

## Giai đoạn 4 — Di chuyển & thị giác

- [ ] Lái bánh xích có phản hồi encoder
- [ ] Tránh vật cản (ToF + camera)
- [ ] Nhận diện và đi theo người

## Giai đoạn 5 — Thao tác

- [ ] Điều khiển tay, cử chỉ
- [ ] Gắp đồ vật nhẹ

## Song song — Server & app

- [ ] `ai-robot-server`
- [ ] `ai-robot-app`
