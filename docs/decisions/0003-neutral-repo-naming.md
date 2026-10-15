# 0003 — Tên repo mô tả, không chứa tên sản phẩm

- **Trạng thái:** Đã chấp nhận
- **Ngày:** 2026-10-15

## Bối cảnh

- Tên sản phẩm đã đổi một lần (PTalk → Luni) và có thể còn đổi.
- Lần đổi tên trước làm bằng find-replace và làm hỏng code: `sounddevice` → `sounddLunice`, `DEVICE_MODEL` → `DLuniCE_MODEL`.
- Tên chỉ có "robot" thì quá chung, khó tìm; "robot" + "device" thì thừa.

## Quyết định

- Repo đặt theo mô tả: `ai-robot` (robot), `ai-robot-server` (server), `ai-robot-app` (app); chữ thường + gạch ngang (tên image Docker/GHCR bắt buộc chữ thường).
- Tên sản phẩm (hiển thị trên màn, BLE, app) **không** xuất hiện trong tên repo, package hay identifier; chỉ nằm trong **một** file cấu hình (tạo cùng code đầu tiên).

## Phương án đã cân nhắc

| Phương án | Vì sao không chọn |
|---|---|
| Tên sản phẩm làm tiền tố (`Luni_*`) | Đổi tên sản phẩm kéo theo đổi repo và code. |
| Tên chỉ theo vai trò (`robot-device`, …) | Không gợi nhớ, khó tìm. |
| Tên mã (codename) | Thêm một cái tên phải nhớ; người dùng chọn tên mô tả. |

## Hệ quả

- Đổi tên sản phẩm sau này = sửa một file cấu hình.
- Nếu thật sự cần, GitHub vẫn cho đổi tên repo và tự chuyển hướng link cũ.
