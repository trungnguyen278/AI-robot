# ai-robot

> **Trạng thái:** đang khởi tạo — mới có khung dự án và tài liệu, chưa có code.

Robot AI di động chạy bánh xích, có **2 tay gắp**, **cổ 2 bậc tự do** mang màn hình 7" làm khuôn mặt biểu cảm, nghe–nói bằng giọng nói và nhìn bằng camera AI.

- **Não:** Raspberry Pi 5 (8GB) — audio, thị giác, giao diện, AI, kết nối mạng (Wi-Fi/BLE có sẵn trên Pi).
- **Thân:** ESP32-S3 — điều khiển thời gian thực: servo, động cơ + encoder, cảm biến, LED.

![Concept v0](hardware/images/concept-v0.webp)

*Concept v0 — bản phác nhanh, cánh tay có thể còn thay đổi.*

## Cấu trúc repo

```
ai-robot/
├── software/    Code chính chạy trên Raspberry Pi 5
├── firmware/    Code các module vi điều khiển (body-controller = ESP32-S3)
├── protocol/    Giao thức Pi ⇄ module — nguồn duy nhất cho cả hai phía
├── hardware/    BOM, cây nguồn, phân bổ chân, ghi chú linh kiện, bản vẽ
├── docs/        Tầm nhìn, kiến trúc, roadmap, quyết định (ADR), nhật ký
├── tools/       Script tiện ích
└── .claude/     Cấu hình và skill cho Claude Code (xem CLAUDE.md)
```

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [Tầm nhìn](docs/vision.md) | Robot sẽ làm được gì |
| [Kiến trúc](docs/architecture.md) | Các khối, cách chúng nói chuyện với nhau, câu hỏi còn mở |
| [Roadmap](docs/roadmap.md) | Các giai đoạn và việc đang làm |
| [Quyết định (ADR)](docs/decisions/README.md) | Vì sao chọn Pi 5 8GB, ESP32-S3, cách đặt tên… |
| [Phần cứng](hardware/README.md) | Linh kiện, cây nguồn, chân, vấn đề đang mở |
| [Quy ước](CONTRIBUTING.md) | Nhánh, commit, tài liệu, bí mật |

## Repo liên quan

| Repo | Vai trò | Trạng thái |
|---|---|---|
| `ai-robot-server` | Server AI và quản lý thiết bị | Chưa tạo |
| `ai-robot-app` | App điện thoại | Chưa tạo |
| [Luni_Robot](https://github.com/trungnguyen278/Luni_Robot) | Thế hệ trước (ESP32-S3 + ESP32-C5) | Lưu trữ — xem [docs/legacy.md](docs/legacy.md) |

## Giấy phép

[MIT](LICENSE)
