# protocol/ — giao thức Pi 5 ⇄ module

> Trống — định dạng chưa chốt (sẽ có ADR).

**Nguồn duy nhất** cho mọi định nghĩa trao đổi giữa Pi 5 và các module vi điều khiển: loại gói tin, trường dữ liệu, mã lỗi, trạng thái. Code của hai phía phải sinh ra hoặc dùng chung từ đây — không chép tay định nghĩa sang hai nơi (thế hệ trước phải đồng bộ tay hai bản `StateTypes`).

## Yêu cầu dự kiến

- Có số phiên bản giao thức; hai bên kiểm tra khi kết nối.
- Đóng khung gói tin + CRC; chịu được mất/hỏng byte.
- Heartbeat hai chiều; ESP32-S3 tự về trạng thái an toàn khi mất heartbeat.
- Lệnh quan trọng có xác nhận (ack).

## Ứng viên định dạng

- Schema + sinh code, vd. Protocol Buffers (nanopb cho ESP32).
- Gói nhị phân tự định nghĩa + framing (vd. COBS) + CRC, mô tả trong một file spec rồi sinh header C++/Python.
