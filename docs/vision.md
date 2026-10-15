# Tầm nhìn

> Bản nháp đầu (2026-10-15), dựng từ concept v0 và những gì thế hệ trước đã làm. Sửa thoải mái theo ý tưởng của bạn.

Một robot đồng hành trong nhà: tự di chuyển, nhìn – nghe – nói, thể hiện cảm xúc trên "khuôn mặt" và dùng hai tay để tương tác với đồ vật.

## Năng lực mong muốn (ý tưởng ban đầu)

| Nhóm | Năng lực | Ghi chú |
|---|---|---|
| Giao tiếp | Gọi bằng wake word, trò chuyện bằng giọng nói | Thế hệ trước đã có wake word + hội thoại qua cloud |
| | Ngắt lời robot khi nó đang nói (barge-in) | Cần khử tiếng vọng (AEC) |
| Biểu cảm | Khuôn mặt (đôi mắt) biểu cảm trên màn 7" | Kế thừa ngôn ngữ thiết kế cảm xúc từ Luni |
| | Cổ xoay nhìn theo người đang nói | Cổ 2 DOF + camera |
| Thị giác | Nhận diện người, khuôn mặt, đồ vật | Camera IMX500 chạy model ngay trên cảm biến |
| Di chuyển | Lái bánh xích, tránh vật cản, đi theo người | Encoder + cảm biến ToF + camera |
| Thao tác | Vẫy tay, chỉ trỏ, gắp đồ nhẹ | 2 tay 3 DOF; thiết kế tay có thể đổi |
| Kết nối | App điện thoại: ghép nối, cài đặt, điều khiển | `ai-robot-app` |
| | Server AI: STT/LLM/TTS, quản lý thiết bị | `ai-robot-server` |

## Ý tưởng khác

<!-- Thêm vào đây khi nghĩ ra. Ý tưởng chi tiết hơn: mở issue theo mẫu "Ý tưởng / tính năng". -->
