# Phân bổ chân

> Nguồn sự thật cho câu hỏi "chân nào dùng vào việc gì". Mọi thay đổi nối dây phải cập nhật file này (skill `hardware-change`).
> Trạng thái hiện tại: **dự kiến** — chưa nối gì.

## Raspberry Pi 5 — header 40 chân

Chỉ liệt kê chân đã/định dùng. GPIO là 3.3V, **không chịu 5V**.

| GPIO (BCM) | Chân vật lý | Chức năng | Dùng cho | Trạng thái |
|---|---|---|---|---|
| 2 / 3 | 3 / 5 | I2C1 SDA / SCL | Codec của ReSpeaker HAT | dự kiến |
| 14 / 15 | 8 / 10 | UART0 TX / RX | Liên kết ESP32-S3 | dự kiến |
| 18 / 19 / 20 / 21 | 12 / 35 / 38 / 40 | I2S BCLK / LRCLK / DIN / DOUT | Audio: ReSpeaker **hoặc** MAX98357A | dự kiến — trùng, xem [vấn đề mở #1](README.md#vấn-đề-đang-mở) |

Không qua header: màn 7" → cổng DSI; camera → cổng CSI; quạt → cổng fan; pin RTC → cổng BAT.

### Địa chỉ I2C trên bus I2C1 của Pi

| Địa chỉ | Thiết bị |
|---|---|
| chưa xác minh | Codec TLV320AIC3104 (ReSpeaker HAT) |

## ESP32-S3 (body-controller)

| Chức năng | Ngoại vi dự kiến | GPIO | Trạng thái |
|---|---|---|---|
| Liên kết Pi 5 | UART | TBD | dự kiến |
| Servo bus STS3215 | UART + chân hướng (half-duplex) | TBD | dự kiến |
| Encoder MG540 trái / phải | PCNT (kênh A/B mỗi bánh) | TBD | dự kiến |
| Driver động cơ | PWM (LEDC/MCPWM) + DIR | TBD | dự kiến |
| VL53L1X | I2C (0x29) | TBD | dự kiến |
| NeoPixel | RMT | TBD | dự kiến |
| Điện áp pin | ADC + cầu chia áp | TBD | dự kiến |
