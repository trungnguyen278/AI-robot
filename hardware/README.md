# Phần cứng

> Theo **concept v0** (2026-10-15). Còn nhiều chi tiết mở — xem cuối trang. Thiết kế cánh tay có thể đổi.

![Concept v0](images/concept-v0.webp)

## Các khối chính

| Khối | Linh kiện | Ghi chú |
|---|---|---|
| Khung | TZTMOTOR R3 High-End | 2 động cơ MG540 có encoder, bánh xích, hệ treo |
| Não | Raspberry Pi 5 8GB + Active Cooler | [ghi chú](components/raspberry-pi-5.md) |
| Thân | ESP32-S3-DevKitC-1 | Code: [`firmware/body-controller/`](../firmware/body-controller/README.md) |
| Cổ & tay | 8 × FEETECH STS3215 (servo bus, bản 12V) | Cổ 2 DOF, mỗi tay 3 DOF — [ghi chú](components/feetech-sts3215.md) |
| Mặt | Waveshare 7inch DSI LCD (C) | [ghi chú](components/waveshare-7inch-dsi-lcd-c.md) |
| Mắt | Raspberry Pi AI Camera (IMX500) | [ghi chú](components/raspberry-pi-ai-camera.md) |
| Tai & miệng | ReSpeaker 2-Mics Pi HAT V2.0; MAX98357A + loa 4Ω 3W | Xem vấn đề mở #1 — [ghi chú](components/respeaker-2mics-pi-hat-v2.md) |
| Cảm biến | VL53L1X (ToF), LED NeoPixel | Nối vào ESP32-S3 — [ghi chú VL53L1X](components/vl53l1x.md) |
| Nguồn | Pin Li-ion 3S, sạc 3S, cầu chì 25–30A, công tắc khẩn cấp HY57B, DC-DC 5V Pololu D24V90F5 | [ghi chú DC-DC](components/pololu-d24v90f5.md) |

Danh sách đầy đủ: [bom.csv](bom.csv) (cột `status`: proposed → planned → ordered → received → installed) · Phân bổ chân: [pinmap.md](pinmap.md) · Ghi chú linh kiện: [components/](components/README.md) · Bản vẽ: [cad/](cad/README.md)

## Cây nguồn (dự kiến, theo concept v0)

```
Pin Li-ion 3S (9.0–12.6 V)
└─ Cầu chì 25–30 A
   └─ Công tắc khẩn cấp HY57B          (phạm vi ngắt: xem vấn đề mở #5)
      ├─ Driver động cơ 2 kênh ──────► MG540 × 2 (encoder → ESP32-S3)
      ├─ Nhánh 12 V servo ───────────► STS3215 × 8 (qua mạch servo bus)
      └─ DC-DC 5 V (D24V90F5) ───────► Raspberry Pi 5 ─► màn 7", ReSpeaker, camera
                                      MAX98357A, ESP32-S3, NeoPixel
Sạc 3S ──► pin
```

## Bảng công suất (điền dần)

| Nhánh | Tải | Ước tính | Nguồn số liệu |
|---|---|---|---|
| 5 V | Raspberry Pi 5 | ~3 W rảnh, ~9 W CPU tải đầy, tới 25 W (5 A) nếu tính cả USB | [ghi chú Pi 5](components/raspberry-pi-5.md) |
| 5 V | Màn 7", ReSpeaker, MAX98357A, ESP32-S3, NeoPixel | chưa xác minh | — |
| 12 V servo | STS3215 × 8 | 180 mA/con không tải; **2.7 A/con khi stall** (8 con ~21.6 A nếu kẹt cùng lúc) | [ghi chú STS3215](components/feetech-sts3215.md) |
| Pin | Động cơ MG540 × 2 | chưa xác minh (theo bộ R3) | — |

## Vấn đề đang mở

1. **Trùng I2S.** ReSpeaker 2-Mics HAT V2.0 dùng nhóm I2S duy nhất của Pi (GPIO18–21); MAX98357A cũng cần I2S. HAT đã có cổng loa JST 2.0 + jack 3.5 mm → hoặc bỏ MAX98357A (nếu cổng loa của HAT đủ công suất cho loa 4Ω 3W), hoặc bỏ HAT và dùng mic I2S + MAX98357A.
2. **Servo bus half-duplex.** STS3215 dùng TTL một dây half-duplex → cần mạch chuyển (bus servo adapter hoặc đệm 3 trạng thái kiểu 74HC126 + chân hướng) giữa UART của ESP32-S3 và bus. Đã thêm vào BOM dạng `proposed`.
3. **Dòng servo.** Dòng stall tới ~21.6 A nếu 8 servo kẹt cùng lúc → nhánh servo nên có cầu chì riêng và dây đủ tiết diện; xác nhận mua đúng **bản 12V** (bản 7.4V không chịu được 12V).
4. **Nguồn Pi qua chân 5V header.** Không có thương lượng USB-PD → tổng dòng USB bị giới hạn ~600 mA; cần `usb_max_current_enable=1` hoặc `PSU_MAX_CURRENT=5000` (chỉ khi nguồn đủ 5 A). D24V90F5 ghi "9 A" nhưng dòng liên tục điển hình 4–8 A → lập bảng công suất nhánh 5 V và để dư.
5. **Phạm vi công tắc khẩn cấp.** Bắt buộc ngắt động cơ + servo. Có ngắt luôn Pi không? Ngắt Pi = mất điện đột ngột (rủi ro hỏng thẻ nhớ) → nghiêng về chỉ ngắt động cơ + servo.
6. **Đo pin & tắt máy an toàn.** Pi không có ADC → đo qua ADC của ESP32-S3 (cầu chia áp) hoặc IC INA219/INA226 (đo cả dòng). Pin yếu → Pi phải tắt máy sạch trước khi sập nguồn.
7. **Wi-Fi trong khung kim loại.** Pi 5 dùng ăng-ten trên bo (chưa xác minh là không có cổng ăng-ten ngoài). Sóng yếu → USB Wi-Fi có ăng-ten ngoài.
8. **Thông số động cơ MG540 + driver** (điện áp, dòng, độ phân giải encoder): chưa có → cần để chọn cách đọc encoder (dự kiến PCNT trên ESP32-S3).
9. **Thiết kế tay.** Tay 3 DOF có thể đổi. STS3215 cũng là servo của tay SO-100/SO-101 (dự án LeRobot) → có thể tham khảo thiết kế đó.

## Lưu ý lắp ráp (từ concept v0)

1. Kiểm tra thông số pin, driver theo bộ R3 trước khi lắp.
2. Dây encoder MG540 nối về ESP32-S3 (tùy driver).
3. Không cấp nguồn servo từ nhánh 5V của Pi.
4. Cố định dây gọn, tránh bánh xích và các khớp chuyển động.
5. Chừa khoảng tản nhiệt cho Pi và driver.
6. Đo kích thước thực tế của khung trước khi gia công giá đỡ.
7. Chạy thử từng phần (động cơ, servo, camera…) trước khi lắp hoàn chỉnh.
