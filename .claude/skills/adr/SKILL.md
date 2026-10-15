---
name: adr
description: Record an architecture/design decision as an ADR (Architecture Decision Record) in docs/decisions/. Use when a significant technical choice is made, revisited or reversed — compute platform, OS, frameworks (e.g. ROS 2 or not), languages, Pi⇄ESP32 protocol format, power architecture, how work is split between Pi/ESP32/server — or when the user asks to write down a decision or why something was chosen ("ghi lại quyết định", "vì sao chọn …").
---

# Ghi quyết định (ADR)

1. Đọc `docs/decisions/README.md`: lấy số tiếp theo, xem đã có ADR liên quan chưa.
2. Copy `docs/decisions/0000-template.md` thành `docs/decisions/NNNN-short-title.md` (4 chữ số, kebab-case tiếng Anh).
3. Điền: Bối cảnh → Quyết định → Phương án đã cân nhắc (kèm lý do loại) → Hệ quả (tốt và xấu) → Nguồn. Viết tiếng Việt, ngắn, có số liệu/nguồn nếu có.
4. Trạng thái: `Đề xuất` khi còn bàn; `Đã chấp nhận` khi người dùng đã đồng ý. Không tự đánh `Đã chấp nhận` cho điều người dùng chưa chốt.
5. Đổi quyết định cũ: **không sửa nội dung ADR cũ** — đổi trạng thái của nó thành `Bị thay thế bởi NNNN` rồi viết ADR mới.
6. Thêm một dòng vào bảng trong `docs/decisions/README.md`.
7. Commit scope `docs`, vd. `docs(decisions): add ADR-0004 choose ROS 2`.
