# ReSpeaker 2-Mics Pi HAT V2.0

> Cập nhật: 2026-10-15.

- **Vai trò:** thu âm (2 mic), có thể phát loa.
- **Nối với:** header 40 chân của Pi 5 (I2S + I2C).

## Thông số

| Thông số | Giá trị | Nguồn |
|---|---|---|
| Codec | TLV320AIC3104 (V2.0 thay cho WM8960 của V1) | Datasheet sản phẩm (DigiKey) |
| Hỗ trợ Pi 5 | Có (nhờ đổi codec) | Datasheet sản phẩm (DigiKey) |
| Tần số lấy mẫu | 8–96 kHz | Datasheet sản phẩm (DigiKey) |
| Ngõ ra | Cổng loa JST 2.0 + jack 3.5 mm | BeagleY-AI pinout |
| Nguồn | Có cổng Micro USB; nên cấp thêm khi dùng loa | BeagleY-AI pinout |

## Lưu ý cho robot này

- Chiếm nhóm I2S duy nhất của Pi (GPIO18–21) → không dùng song song với MAX98357A theo cách thông thường. Chọn một: dùng cổng loa của HAT (kiểm tra công suất ra có đủ cho loa 4Ω 3W không) hoặc bỏ HAT.
- Chỉ 2 mic, không có khử tiếng vọng (AEC) phần cứng → khó ngắt lời robot bằng giọng khi loa đang phát, tiếng động cơ/bánh xích lọt vào mic. Phương án: AEC phần mềm (WebRTC APM, speexdsp) hoặc mic array USB có AEC phần cứng.
- Địa chỉ I2C của codec: chưa xác minh.

## Nguồn tham khảo (tra 2026-10-15)

- [ReSpeaker 2-Mics Pi HAT V2.0 — datasheet (DigiKey)](https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/8891/107100001_1.pdf)
- [ReSpeaker 2-Mics pHAT — BeagleY-AI pinout](https://pinout.beagleboard.io/pinout/respeaker_2_mics_phat)
