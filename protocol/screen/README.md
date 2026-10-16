# Screen protocol

Between the robot software (`software/`: the `screen` module and the `web` adapter of its `screen` port) and the screen renderer (`ui/`: a page in a browser). Version **1**, proposed in [ADR-0006](../../docs/decisions/0006-screen-renderer.md).

The software decides **what** the screen shows; the renderer decides **how**. The renderer runs the animation on its own (transitions, blinking, glances, breathing), so the face stays alive while the software is busy, and it lays the face out for whatever screen it runs on. The software therefore sends changes, never frames.

[`vocabulary.json`](vocabulary.json) holds the version, the expressions and scenes every renderer must draw, the data each scene takes (types, allowed values, lengths in characters), and the colour names. Both sides test against it (`software/tests/test_screen.py`, `test_system.py`, `test_web_screen.py`; `ui/tests/runtime.js`).

The renderer also plays a start-up animation of its own when a page opens (the `boot` scene), before it shows the software's state; it is not part of the protocol.

## Connection

- The software serves the renderer's files at `http://<host>:<port>/` (the page `screen.html` at `/`) and the WebSocket at `/ws` on the same address. The page connects to the address it was loaded from.
- Each WebSocket text frame carries one JSON object with a `type`. A side ignores types and fields it does not know, so either side can add optional fields without breaking the other.
- Several pages may connect at once (the robot's screen and a developer's browser); each receives every message.
- The software sends the whole state when a page connects and whenever it changes. A page that connects before the software has a state receives only `hello`, and the state when there is one. The page keeps no history: if the connection drops, it keeps animating the last state and reconnects, with growing delays up to 5 s.
- Numbers are finite (JSON has no NaN or infinity), and data is plain JSON: strings, numbers, booleans, null, arrays and objects with string keys. The software checks scene data when a request is made, not when it is sent.

## Software → renderer

### `hello`

Sent first, on every connection.

```json
{"type": "hello", "protocol": 1, "revision": "45dbb837332b4e9c", "time": 1792130400.25}
```

| Field | Meaning |
|---|---|
| `protocol` | The version. A renderer that speaks another one logs it and carries on with what it understands. |
| `revision` | A fingerprint of the renderer's files as the software serves them. A page that sees it change between two connections reloads itself, so that a software update never leaves an old page running. |
| `time` | The software's clock, in Unix seconds. The renderer reads the times it is sent (a timer's end) and shows the time of day on this clock, so a browser on another device agrees with the robot. |

### `state`

What to show. Sent on connection and on every change, with the software's `time` as in `hello`.

```json
{"type": "state",
 "face": {"expression": "listening", "tone": null},
 "scene": {"name": "weather", "data": {"condition": "rain", "temperature": 18}},
 "status": {"battery": 82.0, "charging": false},
 "time": 1792130401.5}
```

| Field | Meaning |
|---|---|
| `face.expression` | An expression of the vocabulary. The renderer blends into it from wherever the face is; an unknown name shows `neutral`. |
| `face.tone` | A colour of the vocabulary, or `null` for the expression's own. |
| `scene` | A scene of the vocabulary and its data, or `null` for none. The scene fills the screen while the face, keeping its expression, watches from a corner. New data for the scene on screen updates it without starting it again; an unknown name shows no scene. Optional: a missing field means `null`. |
| `status.battery` | Battery charge in percent, from 0 to 100, or `null` if unknown. |
| `status.charging` | `true`, `false`, or `null` if unknown. |

The scenes and their data:

| Scene | Data |
|---|---|
| `charging` | none: shows the battery from `status`. The software shows it for a few seconds when the robot is plugged in. |
| `clock` | none: the time of day on the software's clock |
| `timer` | `ends_at` (Unix time in seconds, on the software's clock, when it rings), `duration` (seconds), `label` (optional, up to 16 characters). The renderer counts down on its own, so the timer is sent once; at zero it pulses until the scene is taken away. |
| `weather` | `condition` (`clear`, `partly-cloudy`, `cloudy`, `rain`, `storm`, `snow`, `fog`), `temperature`, `unit` (`C` or `F`), `night` (optional, `true` for the moon), `place` (optional, up to 18 characters) |

A renderer draws a scene even with missing or malformed data, with placeholders (a timer without `ends_at` shows `--:--`). A scene asked for again with new data is updated in place, without starting over.

### `look`

Where the eyes look. Sent on connection and on every change.

```json
{"type": "look", "target": {"x": 0.4, "y": -0.2}}
{"type": "look", "target": null}
```

`x` and `y` go from -1 to 1 across the screen as one faces it: (-1, -1) is the top left corner, (0, 0) straight ahead. `null` lets the eyes roam on their own.

### `voice`

The loudness of the voice the face reacts to, from 0 to 1: the person's voice while the robot listens; the robot's own voice while it speaks, once that is measured. Sent up to 25 times a second while it changes, then 0. The renderer treats a level older than half a second as silence.

```json
{"type": "voice", "level": 0.42}
```

## Renderer → software

### `ready`

Sent on every connection, after it opens.

```json
{"type": "ready", "protocol": 1, "width": 1024, "height": 600, "shape": "rect",
 "expressions": ["neutral", "listening", "…"], "scenes": ["boot", "clock", "…"]}
```

`width` and `height` are in CSS pixels; `shape` is `rect` or `round`. `expressions` and `scenes` list every expression and scene the renderer can draw, which may be more than the vocabulary requires. The software warns when it asks for one that no connected page knows.

### `touch`

A tap on the screen, as fractions of its width and height from the top left corner.

```json
{"type": "touch", "x": 0.42, "y": 0.61}
```

## Changing the protocol

Adding an optional field, a message type or an expression keeps the version: update this file and `vocabulary.json`, then both sides, in the same pull request. Changing or removing something either side relies on raises the version in `vocabulary.json`, `PROTOCOL` in `software/src/ai_robot/adapters/web/screen.py` and `PROTOCOL` in `ui/src/link.js`.
