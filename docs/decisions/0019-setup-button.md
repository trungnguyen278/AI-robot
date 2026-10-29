# 0019 — Set-up without the touch screen: hold the microphones' mute button

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

- **When set-up opens:** from start while the robot is not bound, and when the owner asks on the robot ([ADR-0015](0015-set-up.md), decision 3; set-up 2.0's "When set-up is open"). Today the robot's only way to ask is its touch screen.
- **A bound robot opens set-up again** to join a new Wi-Fi network, after its router or its password changes.
- **Touch layers fail often, and the robot has no camera** (the owner, 2026-10-29).
  - When the touch layer fails but the display works, set-up still works. The code shows on the display, and the app does the rest over Bluetooth LE ([ai-app ADR-0001](https://github.com/trungnguyen278/ai-app/blob/main/docs/decisions/0001-platforms-and-framework.md)).
  - Only opening set-up needs another way then.
- **The code stays on the display.** The owner turned down a code spoken by the robot, or printed on a label (2026-10-29). A robot whose display is dead needs repair, as its face does.
- **The microphone array has a mute button that the Pi can read.** The array is the reSpeaker XVF3800 ([ADR-0011](0011-audio-voice-processor.md)).
  - Pressing the button mutes the microphones, and lights a red LED.
  - Seeed's table of the array's pins lists X1D09 as an input: "mute button status (high when released)".
  - XMOS's control commands `GPI_VALUE` and `GPI_VALUE_ALL` read the level of the GPI pins over USB (user guide v3.2.1, §10.4).
  - Which GPI index X1D09 is remains to check on the array itself, which is not bought yet.
- **How others do it:** Amazon's Echo devices use long holds of their buttons.
  - An Echo Dot enters set-up mode when its Action button is held for 20 seconds.
  - An Echo Input is reset by holding its Microphone off button for 20 seconds.

## Decision

1. **Holding the mute button opens set-up**, as asking on the touch screen does.
   - The hold lasts `open_hold` seconds, a setting of the `setup` module.
   - The hold is long enough that muting never opens set-up by mistake.
   - While the button is held, the screen shows how long is left.
2. **The robot reads the button through the array's control interface over USB.** It polls the level of X1D09 with the GPI commands, at an interval that is a setting.
   - The button is reached through a port for the robot's buttons, with an adapter for the array and a simulated one.
3. **The press still mutes the microphones**, as it always does.
   - Nothing is heard while set-up opens.
   - The owner unmutes with another press.
4. **The code stays on the display alone.** A robot whose display is dead goes to repair.

## Alternatives considered

| Alternative | Why not |
|---|---|
| A set-up button of its own | Clear, and it leaves muting alone. But it is one more part, a GPIO and a hole in the shell, for what the mute button already does. It stays the fallback if the array's button proves unreadable. |
| The code spoken by the robot, or printed on a label | Turned down by the owner (2026-10-29). |
| The touch screen alone | A robot with a broken touch layer could no longer join a new Wi-Fi network, though all the rest of it works. |

## Consequences

- Positive:
  - no new part, and set-up still opens when the touch layer fails;
  - a long hold is not pressed by accident;
  - the microphones are muted while set-up opens.
- Negative / accepted trade-offs:
  - the mute button gains a second meaning, which the robot must show while it is held;
  - it rests on the array's control interface, checked on paper only until the array is bought;
  - the robot polls the array over USB while it runs.
- Follow-up:
  - the buttons' port, with its array adapter and its simulated one;
  - the hold, in the `setup` module, with `open_hold` and the polling interval in `software/config/base.toml`;
  - X1D09's GPI index, checked on the array;
  - the array's [component note](../../hardware/components/respeaker-xvf3800.md).

## References

Retrieved 2026-10-29:

- [Getting started with reSpeaker XVF3800 — Seeed wiki](https://wiki.seeedstudio.com/respeaker_xvf3800_introduction/): the array's GPIO table (X1D09, X0D30), the mute button, and `xvf_host`'s GPI commands.
- [XVF3800 user guide v3.2.1 — XMOS](https://www.xmos.com/documentation/XM-014888-PC/pdf/xvf3800_user_guide_v3.2.1.pdf), §10.4 "GPIO Commands", table 10.5.
- Amazon's help: [Reset your Echo Dot](https://digprjsurvey.amazon.com/csad/help/node/GK84VTU42NKF2E8E) (set-up mode: the Action button held for 20 seconds), [Reset your Echo Input](https://digprjsurvey.amazon.com/csad/help/node/GQUYN6CKVZTT3L2M) (factory reset: the Microphone off button held for 20 seconds).
