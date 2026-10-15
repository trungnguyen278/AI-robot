# ui/ — the robot's screen

> **Status:** the face works on any screen and the robot software drives it (14 expressions); scenes and status screens are still to be ported from the previous library. Architecture: [ADR-0006](../docs/decisions/0006-screen-renderer.md) (proposed).

The renderer that draws the robot's face. On the robot, a full-screen browser shows `screen.html`, served and driven by the robot software over the [screen protocol](../protocol/screen/README.md). The software says **what** to show: an expression, the gaze, the voice level, the battery. The renderer decides **how**: it blends from one expression to the next and keeps the face alive on its own, with blinking, glances and breathing.

Plain JavaScript modules drawing on a 2D canvas: no build step, no framework, nothing to install. The same files run on the robot, in any browser, in the tests and in a claude.ai Artifact.

## See it

The pages load JavaScript modules, which browsers refuse from `file://`, so serve the repository over HTTP:

```sh
python3 -m http.server 8000
```

- <http://localhost:8000/ui/> — the **studio**: every expression on any screen, driven by hand (expression, colour, gaze, voice, life layers, slow motion). `#happy` or `#round-360` at the end of the address opens it on that expression or screen.
- <http://localhost:8000/ui/tests/runtime.html> — the tests, and every expression side by side.

With the robot software running (`ai-robot --profile desktop`, see [software/](../software/README.md)), its screen is at <http://127.0.0.1:8770/>. On the robot, Chromium shows that address in kiosk mode, started from labwc's autostart ([Raspberry Pi's kiosk tutorial](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/)). Add `#round` to the address on a round display.

## How it fits together

```text
software ──state, look, voice──▶ link.js ──▶ animator.js ──▶ draw.js ──▶ canvas
         ◀──ready, touch────────                 │
                                  expressions.js · motions.js · effects.js · pose.js
```

| File | Role |
|---|---|
| `src/pose.js` | The face model: two eyes (size, corners, lids, pupils, brows) and a mouth, all numbers |
| `src/expressions.js` | Expressions as data: the numbers that differ from rest, a colour, a motion, an effect, how much life |
| `src/motions.js` | What gives an expression its movement: bounce, sway, shake, droop… |
| `src/effects.js` | What an expression draws around the eyes: hearts, a tear, Zzz… |
| `src/animator.js` | Blends expressions over time and adds the life layers: breathing, glances, gaze, voice, blinking |
| `src/draw.js` | Draws a frame: face, glow, effects, status row |
| `src/layout.js` | Fits the face to any screen size and shape; the studio's screen profiles |
| `src/player.js` | Runs an animator on a canvas, at the display's refresh rate |
| `src/link.js` | The screen protocol: applies the software's messages, reports the page and its taps |
| `src/tones.js` | The colour palette |
| `screen.html` | The robot's screen |
| `index.html`, `src/studio.js` | The studio |
| `tests/` | The tests |
| `legacy/` | The previous library: 256 designs to port from, then delete ([legacy/README.md](legacy/README.md)) |

## Screens

A rectangular screen keeps a status row along its top, a twelfth of its height (time and battery). The face fills the rest at the largest scale that keeps its proportions: on the previous generation's 320 × 240 screen it is exactly its design size, and on the 7" 1024 × 600 LCD it is 2.5 times larger. A round screen centres the face on the disc, at design size on a 360 px disc, and draws inside the disc only. The face is designed in face units on a 320 × 220 area (`src/pose.js`).

## Editing

- **An expression:** add or change an entry in `src/expressions.js`; the studio shows it at once. Use the numbers of `src/pose.js`, a tone of `src/tones.js`, a motion of `src/motions.js`, an effect of `src/effects.js`. An expression the software relies on must also be listed in [`protocol/screen/vocabulary.json`](../protocol/screen/vocabulary.json).
- **A motion or an effect:** a function in `src/motions.js` or `src/effects.js`; both take the seconds since the expression started.
- **The protocol:** change [`protocol/screen/`](../protocol/screen/README.md) first, then `src/link.js` and the software, in the same pull request.
- Keep the animator deterministic: time is passed in, and randomness comes from its seeded generator, never from `Math.random`.

## Test

Open <http://localhost:8000/ui/tests/runtime.html> with the server above running, or run it headless:

```sh
google-chrome --headless=new --virtual-time-budget=20000 \
  --dump-dom http://localhost:8000/ui/tests/runtime.html > result.html
python3 ui/tests/result.py result.html
```

The tests check the expressions against the protocol's vocabulary, draw every expression on every screen profile, and check the animator: the same calls give the same frames, transitions never jump, protocol messages land where they should. `data-status="pass"` means every check passed; otherwise the page lists each failure. CI runs them, with the previous library's smoke test, on every change under `ui/` or `protocol/screen/` ([workflow](../.github/workflows/ui.yml)).
