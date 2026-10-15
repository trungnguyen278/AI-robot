---
name: devlog
description: Keep continuity in this long-running, spare-time project. At the start of a work session, read the latest dev log and the roadmap to recall where things stand; at the end, append a dated entry (done, decisions, problems, next steps) and update roadmap checkboxes. Use when starting or resuming work ("đang làm đến đâu", "tiếp tục", "hôm trước làm gì") or wrapping up ("tổng kết", "ghi nhật ký", "kết thúc buổi", "hôm nay làm được gì").
---

# Nhật ký phát triển

Dự án làm lúc rảnh, có thể ngắt quãng hàng tháng → nhật ký là trí nhớ chung của người dùng và Claude.

## Khi bắt đầu

1. Đọc file mới nhất trong `docs/devlog/` (tên `YYYY-MM.md`) và `docs/roadmap.md`.
2. Tóm tắt cho người dùng trong 3–5 dòng: lần trước làm gì, đang dở gì, bước tiếp theo đã ghi.

## Khi kết thúc

1. Thêm mục vào cuối `docs/devlog/YYYY-MM.md` (tháng mới thì tạo file mới) theo mẫu:

   ```markdown
   ## YYYY-MM-DD — <tiêu đề ngắn>

   **Đã làm:** …
   **Quyết định:** … (link ADR nếu có)
   **Vấn đề / còn dở:** …
   **Bước tiếp theo:** …
   ```

2. Tick/cập nhật mục tương ứng trong `docs/roadmap.md`.
3. Viết ngắn: nhật ký để nhớ lại, không phải báo cáo. Chi tiết đã nằm trong commit/ADR thì chỉ cần link.
