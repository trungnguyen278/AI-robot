---
name: pi5-platform
description: Raspberry Pi 5 (8GB) platform knowledge and checklists for this robot — 40-pin header functions (I2C, SPI, UART, I2S, PWM), 3.3V logic, power (5V/5A, USB current limit, GPIO-powered setup, halt power), thermal throttling, Wi-Fi/BLE, CSI/DSI/PCIe, Raspberry Pi OS, config.txt/EEPROM settings and GPIO libraries. Use whenever a task touches the Pi side of the hardware or OS — wiring something to the Pi, assigning GPIO pins, enabling interfaces or overlays, powering or cooling the Pi, choosing GPIO/camera/audio libraries, or deciding what runs on the Pi vs the ESP32 (chân GPIO, nguồn Pi, config.txt, overlay, tản nhiệt, Pi 5).
---

# Raspberry Pi 5 — nền tảng của robot

## Đọc trước khi làm

1. `hardware/components/raspberry-pi-5.md` — thông số đã tra, có nguồn.
2. `hardware/pinmap.md` — chân nào đang dùng cho việc gì.
3. `hardware/README.md` — cây nguồn và các vấn đề đang mở.

## Checklist khi gán chân / bật giao tiếp

- [ ] GPIO là **3.3V, không chịu 5V** → thiết bị 5V phải qua mạch chuyển mức.
- [ ] Kiểm tra trùng chân trong `pinmap.md`. Chỗ hay trùng:
  - I2S chỉ có **một nhóm chân trên header (GPIO18–21)** → hai thiết bị I2S (vd. HAT audio + ampli rời) sẽ tranh nhau.
  - GPIO18/19 vừa là I2S vừa là PWM phần cứng.
  - I2C1 (GPIO2/3) là bus dùng chung → ghi địa chỉ I2C vào `pinmap.md`, tránh trùng.
- [ ] Thiết bị lấy nguồn từ chân 5V/3.3V của header → cộng vào bảng công suất trong `hardware/README.md`.
- [ ] Cập nhật `pinmap.md` (và mẫu `config.txt` nếu có) trong cùng commit.

## Checklist nguồn & nhiệt

- [ ] Pi 5 cần 5V ổn định, tới 5A. Cấp qua chân 5V của header (từ DC-DC) thì không có thương lượng USB-PD → tổng dòng USB bị giới hạn ~600mA, trừ khi đặt `usb_max_current_enable=1` (`config.txt`) hoặc `PSU_MAX_CURRENT=5000` (EEPROM). Chỉ làm vậy khi nguồn thật sự đủ 5A.
- [ ] Không cấp servo/động cơ từ nhánh 5V của Pi.
- [ ] Chạy pin: cân nhắc `POWER_OFF_ON_HALT=1` (EEPROM) để giảm điện năng khi tắt máy (~1.2–1.6W → ~0.01W).
- [ ] Tải AI/camera liên tục → cần Active Cooler; Pi bắt đầu hạ xung khoảng 80°C.

## Bẫy phần mềm thường gặp

- `RPi.GPIO` **không chạy trên Pi 5** (GPIO nằm trên chip RP1) → dùng `gpiozero`, `lgpio`, `libgpiod`; `rpi-lgpio` để chạy code RPi.GPIO cũ.
- Không hard-code `gpiochip4`/`gpiochip0`: số chip đã đổi giữa các bản kernel → tìm bằng `gpiodetect`/`gpioinfo` hoặc theo label.
- Không có jack 3.5mm, không có ADC → audio qua I2S/USB/HDMI; đo analog (điện áp pin) qua ESP32-S3 hoặc IC ADC/INA.

## Khi tài liệu tham khảo thiếu thông tin

Tra tài liệu chính hãng trước (raspberrypi.com/documentation, product brief, datasheet RP1/BCM2712), rồi **bổ sung vào** `hardware/components/raspberry-pi-5.md` kèm link nguồn và ngày tra. Nguồn thứ cấp thì ghi rõ là thứ cấp.
