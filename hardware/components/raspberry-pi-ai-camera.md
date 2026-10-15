# Raspberry Pi AI Camera (Sony IMX500)

> Cập nhật: 2026-10-15. Nguồn là trang shop/đại lý — đối chiếu tài liệu chính hãng khi có.

- **Vai trò:** "mắt" — chạy model thị giác ngay trên cảm biến, giảm tải CPU của Pi.
- **Nối với:** cổng CSI của Pi 5 (cáp đi kèm).

## Thông số

| Thông số | Giá trị | Nguồn |
|---|---|---|
| Cảm biến | Sony IMX500, 12.3 MP, có bộ tăng tốc mạng nơ-ron | Pimoroni; Mouser |
| Chế độ | 2028×1520 @30 fps (binning 2×2); 4056×3040 @10 fps; 10-bit | Pimoroni |
| Ống kính | F1.79, tiêu cự 4.74 mm, lấy nét tay 20 cm–∞; FoV ~78° chéo (66° ngang / 52.3° dọc) | Pimoroni; Mouser |
| Bộ điều khiển | RP2040 + flash 16 MB để nạp/cache model | CNX Software |
| Đầu vào model | Tensor tối đa 640×640, int8/uint8 | Mouser |
| Phần mềm | libcamera, Picamera2, rpicam-apps; kết quả suy luận đi kèm khung hình dưới dạng metadata | PiShop; Mouser |
| Model mẫu | MobileNet SSD (phát hiện vật), PoseNet (tư thế); chuyển model từ PyTorch/TensorFlow bằng công cụ của Raspberry Pi | Elektor |

## Lưu ý cho robot này

- Lấy nét bằng tay → chỉnh theo khoảng cách làm việc chính trước khi lắp cố định.
- Model vượt giới hạn của IMX500 → chạy trên CPU Pi hoặc server.

## Nguồn tham khảo (tra 2026-10-15)

- [Pimoroni](https://shop.pimoroni.com/en-eu/products/raspberry-pi-ai-camera)
- [Mouser](https://www.mouser.com/new/raspberry-pi/raspberry-pi-ai-camera/)
- [CNX Software](https://www.cnx-software.com/2024/10/01/raspberry-pi-ai-camera-with-sony-imx500-ai-sensor-and-rp2040-mcu/)
- [Elektor](https://elektormagazine.com/articles/raspberry-pi-ai-camera)
- [PiShop](https://www.pishop.us/product/raspberry-pi-ai-camera/)
