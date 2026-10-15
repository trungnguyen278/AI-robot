# Pin map

> Single source of truth for "which pin does what". Every wiring change updates this file (`hardware-change` checklist).
> Current state: **planned** — nothing is wired yet.

## Raspberry Pi 5 — 40-pin header

Only pins that are used or planned are listed. GPIO is 3.3 V and **not 5 V tolerant**.

| GPIO (BCM) | Physical pin | Function | Used for | Status |
|---|---|---|---|---|
| 2 / 3 | 3 / 5 | I2C1 SDA / SCL | ReSpeaker HAT codec | planned |
| 14 / 15 | 8 / 10 | UART0 TX / RX | Link to the ESP32-S3 | planned |
| 18 / 19 / 20 / 21 | 12 / 35 / 38 / 40 | I2S BCLK / LRCLK / DIN / DOUT | Audio: ReSpeaker **or** MAX98357A | planned — conflict, see [open issue 1](README.md#open-issues) |

Not on the header: display → DSI port; camera → CSI port; fan → fan connector; RTC battery → BAT connector.

### I2C addresses on the Pi's I2C1 bus

| Address | Device |
|---|---|
| unverified | TLV320AIC3104 codec (ReSpeaker HAT) |

## ESP32-S3 (body-controller)

| Function | Planned peripheral | GPIO | Status |
|---|---|---|---|
| Link to the Pi 5 | UART | TBD | planned |
| STS3215 servo bus | UART + direction pin (half-duplex) | TBD | planned |
| MG540 encoders, left / right | PCNT (A/B per wheel) | TBD | planned |
| Motor driver | PWM (LEDC/MCPWM) + DIR | TBD | planned |
| VL53L1X | I2C (0x29) | TBD | planned |
| NeoPixel | RMT | TBD | planned |
| Battery voltage | ADC + voltage divider | TBD | planned |
