---
name: hardware-change
description: Checklist for adding, replacing or re-wiring hardware on the robot — research a part from its datasheet, record its specifications with sources in hardware/components/, and keep the BOM, pin map and power tree in sync in the same commit. Use when the user adds or swaps a part (module, sensor, servo, motor, display, microphone, speaker), changes wiring or pin assignments, or changes power distribution (battery, charger, DC-DC converter, fuse, emergency stop).
---

# Hardware changes

Goal: after every change, `hardware/` still describes the **real** robot, so it can be trusted years later.

## 1. Research the part

- Datasheets and vendor documentation first, shop pages second. Record the exact model or variant — many parts come in several (e.g. the STS3215 has 7.4 V and 12 V versions).
- Create or update `hardware/components/<part-name>.md` from [component-template.md](component-template.md).
- Every value gets a source. Values backed only by secondary sources or by inference are marked **unverified**.

## 2. Electrical check

- [ ] Logic level: 3.3 V or 5 V? The Pi 5 and the ESP32-S3 are 3.3 V and not 5 V tolerant.
- [ ] Current: typical **and** peak/stall. Add it to the power budget in `hardware/README.md` and confirm the rail (5 V DC-DC, 12 V servo branch, motor driver) still has headroom.
- [ ] Protection: is it behind the fuse and the emergency stop? Mandatory for motors and servos.
- [ ] Blocks that talk to each other share a common ground.

## 3. Pins and buses

- [ ] No pin conflicts in `hardware/pinmap.md` (Pi 5 and ESP32-S3).
- [ ] No I2C address clashes; a free UART is available; remember the Pi has only one I2S pin group.
- [ ] Anything wired to the Pi → also follow the `pi5-platform` checklist (`.claude/skills/pi5-platform/SKILL.md`).

## 4. Update in the same commit

- [ ] `hardware/bom.csv` — add or edit the row; `status` is one of proposed → planned → ordered → received → installed.
- [ ] `hardware/pinmap.md`
- [ ] `hardware/README.md` — power tree, power budget, open issues.
- [ ] `hardware/components/<part-name>.md`
- Use the commit scope `hardware`, e.g. `feat(hardware): add VL53L1X ToF sensor on ESP32 I2C`.

## 5. Major changes

Replacing a core part (compute board, chassis, power system, servo or motor type) → write an ADR (`adr` checklist, `.claude/skills/adr/SKILL.md`).
