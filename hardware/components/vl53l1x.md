# VL53L1X — cảm biến khoảng cách ToF

> Cập nhật: 2026-10-15.

- **Vai trò:** đo khoảng cách phía trước để tránh vật cản.
- **Nối với:** ESP32-S3 qua I2C.

## Thông số

| Thông số | Giá trị | Nguồn |
|---|---|---|
| Tầm đo | Tới 400 cm, tần số đo tới 50 Hz | Datasheet ST |
| Góc nhìn | 27° (thu hẹp được bằng ROI) | Datasheet ST |
| Địa chỉ I2C | 0x29 mặc định, đổi được (dùng chân XSHUT khi gắn nhiều cảm biến) | Trang breakout |
| Nguồn | Chip 2.8 V; bo breakout thường có ổn áp + chuyển mức (vd. bo Pololu nhận 2.6–5.5 V) — tùy bo cụ thể | Datasheet ST; Pololu |

## Lưu ý cho robot này

- Kiểm tra bo breakout cụ thể đã mua: dải điện áp, đã có điện trở kéo lên cho I2C chưa.

## Nguồn tham khảo (tra 2026-10-15)

- [VL53L1X datasheet](https://www.makerguides.com/wp-content/uploads/2024/10/VL53L1X-Datasheet.pdf)
- [Pololu VL53L1X carrier](https://pololu.com/product/3415/specs)
