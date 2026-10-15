# Screens

How the library's stage is shown on real displays. Companion to
[requirements.md](requirements.md); the code is `src/screen.jsx`.

Every variant draws on the same **stage**: 320 × 240 units, the eyes
centered on (160, 130), the top 20 units reserved for the status strip. A
**screen profile** describes one display, and `Screen` places the stage on
it. Supporting another display means adding a profile; no variant changes.

## Profiles

```js
{ id: 'lcd-1024x600', label: '7" LCD', shape: 'rect', width: 1024, height: 600 }
```

- `shape`: `'rect'` or `'round'`. A round display is a disc whose diameter
  is `width` (`height` equals it).
- `width`, `height`: the display's pixels. The SVG is vector, so any size
  works; the profile only sets the proportions and where the stage goes.

| Profile        | Display                                                              | Shape | Size       |
| -------------- | -------------------------------------------------------------------- | ----- | ---------- |
| `lcd-1024x600` | This robot's face, the Waveshare 7inch DSI LCD (C)                   | rect  | 1024 × 600 |
| `tft-320x240`  | The previous generation's 2" TFT, the size the library was drawn for | rect  | 320 × 240  |
| `round-240`    | Round display                                                        | round | 240 × 240  |
| `round-360`    | Round display, the round layout's baseline                           | round | 360 × 360  |
| `round-466`    | Round display                                                        | round | 466 × 466  |

The 7" panel's specifications and sources:
[hardware/components/waveshare-7inch-dsi-lcd-c.md](../../../hardware/components/waveshare-7inch-dsi-lcd-c.md).
The sheet's **Screen** menu lists them, plus a custom size; `#<id>` in the
sheet's address opens it on a given profile (e.g. `index.html#round-360`).

## Mapping the stage

**Rectangular screens.** The stage is scaled to fit,
`scale = min(width / 320, height / 240)`, and centered. Whatever a variant
draws outside the stage (props waiting off-screen) is cut off, so a wider
display shows the composition as designed with plain background on either
side. The status strip runs across the display's full width at the top.

- 320 × 240: scale 1, the stage fills the screen.
- 1024 × 600: scale 2.5, the stage is 800 × 600 with 112 px of background on
  each side.

**Round screens.** The eye center (160, 130) sits on the disc center, and
the stage is drawn at `scale = diameter / 360`: at native size on a 360 px
disc, with about 60 px of rim margin around the eyes. Everything is clipped
to the disc, so full-bleed scene props crop gently at the rim, as they
would on a real round panel. Keep anything that must never be cut off
inside the inscribed circle: at a vertical offset `dy` from the center, the
usable half-width is `sqrt(r² − dy²)`. The eyes (±48 from center) and their
accessories stay well inside it.

## Status chrome

Always fixed cyan (`#5be9ff`), whatever the variant's tone.

- **Rectangular:** the strip — clock on the left, a center dot (or label),
  Wi-Fi and battery on the right — 20 stage units tall, spanning the full
  display width. Variants draw on top of it.
- **Round:** a curved cluster near the top of the disc — clock left of the
  arc, center dot or label, Wi-Fi and battery right of it — designed on a
  360 px disc and scaled with the screen, drawn above the variant.

## Adding a display

1. Add a profile to `PROFILES` in `src/screen.jsx`. For a hardware panel,
   link its notes in `hardware/components/`.
2. Open the sheet on it and browse the categories, scenes especially: they
   use the stage's edges the most.
3. Run the smoke test (`tests/smoke.html`); it renders every variant on
   every profile.

A layout that changes the composition itself (for example scenes that use
the full width of a wide display) is a change to the variants and to
[requirements.md](requirements.md), not to a profile.
