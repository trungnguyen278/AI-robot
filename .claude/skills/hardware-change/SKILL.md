---
name: hardware-change
description: Checklist for adding, replacing or re-wiring hardware on the robot — research a part from its datasheet, record verified specs in hardware/components/, and keep the BOM, pin map and power tree in sync in the same commit. Use when the user adds or swaps a component (linh kiện, module, cảm biến, servo, động cơ, màn hình, mic, loa), changes wiring or pin assignments (nối dây, đổi chân), or changes power distribution (pin, sạc, DC-DC, cầu chì, công tắc khẩn cấp).
---

# Thay đổi phần cứng

Mục tiêu: sau mỗi thay đổi, `hardware/` vẫn mô tả **đúng** robot thật, để vài năm sau mở ra vẫn tin được.

## 1. Tìm hiểu linh kiện

- Tra datasheet/tài liệu của hãng trước, trang shop sau. Ghi rõ mẫu/phiên bản: nhiều linh kiện có nhiều biến thể (vd. STS3215 có bản 7.4V và bản 12V).
- Tạo/cập nhật `hardware/components/<ten-linh-kien>.md` theo mẫu [component-template.md](component-template.md).
- Mỗi thông số kèm nguồn. Chỉ có nguồn thứ cấp hoặc tự suy luận → ghi "chưa xác minh".

## 2. Kiểm tra điện

- [ ] Mức logic: 3.3V hay 5V? Pi 5 và ESP32-S3 đều 3.3V, không chịu 5V.
- [ ] Dòng: dòng thường **và** dòng đỉnh/stall. Cộng vào bảng công suất trong `hardware/README.md`; nhánh nguồn (DC-DC 5V, nhánh 12V servo, driver động cơ) còn đủ không.
- [ ] Bảo vệ: có nằm sau cầu chì và công tắc khẩn cấp không (bắt buộc với động cơ/servo).
- [ ] Các khối giao tiếp với nhau phải chung GND.

## 3. Kiểm tra chân & bus

- [ ] Trùng chân trong `hardware/pinmap.md` (cả Pi 5 và ESP32-S3).
- [ ] Trùng địa chỉ I2C; còn UART trống không; I2S của Pi chỉ có một nhóm chân.
- [ ] Nối vào Pi → xem thêm skill `pi5-platform`.

## 4. Cập nhật trong CÙNG commit

- [ ] `hardware/bom.csv` (thêm/sửa dòng; cột `status`: proposed → planned → ordered → received → installed)
- [ ] `hardware/pinmap.md`
- [ ] `hardware/README.md` (cây nguồn, bảng công suất, vấn đề mở)
- [ ] `hardware/components/<ten-linh-kien>.md`
- Commit scope `hardware`, vd. `feat(hardware): add VL53L1X ToF sensor on ESP32 I2C`.

## 5. Nếu là quyết định lớn

Đổi linh kiện chính (bo mạch, khung, nguồn, loại servo/động cơ…) → viết ADR (skill `adr`).
