# Pin map

> Single source of truth for "which pin does what". Every wiring change updates this file (`hardware-change` checklist).
> Current state: **planned** — nothing is wired yet.

## Raspberry Pi 5 — 40-pin header

Only pins that are used or planned are listed. GPIO is 3.3 V and **not 5 V tolerant**.

| GPIO (BCM) | Physical pin | Function | Used for | Status |
|---|---|---|---|---|
| 7 | 26 | SPI0 CE1 | TPM chip select | proposed |
| 9 / 10 / 11 | 21 / 19 / 23 | SPI0 MISO / MOSI / SCLK | TPM | proposed |
| 14 / 15 | 8 / 10 | UART0 TX / RX | Link to the ESP32-S3 | planned |
| 24 | 18 | GPIO, left as an input | TPM reset (RST#) | proposed |
| — | 17 / 20 / 25 | 3.3 V / GND / GND | TPM supply | proposed |

- The TPM module covers pins 17 to 26, so GPIO8 (SPI0 CE0, pin 24) and GPIO25 (pin 22) stay unused ([TPM notes](components/letstrust-tpm.md)).
- Nothing else on SPI0 may listen without a chip select.

Not on the header: display → DSI port; camera → CSI port; microphones and speaker → USB, through the XVF3800 array ([ADR-0011](../docs/decisions/0011-audio-voice-processor.md)); fan → fan connector; RTC battery → BAT connector.

### I2C addresses on the Pi's I2C1 bus

None: nothing on the header uses I2C1.

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
