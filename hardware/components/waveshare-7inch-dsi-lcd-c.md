# Waveshare 7inch DSI LCD (C)

> Cập nhật: 2026-10-15.

- **Vai trò:** "khuôn mặt" — hiển thị đôi mắt/biểu cảm.
- **Nối với:** cổng DSI của Pi 5.

## Thông số

| Thông số | Giá trị | Nguồn |
|---|---|---|
| Màn | IPS 7", 1024×600 | Waveshare |
| Cảm ứng | Điện dung 5 điểm | Waveshare |
| Hỗ trợ | Pi 5/4B/CM4/3B+/…; Raspberry Pi OS | Waveshare |
| Kết nối Pi 5 | Cáp "DSI-Cable-12cm" vào cổng DSI 22 chân; cấp 5V; cảm ứng qua I2C (theo wiki) | Waveshare wiki |
| Dòng tiêu thụ | chưa xác minh | — |

## Lưu ý cho robot này

- Dòng `dtoverlay` phải lấy từ wiki của đúng bản (C): bản 7" 800×480 cũ dùng overlay khác.
- Màn gắn trên cổ 2 DOF → tính mô-men cho servo cổ (khối lượng màn: chưa xác minh).

## Nguồn tham khảo (tra 2026-10-15)

- [Waveshare wiki — 7inch DSI LCD (C)](https://www.waveshare.com/wiki/7inch_DSI_LCD_(C))
- [Trang sản phẩm](https://www.waveshare.com/product/raspberry-pi/7inch-dsi-lcd-c.htm)
