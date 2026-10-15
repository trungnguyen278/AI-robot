# firmware/ — code cho các module vi điều khiển

Mỗi module một thư mục con.

| Module | MCU | Vai trò |
|---|---|---|
| [body-controller](body-controller/README.md) | ESP32-S3-DevKitC-1 | I/O thời gian thực của thân robot |

- Toolchain: chưa chốt (thế hệ trước dùng ESP-IDF 5.5 + PlatformIO, C++17).
- Với ESP-IDF: commit `sdkconfig.defaults`, không commit `sdkconfig` (sinh ra khi build, đã gitignore).
