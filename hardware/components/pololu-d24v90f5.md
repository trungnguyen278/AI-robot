# Pololu D24V90F5 — DC-DC hạ áp 5V

> Cập nhật: 2026-10-15.

- **Vai trò:** tạo nhánh 5V cho Pi 5 và ngoại vi từ pin 3S.

## Thông số

| Thông số | Giá trị | Nguồn |
|---|---|---|
| Điện áp vào | 5–38 V; thực tế cần ≥ 5 V + sụt áp 0.5–1.5 V (tăng theo tải); khóa thấp áp ~4.2 V | Pololu |
| Điện áp ra | 5 V | Pololu |
| Dòng ra | "~9 A" (tiêu đề); dòng liên tục điển hình 4–8 A tùy điện áp vào và tản nhiệt | Pololu |
| Hiệu suất | 80–95 % | Pololu |
| Bảo vệ | Ngược cực, ngắn mạch, quá nhiệt (~160 °C), soft-start | Pololu |

## Lưu ý cho robot này

- Pin 3S (9.0–12.6 V tùy mức xả) nằm thoải mái trong dải vào.
- Đừng thiết kế theo con số 9 A: Pi 5 (tới 5 A khi tải nặng + USB) + màn + HAT + ampli + ESP32-S3 + LED → lập bảng công suất trong [`hardware/README.md`](../README.md) và để dư.

## Nguồn tham khảo (tra 2026-10-15)

- [Pololu — D24V90F5](https://www.pololu.com/product/2866)
