# ui/ — what the robot shows on its screen

> **Status:** design library. Every emotion, scene and status screen can be browsed in the sheet; nothing on the robot uses it yet.

The robot's face and everything else on its display: emotions (the eyes), scenes that take over the screen for everyday information (weather, clock, music, timers…) and status screens (start-up, network). Each variant is a React component that draws SVG as a pure function of the time in its loop, so it stays sharp at any resolution.

The library continues the previous generation's design ([docs/legacy.md](../docs/legacy.md)). Its specification is [docs/requirements.md](docs/requirements.md).

## View it

The sheet loads its `.jsx` files with Babel in the browser, which needs a local web server: pages opened as `file://` cannot load them.

```sh
python3 -m http.server 8000 --directory ui
```

Then open <http://localhost:8000> and pick a display in **Screen**. Adding `#round-360` (or another profile id) to the address opens the sheet on that display. React and Babel load from unpkg.com, so the page needs internet access.

## Layout

```text
ui/
├── index.html    The sheet: every variant, on any screen
├── src/          The library (loaded in the order index.html gives), screen.jsx, and the sheet's UI (sheet.jsx)
├── tests/        Smoke test
└── docs/         requirements.md (the specification), screens.md (displays)
```

## Screens

Variants draw on a 320 × 240 stage. A screen profile places that stage on a display of any size and shape: this robot's 7" 1024 × 600 LCD, the previous generation's 2" TFT, round panels. Supporting another display means adding a profile to `src/screen.jsx`, without touching a variant: see [docs/screens.md](docs/screens.md).

## Host data

Text that differs from one robot to the next (the boot credits, the Wi-Fi network, the paired phone) comes from `window.ScreenData`, never from the library's code ([requirements §6.8](docs/requirements.md#68-host-data-windowscreendata)). The robot's display name lives only in `software/config/base.toml` ([ADR-0003](../docs/decisions/0003-neutral-repo-naming.md)).

## Test

The smoke test checks the library's structure, renders every variant at nine moments of its loop and on every screen profile, and checks that it loads the same files as the sheet. With the server above running, open <http://localhost:8000/tests/smoke.html>, or run it headless:

```sh
google-chrome --headless=new --virtual-time-budget=60000 \
  --dump-dom http://localhost:8000/tests/smoke.html | grep -o 'data-status="[a-z]*"'
```

`data-status="pass"` means every check passed; otherwise the page lists each failure. CI runs it on every change under `ui/` ([workflow](../.github/workflows/ui.yml)).

## Editing

- Change a variant in the file that owns its category ([requirements §8](docs/requirements.md#8-file-layout)); keep every variant a pure function of `t`.
- A new file goes into both `index.html` and `tests/smoke.html`, in the same place in the load order; the smoke test fails otherwise.
- The design was first made in Claude Design and is also published as a claude.ai Artifact, to edit it in the browser. This folder is the source of truth: copy changes made there back here.

## Not decided yet

How the robot will show this library (the JSX in a full-screen browser, or a port to Python) is still open. The choice will be recorded as an ADR.
