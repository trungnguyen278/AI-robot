# Raspberry Pi 5 (8GB)

> Cập nhật: 2026-10-15. Lúc soạn không truy cập trực tiếp được raspberrypi.com → nhiều mục dựa trên product brief bản sao và nguồn thứ cấp (đã ghi rõ). Nên đối chiếu lại tài liệu chính hãng khi có dịp.

- **Vai trò:** "não" của robot — audio, thị giác, khuôn mặt, mạng, AI.
- **Mẫu:** Raspberry Pi 5, 8GB RAM. Số lượng: 1.
- **Nối với:** DC-DC 5V qua header; màn (DSI), camera (CSI), ReSpeaker (header), ESP32-S3 (UART).

## Thông số chính

| Thông số | Giá trị | Nguồn |
|---|---|---|
| SoC | Broadcom BCM2712, 4 × Arm Cortex-A76 @ 2.4 GHz; GPU VideoCore VII | Product brief |
| RAM | 8GB LPDDR4X-4267 | Product brief |
| Wi-Fi / Bluetooth | 802.11ac 2.4/5 GHz; Bluetooth 5.0 / BLE — chip Infineon CYW43455 (SDIO) | Product brief; wifidiving |
| USB | 2 × USB 3.0 + 2 × USB 2.0 | Product brief |
| Camera / màn | 2 × MIPI 4-lane transceiver (cổng 22 chân), dùng cho camera hoặc màn tùy ý | Product brief; Waveshare wiki |
| PCIe | PCIe 2.0 x1 (cần M.2 HAT hoặc adapter) | Product brief |
| Khác | RTC (pin ngoài qua cổng J5 BAT, `/dev/rtc0`), nút nguồn, cổng quạt, cổng UART debug 3 chân | Product brief; Waveshare wiki |
| Nguồn | 5V/5A qua USB-C có Power Delivery | Product brief |
| Header | 40 chân, 28 GPIO từ chip I/O RP1; logic **3.3V, không chịu 5V** | CNX Software; zbotic |
| RP1 (toàn chip) | 5 × UART, 6 × SPI, 4 × I2C, 2 × I2S (1 clock producer + 1 clock consumer), PWM 4 kênh | CNX Software (tóm tắt datasheet RP1) |
| Không có | Jack audio 3.5 mm, ADC | Product brief (không liệt kê) |

## Chân header hay dùng

| Chức năng | GPIO (chân vật lý) | Ghi chú |
|---|---|---|
| I2C1 | 2 SDA (3), 3 SCL (5) | Bật bằng `dtparam=i2c_arm=on` |
| UART0 | 14 TX (8), 15 RX (10) | UART PL011 đầy đủ; console nằm ở cổng UART debug riêng. Theo nguồn thứ cấp bật bằng overlay `uart0-pi5` — chưa xác minh |
| I2S / PCM | 18 BCLK (12), 19 LRCLK (35), 20 DIN (38), 21 DOUT (40) | **Một nhóm chân duy nhất trên header**; bật bằng `dtparam=i2s=on` hoặc overlay của HAT |
| PWM phần cứng | 12, 13, 18, 19 | 18/19 trùng I2S |
| SPI0 | 7–11 | Bật bằng `dtparam=spi=on` |

## Nguồn điện

| Mục | Giá trị | Nguồn |
|---|---|---|
| Nguồn khuyến nghị | 5V/5A USB-C PD (27 W) | Product brief |
| Giới hạn dòng USB | Nguồn 3A → tổng dòng các cổng USB ~600 mA; nguồn 5A PD → ~1.6 A | White paper RP-009856 |
| Bỏ giới hạn | `usb_max_current_enable=1` (`config.txt`) hoặc `PSU_MAX_CURRENT=5000` (EEPROM, `sudo rpi-eeprom-config --edit`) — chỉ khi nguồn thật sự đủ 5A | Nguồn thứ cấp (Waveshare, diễn đàn) |
| Cấp qua chân 5V header | Không có thương lượng PD → nhiều khả năng bị coi như nguồn không đủ 5A | Suy luận — cần thử |
| Công suất đo được | ~3 W rảnh (headless, Wi-Fi); ~8.8–9.8 W CPU tải đầy; 12–16 W khi thêm NVMe/video/bộ tăng tốc | raspberry.tips; Jeff Geerling |
| Khi đã tắt (halt) | Mặc định ~1.2–1.6 W; `POWER_OFF_ON_HALT=1` (EEPROM) → ~0.01 W, có thể ảnh hưởng vài HAT | Jeff Geerling |

## Nhiệt

- Hạ xung mềm khoảng 80 °C, cứng khoảng 85 °C. *(nguồn thứ cấp)*
- Quạt Active Cooler: 0% dưới 50 °C → 30% @50 → 50% @60 → 70% @67.5 → 100% @75 °C, trễ 5 °C. *(nguồn thứ cấp)* Thử nghiệm của 52Pi: giữ CPU quanh 60 °C khi tải đầy.

## Phần mềm

- **OS:** Raspberry Pi OS 64-bit, hiện dựa trên Debian 13 "Trixie" (image mới nhất ghi nhận ngày 21/04/2026, kernel 6.12). Kiểm tra lại khi cài.
- **GPIO:** `RPi.GPIO` **không chạy** trên Pi 5 (GPIO nằm ở RP1). Dùng `gpiozero` (backend `lgpio`), `lgpio`, `libgpiod`; `rpi-lgpio` để chạy code RPi.GPIO cũ.
- **Số gpiochip:** header từng là `gpiochip4`, kernel mới thêm alias `gpiochip0` → không hard-code, dùng `gpiodetect`/`gpioinfo`.
- **Camera:** libcamera, Picamera2, rpicam-apps.

## Hiệu năng AI (ước tính, xem ADR-0001)

- Băng thông RAM lý thuyết ~17 GB/s (LPDDR4X-4267, bus 32-bit) → LLM chạy local: 7–8B ~1.5–2 token/s, 3B ~4–6 token/s, 1.5B ~8–12 token/s. Số liệu cộng đồng, chưa tự đo.

## Lưu ý cho robot này

- Cấp nguồn từ DC-DC 5V qua header → xem mục Nguồn điện; không cấp servo/động cơ từ 5V của Pi.
- Khung kim loại có thể làm yếu Wi-Fi → phương án: USB Wi-Fi có ăng-ten ngoài.
- Mất điện đột ngột dễ hỏng thẻ nhớ → tắt máy sạch khi pin yếu; cân nhắc rootfs read-only/overlay hoặc NVMe.

## Nguồn tham khảo (tra 2026-10-15)

- [Raspberry Pi 5 product brief](https://cdn.sparkfun.com/assets/9/9/0/d/e/raspberry-pi-5-product-brief.pdf)
- [RP1 datasheet — tóm tắt của CNX Software](https://cnx-software.com/2023/10/07/raspberry-pi-rp1-datasheet-block-diagram/)
- [USB Power Delivery on Raspberry Pi 5 — white paper RP-009856](https://pip-assets.raspberrypi.com/categories/685-app-notes-guides-whitepapers/documents/RP-009856-WP-1-USB%20Power%20delivery%20on%20Raspberry%20Pi%205.pdf)
- [Raspberry Pi 5 — Waveshare wiki](https://waveshare.com/wiki/Raspberry_Pi_5)
- [Raspberry Pi power consumption — raspberry.tips](https://raspberry.tips/en/?p=9083)
- [New 2GB Pi 5 — Jeff Geerling](https://www.jeffgeerling.com/blog/2024/new-2gb-pi-5-has-33-smaller-die-30-idle-power-savings/)
- [Reducing Raspberry Pi 5's power consumption by 140x — Jeff Geerling](https://www.jeffgeerling.com/blog/2023/reducing-raspberry-pi-5s-power-consumption-140x/)
- [Raspberry Pi 5 in-built Wi-Fi](https://wifidiving.substack.com/p/raspberry-pi-5-in-built-wifi)
- [raspberrypi/linux PR #6144 — gpiochip alias](https://github.com/raspberrypi/linux/pull/6144)
- [RPi.GPIO không chạy trên Pi 5 — raspberry.tips](https://raspberry.tips/en/raspberrypi-tutorials/raspberry-pi-5-gpio-rpigpio-not-working-alternatives)
- [UART trên Raspberry Pi — zbotic](https://zbotic.in/raspberry-pi-uart-serial-communication-with-sensors/)
- [I2S / PCM — pinout.xyz](https://pinout.xyz/pinout/pcm)
- [Đường cong quạt — SunFounder docs](https://docs.sunfounder.com/projects/pironman5/en/latest/hardware/fans.html)
- [Raspberry Pi OS downloads](https://www.raspberrypi.com/software/operating-systems/)
