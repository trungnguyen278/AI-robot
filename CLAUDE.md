# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong repo này. Người dùng cũng đọc và sửa file này.

## Dự án

**ai-robot** — robot AI di động: khung bánh xích, 2 tay gắp, cổ 2 DOF mang màn hình 7" làm "khuôn mặt", nghe–nói bằng giọng nói, nhìn bằng camera AI.

- **Não:** Raspberry Pi 5 (8GB) — có sẵn Wi-Fi (802.11ac) và Bluetooth 5.0/BLE.
- **Thân:** ESP32-S3 — chỉ lo I/O thời gian thực (servo bus, động cơ + encoder, cảm biến, LED).
- Dự án dài hơi, làm lúc rảnh trong nhiều năm → ưu tiên rõ ràng, có tài liệu, quyết định được ghi lại; không tối ưu sớm.

**Trạng thái:** mới có khung dự án, chưa có code. Muốn biết đang ở đâu: đọc `docs/roadmap.md` và file mới nhất trong `docs/devlog/`.

## Giao tiếp & ngôn ngữ

- Người dùng viết tiếng Việt → trả lời bằng tiếng Việt.
- Tài liệu (`docs/`, các README): tiếng Việt, giữ nguyên thuật ngữ kỹ thuật tiếng Anh.
- Code, comment, tên biến/file code, commit message: tiếng Anh.

## Bản đồ repo

| Thư mục | Nội dung |
|---|---|
| `software/` | Code chính chạy trên Raspberry Pi 5 (Linux) |
| `firmware/` | Code các module vi điều khiển; `body-controller/` = ESP32-S3 điều khiển thân |
| `protocol/` | Giao thức Pi ⇄ module — nguồn duy nhất cho cả hai phía |
| `hardware/` | BOM (`bom.csv`), phân bổ chân (`pinmap.md`), cây nguồn, ghi chú linh kiện (`components/`), bản vẽ (`cad/`) |
| `docs/` | Tầm nhìn, kiến trúc, roadmap, ADR (`decisions/`), nhật ký (`devlog/`), thế hệ trước (`legacy.md`) |
| `tools/` | Script tiện ích |

## Nguyên tắc bất biến

1. **Không dùng ESP làm card mạng.** Pi 5 có sẵn Wi-Fi/BLE; ESP32-S3 chỉ làm việc thời gian thực (ADR-0002).
2. **Giao thức Pi ⇄ module chỉ định nghĩa một lần** trong `protocol/`; hai phía sinh ra hoặc dùng chung từ đó, không chép tay định nghĩa sang hai nơi.
3. **Không hard-code tên sản phẩm.** Tên robot chưa chốt và có thể đổi; tên hiển thị (màn hình, BLE, app) chỉ nằm trong một file cấu hình. Tên repo/package/identifier dùng mô tả trung tính (ADR-0003).
4. **An toàn điện:** không cấp nguồn servo/động cơ từ nhánh 5V của Pi; công tắc khẩn cấp phải ngắt động cơ và servo; ESP32-S3 phải tự dừng an toàn khi mất heartbeat từ Pi. Mọi thay đổi nối dây/nguồn cập nhật `hardware/` trong cùng commit (skill `hardware-change`).
5. **Không commit bí mật** (mật khẩu Wi-Fi, API key, token thiết bị): dùng `.env` (đã gitignore) + `.env.example`.
6. **Thông số phần cứng phải có nguồn** (datasheet, tài liệu hãng). Chưa xác minh thì ghi rõ "chưa xác minh". Giá và phiên bản phần mềm/firmware ghi kèm ngày. Không ghi thông số theo trí nhớ.
7. **Quyết định quan trọng phải có ADR** (skill `adr`) để vài năm sau vẫn biết vì sao. Không tự chốt thay người dùng: quyết định chưa được đồng ý thì để trạng thái "Đề xuất".

## Skills của repo (`.claude/skills/`)

| Skill | Dùng khi |
|---|---|
| `pi5-platform` | Đụng tới phần cứng/OS phía Pi 5: chân GPIO, nguồn, `config.txt`/EEPROM, overlay, tản nhiệt, thư viện GPIO |
| `hardware-change` | Thêm/đổi linh kiện, nối dây, đổi chân, đổi nguồn |
| `adr` | Ghi lại hoặc thay đổi một quyết định kỹ thuật |
| `devlog` | Bắt đầu buổi làm (đang ở đâu?) và kết thúc buổi làm (ghi nhật ký) |

## Quy ước làm việc

@CONTRIBUTING.md
