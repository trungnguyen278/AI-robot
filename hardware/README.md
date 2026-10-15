# Hardware

> Based on **concept v0** (2026-10-15). Many details are still open — see the end of this page. The arm design may change.

![Concept v0](images/concept-v0.webp)

*Concept v0 — a quick sketch with labels in Vietnamese.*

## Main blocks

| Block | Parts | Notes |
|---|---|---|
| Chassis | TZTMOTOR R3 High-End | 2 MG540 motors with encoders, tracks, suspension |
| Brain | Raspberry Pi 5 (8 GB) + Active Cooler | [notes](components/raspberry-pi-5.md) |
| Body controller | ESP32-S3-DevKitC-1 | Firmware: [`firmware/body-controller/`](../firmware/body-controller/README.md) |
| Neck and arms | 8 × FEETECH STS3215 (bus servo, 12 V version) | 2-DOF neck, 3-DOF per arm — [notes](components/feetech-sts3215.md) |
| Face | Waveshare 7inch DSI LCD (C) | [notes](components/waveshare-7inch-dsi-lcd-c.md) |
| Eyes | Raspberry Pi AI Camera (IMX500) | [notes](components/raspberry-pi-ai-camera.md) |
| Ears and voice | ReSpeaker 2-Mics Pi HAT V2.0; MAX98357A + 4 Ω 3 W speaker | See open issue 1 — [notes](components/respeaker-2mics-pi-hat-v2.md) |
| Sensors | VL53L1X (ToF), NeoPixel LEDs | On the ESP32-S3 — [VL53L1X notes](components/vl53l1x.md) |
| Power | 3S Li-ion battery and charger, 25–30 A fuse, HY57B emergency stop, Pololu D24V90F5 5 V regulator | [regulator notes](components/pololu-d24v90f5.md) |

Full parts list: [bom.csv](bom.csv) (`status`: proposed → planned → ordered → received → installed) · Pin map: [pinmap.md](pinmap.md) · Component notes: [components/](components/README.md) · Mechanical: [cad/](cad/README.md)

## Power tree (planned, from concept v0)

```
3S Li-ion battery (9.0–12.6 V)
└─ Main fuse 25–30 A
   └─ HY57B emergency stop            (scope: see open issue 5)
      ├─ 2-channel motor driver ─────► MG540 motors × 2 (encoders → ESP32-S3)
      ├─ 12 V servo branch ──────────► STS3215 servos × 8 (via the servo bus adapter)
      └─ 5 V DC-DC (D24V90F5) ───────► Raspberry Pi 5 → display, ReSpeaker, camera
                                       MAX98357A, ESP32-S3, NeoPixel
3S charger ──► battery
```

## Power budget (fill in as parts are verified)

| Rail | Load | Estimate | Source |
|---|---|---|---|
| 5 V | Raspberry Pi 5 | ~3 W idle, ~9 W at full CPU load, up to 25 W (5 A) including USB | [Pi 5 notes](components/raspberry-pi-5.md) |
| 5 V | Display, ReSpeaker, MAX98357A, ESP32-S3, NeoPixel | unverified | — |
| 12 V servo | 8 × STS3215 | 180 mA each at no load; **2.7 A each at stall** (~21.6 A if all stall at once) | [STS3215 notes](components/feetech-sts3215.md) |
| Battery | 2 × MG540 motors | unverified (R3 kit) | — |

## Open issues

1. **I2S conflict.** The ReSpeaker 2-Mics HAT V2.0 uses the Pi's only I2S pin group (GPIO18–21), and so would the MAX98357A. The HAT already has a JST 2.0 speaker connector and a 3.5 mm jack → either drop the MAX98357A (if the HAT's speaker output can drive a 4 Ω 3 W speaker) or drop the HAT and use an I2S microphone with the MAX98357A.
2. **Half-duplex servo bus.** The STS3215 uses single-wire, half-duplex TTL serial → an adapter is required between the ESP32-S3 UART and the bus (a bus servo adapter, or a tri-state buffer such as the 74HC126 plus a direction pin). Added to the BOM as `proposed`.
3. **Servo current.** Stall current can reach ~21.6 A if all 8 servos stall at once → give the servo branch its own fuse and adequately sized wiring, and make sure the **12 V version** is ordered (the 7.4 V version cannot take 12 V).
4. **Powering the Pi through the 5 V header pins.** There is no USB-PD negotiation, so total USB current is capped at ~600 mA unless `usb_max_current_enable=1` or `PSU_MAX_CURRENT=5000` is set (only with a genuine 5 A supply). The D24V90F5 is marketed as "9 A", but its typical continuous rating is 4–8 A → build a 5 V power budget and keep headroom.
5. **Emergency-stop scope.** It must cut motors and servos. Should it also cut the Pi? That means sudden power loss and a risk of SD card corruption → leaning towards motors and servos only.
6. **Battery monitoring and clean shutdown.** The Pi has no ADC → measure through the ESP32-S3 ADC (voltage divider) or an INA219/INA226 (which also measures current). On low battery the Pi must shut down cleanly before power drops.
7. **Wi-Fi inside a metal chassis.** The Pi 5 uses an on-board antenna (the absence of an external antenna connector is unverified). If reception is poor → a USB Wi-Fi adapter with an external antenna.
8. **MG540 motor and driver specifications** (voltage, current, encoder resolution) are missing. They are needed to choose how to read the encoders (PCNT on the ESP32-S3 is planned).
9. **Arm design.** The 3-DOF arms may change. The STS3215 is also the servo of the SO-100/SO-101 arms (LeRobot project), a possible reference design.

## Assembly notes (from concept v0)

1. Check the battery and motor driver specifications against the R3 kit before assembly.
2. Route the MG540 encoder wires to the ESP32-S3 (depending on the driver).
3. Never power servos from the Pi's 5 V rail.
4. Secure all wiring away from the tracks and moving joints.
5. Leave airflow space around the Pi and the motor driver.
6. Measure the real chassis before machining brackets.
7. Test each part (motors, servos, camera, …) on its own before final assembly.
