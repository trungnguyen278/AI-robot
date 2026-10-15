# Quy ước phát triển

Áp dụng cho cả người và Claude. Dự án dài hơi → nhất quán quan trọng hơn nhanh.

## Ngôn ngữ

- Tài liệu: tiếng Việt, giữ thuật ngữ kỹ thuật tiếng Anh.
- Code, comment, tên biến/file code, commit message: tiếng Anh.

## Nhánh

- `main` luôn ở trạng thái dùng được và được bảo vệ: không commit thẳng — làm trên nhánh rồi merge qua Pull Request.
- Tên nhánh `<loại>/<mô-tả-ngắn>`, vd. `feat/wake-word`, `fix/servo-timeout`, `hw/power-tree`, `docs/adr-ros2`, `chore/ci`.

## Commit — Conventional Commits

`<type>(<scope>): <mô tả ngắn bằng tiếng Anh, thì hiện tại>`

| type | Khi nào |
|---|---|
| `feat` | Tính năng mới |
| `fix` | Sửa lỗi |
| `docs` | Chỉ tài liệu |
| `refactor` | Đổi cấu trúc, không đổi hành vi |
| `test` | Thêm/sửa test |
| `chore` | Việc lặt vặt: cấu hình, CI, dọn dẹp |

Scope = khối bị ảnh hưởng: `software`, `firmware`, `protocol`, `hardware`, `docs`, `tools`, `claude`, `ci`.

Ví dụ: `feat(firmware): read MG540 encoders with PCNT`

## Tài liệu đi cùng thay đổi

- Đổi phần cứng → cập nhật `hardware/` trong cùng commit (skill `hardware-change`).
- Đổi giao thức → sửa `protocol/` trước, rồi cả hai phía, trong cùng một PR.
- Quyết định kỹ thuật quan trọng → ADR trong `docs/decisions/` (skill `adr`).
- Kết thúc một buổi làm → ghi `docs/devlog/` (skill `devlog`).

## Bí mật & file lớn

- Không commit mật khẩu Wi-Fi, API key, token thiết bị. Dùng `.env` (đã gitignore) và commit `.env.example` không chứa giá trị thật.
- Không commit file lớn (model AI, video, CAD nặng, bản dump). Dùng Git LFS hoặc GitHub Releases, ghi link tải trong README của thư mục tương ứng.

## Thông số & nguồn

- Thông số phần cứng phải có nguồn (datasheet/tài liệu hãng); chưa chắc → ghi "chưa xác minh".
- Giá, phiên bản phần mềm/firmware: ghi kèm ngày.
