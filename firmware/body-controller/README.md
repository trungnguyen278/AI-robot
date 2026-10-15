# body-controller (ESP32-S3)

> Trống — vai trò xem [ADR-0002](../../docs/decisions/0002-esp32-s3-body-controller.md).

## Nhiệm vụ

- Servo bus STS3215 × 8 (cổ 2 + tay 3 + 3) — half-duplex, cần mạch chuyển.
- Động cơ MG540 × 2: điều khiển driver + đọc encoder (dự kiến PCNT).
- VL53L1X (I2C), LED NeoPixel (dự kiến RMT).
- Đo điện áp pin (ADC + cầu chia áp).
- **An toàn:** mất heartbeat từ Pi quá ngưỡng → dừng động cơ, đưa servo về trạng thái an toàn.

## Không làm

- Không dùng Wi-Fi/BLE của ESP32-S3 — mạng do Pi 5 lo.

## Liên kết với Pi

UART (dự kiến); giao thức định nghĩa trong [`protocol/`](../../protocol/README.md). Chân: [`hardware/pinmap.md`](../../hardware/pinmap.md).
