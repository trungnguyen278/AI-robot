# Screen protocol

Between the robot software (`software/`: the `screen` module and the `web` adapter of its `screen` port) and the screen renderer (`ui/`: a page in a browser). Version **1**, proposed in [ADR-0006](../../docs/decisions/0006-screen-renderer.md).

The software decides **what** the screen shows; the renderer decides **how**. The renderer runs the animation on its own (transitions, blinking, glances, breathing), so the face stays alive while the software is busy, and it lays the face out for whatever screen it runs on. The software therefore sends changes, never frames.

[`vocabulary.json`](vocabulary.json) holds the version, the expressions every renderer must draw, and the colour names. Both sides test against it (`software/tests/test_screen.py`, `test_web_screen.py`; `ui/tests/runtime.js`).

## Connection

- The software serves the renderer's files at `http://<host>:<port>/` (the page `screen.html` at `/`) and the WebSocket at `/ws` on the same address. The page connects to the address it was loaded from.
- Each WebSocket text frame carries one JSON object with a `type`. A side ignores types and fields it does not know, so either side can add optional fields without breaking the other.
- Several pages may connect at once (the robot's screen and a developer's browser); each receives every message.
- The software sends the whole state when a page connects and whenever it changes. The page keeps no history: if the connection drops, it keeps animating the last state and reconnects, with growing delays up to 5 s.

## Software → renderer

### `hello`

Sent first, on every connection.

```json
{"type": "hello", "protocol": 1}
```

A renderer that speaks another version logs it and carries on with what it understands.

### `state`

What to show. Sent on connection and on every change.

```json
{"type": "state",
 "face": {"expression": "listening", "tone": null},
 "status": {"battery": 82.0, "charging": false}}
```

| Field | Meaning |
|---|---|
| `face.expression` | An expression of the vocabulary. The renderer blends into it from wherever the face is; an unknown name shows `neutral`. |
| `face.tone` | A colour of the vocabulary, or `null` for the expression's own. |
| `status.battery` | Battery charge in percent, from 0 to 100, or `null` if unknown. |
| `status.charging` | `true`, `false`, or `null` if unknown. |

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
 "expressions": ["neutral", "listening", "…"]}
```

`width` and `height` are in CSS pixels; `shape` is `rect` or `round`; `expressions` lists every expression the renderer can draw, which may be more than the vocabulary requires. The software warns when it asks for an expression no connected page knows.

### `touch`

A tap on the screen, as fractions of its width and height from the top left corner.

```json
{"type": "touch", "x": 0.42, "y": 0.61}
```

## Changing the protocol

Adding an optional field, a message type or an expression keeps the version: update this file and `vocabulary.json`, then both sides, in the same pull request. Changing or removing something either side relies on raises the version in `vocabulary.json`, `PROTOCOL` in `software/src/ai_robot/adapters/web/screen.py` and `PROTOCOL` in `ui/src/link.js`.
