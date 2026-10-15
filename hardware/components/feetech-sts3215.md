# FEETECH STS3215 — servo bus

> Cập nhật: 2026-10-15. Nguồn chủ yếu là trang shop → đối chiếu lại datasheet Feetech khi có.

- **Vai trò:** cổ 2 DOF + mỗi tay 3 DOF.
- **Mẫu:** bản **12V** (ST-3215-C018, "30 kg·cm"). Cùng tên STS3215 còn có bản 6–8.4V (19.5 kg·cm) — **không cấp 12V cho bản đó**.
- **Số lượng:** 8.
- **Nối với:** ESP32-S3 qua mạch servo bus half-duplex; nguồn nhánh 12V.

## Thông số

| Thông số | Bản 12V | Bản 7.4V | Nguồn |
|---|---|---|---|
| Điện áp | 4–14 V (danh định 12 V) | 6–7.4 V (danh định 7.4 V) | RobotShop; Eckstein |
| Mô-men stall | 30 kg·cm @12V | 19.5 kg·cm @7.4V | RobotShop; Sigmanortec |
| Dòng stall | 2.7 A @12V | 2.0 A @6V | RobotShop; Eckstein |
| Dòng không tải | 180 mA | — | RobotShop |
| Tốc độ không tải | 0.222 s/60° | — | RobotShop |
| Encoder | Từ, 12-bit: 4096 bước/360° | (chung) | Nhiều nguồn |
| Giao tiếp | TTL nối tiếp **half-duplex**, 38400 bps – 1 Mbps, ID 0–253 | (chung) | RobotShop |
| Phản hồi | Vị trí, tốc độ, điện áp, dòng, tải | (chung) | Nhiều nguồn |
| Kích thước / khối lượng | 45.2 × 24.7 × 35 mm, ~55 g | (chung) | Nhiều nguồn |

## Lưu ý cho robot này

- Half-duplex một dây → **không nối thẳng TX/RX của ESP32**; cần bus servo adapter hoặc mạch đệm 3 trạng thái (kiểu 74HC126) + chân điều hướng.
- 8 con × 2.7 A stall = **~21.6 A** nếu kẹt cùng lúc → nhánh servo cần cầu chì riêng, dây đủ tiết diện, nguồn chịu được dòng đỉnh. Thực tế thường thấp hơn nhiều, nhưng bảo vệ phải thiết kế theo trường hợp xấu.
- STS3215 cũng là servo của tay robot SO-100/SO-101 (dự án LeRobot) → có thể tham khảo nếu thiết kế lại tay.

## Nguồn tham khảo (tra 2026-10-15)

- [RobotShop — FeeTech 12V 30kg.cm STS3215](https://uk.robotshop.com/products/feetech-12v-30kgcm-magnetic-encoding-servo-sts3215)
- [Eckstein — STS3215 / ST-3215-C018](https://eckstein-shop.de/Motors?mf=1602)
- [Eckstein — STS3215 bản 7.4V](https://eckstein-shop.de/Motors?mf=1611)
- [Sigmanortec — STS3215 7.4V](https://sigmanortec.ro/en/servo-smart-serial-sts3215-360-degrees-19kg-12-bit-encoder-74v)
