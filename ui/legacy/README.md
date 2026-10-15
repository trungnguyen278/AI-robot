# ui/legacy/ — the previous emotion library

> **Status:** reference, being ported. The robot does not use it: its designs move one by one into the renderer in [`ui/`](../README.md), and this folder is deleted once they all have ([ADR-0006](../../docs/decisions/0006-screen-renderer.md)).

The previous generation's screen design ([docs/legacy.md](../../docs/legacy.md)): emotions (the eyes), scenes that take over the screen for everyday information (weather, clock, music, timers…) and status screens (start-up, network). It has 82 categories and 256 variants. Each variant is a React component that draws SVG as a pure function of the time in its loop, on a 320 × 240 stage. Its specification is [docs/requirements.md](docs/requirements.md).

## View it

The sheet loads its `.jsx` files with Babel in the browser, which needs a local web server: pages opened as `file://` cannot load them.

```sh
python3 -m http.server 8000 --directory ui/legacy
```

Then open <http://localhost:8000> and pick a display in **Screen**. Adding `#round-360` (or another profile id) to the address opens the sheet on that display. React and Babel load from unpkg.com, so the page needs internet access.

## Layout

```text
ui/legacy/
├── index.html    The sheet: every variant, on any screen
├── src/          The library (loaded in the order index.html gives), screen.jsx, and the sheet's UI (sheet.jsx)
├── tests/        Smoke test
└── docs/         requirements.md (the specification), screens.md (displays)
```

## Porting a design

Port the look, not the code. An emotion's eye shapes become an expression in `ui/src/expressions.js`: sizes, corners, lids, pupils, brows, mouth. Its loop becomes a motion (`ui/src/motions.js`) and its accessories an effect (`ui/src/effects.js`). Blinks, glances and breathing come from the animator, so they do not need porting. Compare the two side by side in the sheet and the studio.

## Host data

Text that differs from one robot to the next (the boot credits, the Wi-Fi network, the paired phone) comes from `window.ScreenData`, never from the library's code ([requirements §6.8](docs/requirements.md#68-host-data-windowscreendata)). The robot's display name lives only in `software/config/base.toml` ([ADR-0003](../../docs/decisions/0003-neutral-repo-naming.md)).

## Test

The smoke test checks the library's structure, renders every variant at nine moments of its loop and on every screen profile, and checks that it loads the same files as the sheet. With the server above running, open <http://localhost:8000/tests/smoke.html>; CI runs it with the renderer's tests ([workflow](../../.github/workflows/ui.yml)).

## Editing

The design was first made in Claude Design and also published as a claude.ai Artifact. New design work goes into the renderer in `ui/` instead; fix this library only to keep it a faithful reference. Babel runs every file in one global scope, so a top-level helper must not reuse a name another file defines.
