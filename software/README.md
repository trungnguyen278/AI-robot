# software/ — code chính trên Raspberry Pi 5

> Trống — chờ chốt nền tảng (OS, ROS 2 hay không, ngôn ngữ): xem câu hỏi mở trong [`docs/architecture.md`](../docs/architecture.md).

Sẽ chứa các phần chạy trên Pi 5 (Linux):

| Phần | Việc |
|---|---|
| audio | Mic, loa, wake word, VAD, AEC, hội thoại với server |
| vision | Camera AI (IMX500): phát hiện người/vật, theo dõi khuôn mặt |
| face | Khuôn mặt biểu cảm trên màn 7" |
| body link | Nói chuyện với ESP32-S3 theo [`protocol/`](../protocol/README.md) |
| behavior | Điều phối: trạng thái robot, phản ứng với sự kiện |
| net | Kết nối `ai-robot-server`, BLE với `ai-robot-app`, cập nhật phần mềm |

Cấu trúc thư mục con sẽ quyết định cùng lựa chọn nền tảng (ADR). Tên hiển thị của robot nằm trong một file cấu hình duy nhất, không hard-code ([ADR-0003](../docs/decisions/0003-neutral-repo-naming.md)).
