# Emotion library — requirements

Canonical spec for the robot's screen library: its emotions, scenes and
status screens. Keep this in sync with the code in `ui/src/`. When porting
it to another renderer, **read this file first**, then
[screens.md](screens.md) for how the stage maps onto real displays.

> Lineage: the library was designed for the previous generation's 2-inch
> 320 × 240 screen ([docs/legacy.md](../../docs/legacy.md)) and grew from
> a mono set of emotions into 9 tones, cinematic scenes and status flows.
> Its geometry is still authored on that 320 × 240 stage; screen profiles
> place the stage on any display.

---

## 1. Project intent

An **original** robot character built around a screen that shows
expressive eyes — and, when context calls for it, **full-screen scenes**
(weather, clock, music, timers, etc.). Implementation must be
independently designed — do not copy proprietary frames, transitions, or
distinctive marks from other products.

**No brand text appears inside the eye/scene SVG.** The robot's display
name never appears in the library's code or identifiers
([ADR-0003](../../docs/decisions/0003-neutral-repo-naming.md)). Text that
differs from one robot to the next (the boot credits, the Wi-Fi network,
the paired phone) comes from `window.ScreenData`, which the host fills in
(see §6.8).

Personality: friendly, slightly mischievous, expressive.

The library has **three kinds** of content:

| Kind        | Purpose                                                            |
| ----------- | ------------------------------------------------------------------ |
| `emotion`   | Eyes-based expressions. Tied to dialog / mood.                     |
| `scene`     | Full-screen contextual mini-videos (weather/clock/music/timer…).   |
| `status`    | System chrome flows: power-on `boot` and connectivity `network`.   |

Every category has a `kind` field. The host can filter or pick from each
pool independently. The sheet (`sheet.jsx`) renders Emotions, Scenes, and
Status as three separate sections.

---

## 2. Stage and screens

Every variant draws on the same **stage**; screen profiles map the stage
onto real displays (rectangular or round, any size) without changing a
variant — see [screens.md](screens.md).

| Spec                | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| Stage               | 320 × 240 units, landscape                                             |
| Reserved top strip  | 20 units (status bar: clock left, dot centre, wifi+battery right)      |
| Active emotion area | 320 × 220 (y = 20 … 240)                                               |
| Colors              | 9-tone curated palette on a near-black background (RGB565-safe values) |
| Frame rate          | **30 fps default** (range 12 – 60 acceptable)                          |

Every pixel is restricted to one of a small **curated palette** of 9
emotional tones. See § 4.

---

## 3. Eye geometry

| Token   | Value | Notes                                                |
| ------- | ----- | ---------------------------------------------------- |
| `EYE_W` | 88    | Each eye width                                       |
| `EYE_H` | 96    | Each eye height                                      |
| `EYE_RX`| 22    | Default corner radius                                |
| `GAP`   | 150   | Centre-to-centre between the two eyes                |
| `LX`    | 85    | Left eye centre X                                    |
| `RX`    | 235   | Right eye centre X                                   |
| `CY`    | 130   | Eye centre Y (mid of active area)                    |

All tokens live in `emotion-core.jsx` (`window.EmotionCore`).

---

## 4. Visual system — color

### 4.1 Palette

Defined in `emotion-core.jsx` as `EYE_TONES`. Each tone has an `eye` hex
and a matching glow rgba. All values are RGB565-safe.

| Tone     | Hex       | Used for                                          |
| -------- | --------- | ------------------------------------------------- |
| `cyan`   | `#5be9ff` | Default / neutral / robotic states. **Eyes always.** |
| `warm`   | `#ffd166` | Happy, smug, proud, excited, gold                 |
| `rose`   | `#ff6b9d` | Love, shy, embarrassed, playful, grateful, music  |
| `red`    | `#ff5b6e` | Angry, hot, brave, focused, determined, error, urgent |
| `blue`   | `#76b8ff` | Sad, crying, cold, lonely, rain, water            |
| `green`  | `#7be88e` | Charging, disgusted, sick, plant, fresh           |
| `purple` | `#b48cff` | Sleepy, sleeping, mischievous, suspicious, dreamy, dizzy |
| `orange` | `#ff9d5b` | Hungry, curious, confused, annoyed, nervous, fire |
| `white`  | `#f0f4ff` | Surprised, scared, awe, camera flash, snow        |

Background is always `--bg = #06090d` (near-black).

### 4.2 Color rules

The robot has a **face** that must stay readable across every emotion, so
we draw two layers:

| Layer       | CSS var       | Used for                                              | Color                                    |
| ----------- | ------------- | ----------------------------------------------------- | ---------------------------------------- |
| Face        | `--eye`       | Eye rectangles, closed-eye arcs, brows, mouth          | **Always cyan** for every emotion variant |
| Accessory   | `--accent`    | Tears, hearts, sparkles, audio bars, mic, Zs, fire…    | The category's tone                       |
| Glow        | `--eye-glow`  | SVG drop-shadow filter on the screen                   | Cyan glow (emotions) / tone glow (scenes) |
| Background  | `--bg`        | Anywhere the screen "punches through" the eye          | Always `#06090d`                          |

For **scenes**, the eyes stay cyan (the robot's identity — see §6.6) while
the **prop** visuals take the scene's tone via `--eye`/`--accent`.

The **status bar** is system chrome — it ignores tones entirely and always
draws in fixed cyan (`#5be9ff`), for emotions, scenes, and status flows
alike.

### 4.3 Multi-color variants (`tone: 'multi'`)

A handful of variants need more than one color in the same frame (e.g.
`celebrate-grand` showers several colors). They set `tone: 'multi'`. The
Screen treats this as cyan for the base palette but **also exposes every
tone as a CSS variable** (`--tone-cyan`, `--tone-warm`, `--tone-rose`, …)
so the render function can paint specific colors:

```jsx
<rect fill="var(--tone-warm)" />
<circle fill="var(--tone-rose)" />
```

These extra CSS vars are only exposed when `kind === 'scene'`.

### 4.4 Per-variant / per-category tone

Resolution order:

```
variant.tone || category.tone || 'cyan'
```

Scenes set their tone at the category level (each scene now has a single
variant). The viewer resolves tone with `resolveTone(variant, cat)`.

### 4.5 Mono fallback

The viewer's **◐ Color / ◯ Mono** button forces every screen to render in
cyan, ignoring tones — useful for mono-display firmware ports and for
verifying nothing relies on color to be legible.

### 4.6 Misc

- Subtle CRT scanlines + glow applied as a CSS overlay.
- Smooth vector shapes (`rx` corners, arcs, `<path>`) — not pixel-art.
- Status bar font: monospace, ~11 pt at 1×. Centre slot is intentionally
  empty (a small dot or blank). Never tinted by category tone.

---

## 5. Animation rules

- Time `t ∈ [0, 1)` cycles every `duration` ms per variant.
- `t` is **quantized** to the chosen fps before render — produces the
  chunky "real robot display" feel.
- Default fps **30**. Renderer supports 12 – 60 fps with no code changes.
- Each variant declares its own `duration` (typical 0.6 – 5 s; scene arcs
  run longer, ~8 – 14 s).
- Each variant is a pure function `t ⇒ SVG JSX` — no internal state.

---

## 6. Conceptual model — "normal" vs "idle"

The category called **`normal`** is the *default look* of the robot — a
set of variants the host picks from when nothing else is happening.

**Idle is a behaviour, not a category.** Firmware "idle" should:

1. Stay on category `normal`.
2. Every N seconds (recommend 3 – 6 s), call `pickVariant('normal',
   recentIds)` and play the result.
3. Keep a 4 – 6-entry ring buffer of recent ids so the same variant
   doesn't repeat back-to-back.

The sheet (`sheet.jsx`) implements this in the **"◉ Idle mode"** button.

## 6.5 Boot & connectivity flow (`kind: 'status'`)

Firmware uses two `status` categories — `boot` and `network` — to drive
the entire startup-to-conversation pipeline. Both **block** the normal
emotion loop while playing; the host suspends autoplay until the flow
exits.

### 6.5.1 Cold boot sequence (4 stages, brand-clean cyan)

```
  POWER ON
     ↓
  boot-poweron           — dot expands, splits into two eyes
     ↓
  boot-credits           — monogram + name typewriter + role line (from ScreenData)
     ↓
  boot-checks-personal   — DISPLAY / AUDIO / MIC / NETWORK / AI CORE self-test
     ↓
  → [ connectivity sub-flow §6.5.2 ] →
     ↓
  boot-ready-personal    — progress 0→100% + "READY" stamp
     ↓
  HAND OFF to `normal` idle pool
```

No school/company branding appears on screen at any stage.

### 6.5.2 Connectivity sub-flow (`network`, 7 variants)

`network-wifi-scan` (cyan) · `network-wifi-connect` (cyan) ·
`network-wifi-retry` (orange) · `network-offline` (red) ·
`network-bt-scan` (purple) · `network-bt-paired` (purple) ·
`network-server-error` (red)

```
  poweron complete
     ↓
  network-wifi-scan  (no stored SSID)  →  network-bt-scan / network-bt-paired
     ↓ SSID known                          (user holds pair button; phone app
  network-wifi-connect                      pushes credentials → wifi-connect)
     ↓ fail (up to 3 attempts)
  network-wifi-retry  →  network-offline (red; retry every 60 s)
     ↓ wifi up
  (ping cloud /health)
     ↓ reachable                  ↓ unreachable
  hand off to boot-ready        network-server-error (backoff 2/5/10/30 s)
```

While any `network-*` scene plays, the host suppresses user-facing
emotions — these are blocking status displays.

### 6.5.3 Mid-session network loss

1. **TCP/WebSocket drop while talking**: freeze the current emotion frame
   (not idle pool), show `network-server-error` for up to 5 s of fast
   retries; on reconnect fade back, else drop to `network-offline`.
2. **Wi-Fi link drop**: skip server-error; go straight to
   `network-offline` until link returns, then `network-wifi-connect`.
3. **Long offline (≥30 s)**: optionally play the `error-noconn` emotion
   once to acknowledge.

## 6.6 Scene-arc model (`kind: 'scene'`)

In v3 every scene is a **continuous mini-video** rather than a static
display. The robot's eyes stay visible the WHOLE time — they shrink and move to
a corner to "watch" the prop, then grow back when the prop leaves. The
shared engine is `scene-arc.jsx` (`window.SceneArc`):

```
  OPEN          TRANS-IN       ACT            TRANS-OUT      CLOSE
  big eyes,     eyes shrink    prop owns      prop leaves /  big eyes,
  centered,     to corner,     screen; eyes   eyes grow      centered,
  opening emo   prop enters    watch          back           closing emo
```

`sceneArc(t, opts?)` returns `{ phase, p, eyeScale, eyeCx, eyeCy, sceneOp,
emotion }`. `EmotionFace` / `TransformedFace` render the eyes (always cyan —
switching shape, not color, avoids a distracting mid-scene flash). The
scene's tone colors the **prop** visuals only.

Each scene category therefore has exactly **one** variant — the arc.
(Exception: multi-case scenes, §6.7.)

## 6.7 Multi-case scenes (state that varies with the real world)

Some scenes don't depict a one-off event — they depict a **state of the
world that can be different each time**. `weather` is the canonical
example: the host must show the *actual* sky, not always "sunny". So a
handful of scene categories carry **more than one variant**, one per
state. Each case is authored as its own self-contained mini-story —
distinct props, motion, tone, eye-emotion arc and caption — so no two
cases of the same scene look or read alike.

| Scene     | Cases | Variants                                                               |
| --------- | ----- | ---------------------------------------------------------------------- |
| `weather` | 7     | sunny (`weather-window`) · cloudy · rainy · storm · snow · fog · windy |
| `moon`    | 8     | one per lunar phase: new moon → full moon → waning crescent            |
| `call`    | 3     | incoming · outgoing · missed                                           |
| `message` | 3     | chat · incoming · sent                                                 |

**Tone is per-variant here** (`variant.tone` overrides `category.tone`):
rainy is blue, storm purple, snow white, a missed call red, etc. The
viewer already resolves this via `resolveTone(variant, cat)`.

**Host picks the case explicitly.** These do NOT enter the random idle
pool. The firmware chooses the variant matching the live condition, e.g.:

```js
function showWeather(condition) {            // condition: 'rain' | 'snow' | ...
  const map = {
    clear: 'weather-window', sunny: 'weather-window',
    cloudy: 'weather-cloudy', rain: 'weather-rainy',
    storm: 'weather-storm', thunder: 'weather-storm',
    snow: 'weather-snow', fog: 'weather-fog', wind: 'weather-windy',
  };
  const id = map[condition] || 'weather-window';
  const v = EMOTION_CATEGORIES.weather.variants.find(x => x.id === id);
  play(v);
}
```

Falls back to the first variant (sunny / incoming / chat) for an unknown
state. Adding a new case = push another variant onto the category's
`variants` array; nothing else changes (no new category, so the
authoritative KEYS order in `scenes-arc-pack-3b.jsx` is untouched).

**`moon` — the lunar multi-case scene.** The robot *is* the moon, so the
month is a first-class state. `scenes-moon.jsx` adds a `moon` category
where **the robot's own body is the moon**. Per the identity rule (the
eyes are the robot), each phase story **opens and closes on the signature
cyan eyes**: the canonical centered pair shows first, the moon disc then
*materializes around those same eyes* (they draw together and shrink onto
the disc), the story plays, the disc dissolves, and the eyes return to
their signature pose. Each phase is its own long vignette (≥22s) with a
distinct mood:

  new moon (Sóc, lunar day 1) fast asleep (a shooting star passes) →
  waxing crescent wakes up → first quarter climbs the sky → waxing gibbous,
  eager (lanterns light up) → **full moon (Rằm)** round and serene (gentle
  eyes, soft halo, lanterns rising) → waning gibbous, content → last
  quarter yawns → waning crescent goes to rest → back to the new moon.

The phone app conveys phase only by how brightly it draws the moon glyph;
on the robot's screen that reads nearly the same every night, so each
phase here is its own vignette (lit fraction + face mood + props + beat).
The host picks tonight's story by lunar date via `window.MoonPhase`:

```js
showScene('moon', MoonPhase.sceneId());            // tonight's lunar day
showScene('moon', MoonPhase.sceneForLunarDay(15)); // a given lunar day (the full moon)
```

The 30 lunar days fold onto the 8 phase stories (nearest canonical phase).

## 6.8 Host data (`window.ScreenData`)

Text that differs from one robot to the next is not written into the
library; variants read it from `window.ScreenData` while rendering, and the
host fills it in (the robot's software on the robot, `screen.jsx` defaults
in the sheet):

| Field          | Used by                               | Default                   |
| -------------- | ------------------------------------- | ------------------------- |
| `credits`      | `boot-credits`, `boot-ready-personal` | monogram `AI`, `AI ROBOT` |
| `ssid`         | `network-wifi-connect`                | `HOME-WIFI`               |
| `pairedDevice` | `network-bt-paired`                   | `Phone`                   |

Update the fields in place, e.g. `Object.assign(window.ScreenData, { ssid })`.

---

## 7. Categories at a glance

**Totals: 82 categories · 256 variants** — 47 emotion (195) · 33 scene (50)
· 2 status (11). The sheet's header and the smoke test count them live.

### Emotions (kind: 'emotion') — 47 categories · 195 variants

| Category       | Variants | Tone     | Purpose                                  |
| -------------- | -------- | -------- | ---------------------------------------- |
| `normal`       | **16**   | cyan     | Default state — random-played in idle    |
| `greet`        | 4        | cyan     | Hello / wake-up handshake                |
| `happy`        | 8        | warm     | Positive acknowledgement                 |
| `wink`         | 4        | warm     | Playful acknowledgement                  |
| `sad`          | 6        | blue     | Negative outcome / empathy               |
| `crying`       | 4        | blue     | Strong sad                               |
| `angry`        | 5        | red      | Frustration / boundary                   |
| `annoyed`      | 3        | orange   | Mild irritation                          |
| `disgusted`    | 3        | green    | Yuck / rejection                         |
| `surprised`    | 4        | white    | Sudden new info                          |
| `scared`       | 4        | white    | Frightened response                      |
| `nervous`      | 3        | orange   | Anxious / jittery                        |
| `love`         | 5        | rose     | Affection / praise                       |
| `shy`          | 4        | rose     | Bashful / hiding                         |
| `embarrassed`  | 3        | rose     | Flushed / mortified                      |
| `smug`         | 4        | warm     | Confident / self-satisfied               |
| `proud`        | 4        | warm     | Accomplished / chest-out                 |
| `cool`         | 3        | cyan     | Chill / smooth confidence                |
| `mischievous`  | 4        | purple   | Sneaky / playful                         |
| `suspicious`   | 3        | purple   | Skeptical / squinting                    |
| `sleepy`       | 4        | purple   | Low-power / late-hour mood               |
| `sleeping`     | 4        | purple   | Deep idle / standby                      |
| `excited`      | 5        | warm     | High-positive event                      |
| `confused`     | 4        | orange   | Didn't understand request                |
| `curious`      | 3        | orange   | Leaning in / wondering                   |
| `bored`        | 4        | cyan     | No interaction for a while               |
| `hungry`       | 4        | orange   | Wants food / craving                     |
| `listening`    | **7** ✦  | cyan     | While receiving voice input              |
| `thinking`     | **7** ✦  | cyan     | While generating response / processing   |
| `focused`      | 4        | red      | Locked-on task attention                 |
| `determined`   | 3        | red      | Resolute / locked-in                     |
| `loading`      | 5        | cyan     | Background task                          |
| `charging`     | 4        | green    | Battery charging / power up              |
| `dizzy`        | 4        | purple   | Error / overload                         |
| `dead`         | 4        | red      | Critical failure                         |
| `error`        | 4        | red      | System / connection issue                |
| `mute`         | 4        | cyan     | Mic off / silenced                       |
| `sick`         | 3        | green    | Feverish / unwell                        |
| `cold`         | 2        | blue     | Shivering / freezing                     |
| `calm`         | 3        | cyan     | Meditation / serene                      |
| `playful`      | 3        | rose     | Silly / cheeky                           |
| `hot`          | 3        | red      | Sweltering / overheated                  |
| `lonely`       | 3        | blue     | Alone / wanting company                  |
| `grateful`     | 2        | rose     | Thankful / heartfelt                     |
| `brave`        | 3        | red      | Fierce / steady courage                  |
| `dreamy`       | 3        | purple   | Daydreaming / head in clouds             |
| `awe`          | 2        | white    | Wonder / quiet amazement                 |

✦ `listening` and `thinking` are **mandatory** — this is a conversational
robot. Every dialog turn enters one of these two states.

### Scenes (kind: 'scene') — 33 categories · 50 variants

Most scenes are a single continuous arc (§6.6). A few represent a
**real-world state that varies**, so they carry one distinct case per
state (see §6.7) — the host passes which case to play. Tone in `()`.

**Multi-case scenes** (each case is its own mini-story, no two alike):

| Category  | Cases | Variant ids (tone)                                                                                                                                                                        |
| --------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `weather` | **7** | `weather-window` sunny (warm) · `weather-cloudy` (cyan) · `weather-rainy` (blue) · `weather-storm` (purple) · `weather-snow` (white) · `weather-fog` (blue) · `weather-windy` (cyan)      |
| `moon`    | **8** | `moon-new` (purple) · `moon-wax-cre` (cyan) · `moon-first-q` (cyan) · `moon-wax-gib` (warm) · `moon-full` (warm) · `moon-wan-gib` (warm) · `moon-last-q` (blue) · `moon-wan-cre` (purple) |
| `call`    | **3** | `call-incoming` (green) · `call-outgoing` (green) · `call-missed` (red)                                                                                                                   |
| `message` | **3** | `message-chat` (cyan) · `message-incoming` (cyan) · `message-sent` (rose)                                                                                                                 |

All remaining scenes have a single arc variant:

| Category      | Variant id          | Tone    | Arc summary                                |
| ------------- | ------------------- | ------- | ------------------------------------------ |
| `clock`       | `clock-tower`       | cyan    | Face builds, hands sweep, bell chimes       |
| `music`       | `music-jam`         | rose    | Speakers in → bars dance → fade out         |
| `timer`       | `timer-countdown`   | orange  | Digits assemble, count down, ding, scatter  |
| `cooking`     | `cooking-pot`       | warm    | Pot → toss ingredients → stir → plate        |
| `walking`     | `walking-scroll`    | green   | Walk in place, scenery scrolls, reach goal  |
| `celebrate`   | `celebrate-grand`   | **multi** | Drumroll → trophy → confetti/fireworks → bow |
| `night`       | `night-fall`        | purple  | Sun sets → moon rises → starry sky          |
| `fitness`     | `fitness-run`       | red     | Suit up → run → HR climbs → cooldown         |
| `camera`      | `camera-snap`       | white   | Pose → countdown → flash → print → save      |
| `navigation`  | `nav-turn`          | cyan    | Turn-by-turn directions → arrive            |
| `gift`        | `gift-unwrap`       | rose    | Wrap → untie ribbon → lift lid → reveal      |
| `coffee`      | `coffee-pour`       | warm    | Cup arrives, pot pours, drink, exit         |
| `plant`       | `plant-grow`        | green   | Pot → seed → water → sprout → bloom          |
| `morning`     | `morning-rise`      | warm    | Asleep → alarm → sunrise → stretch → coffee  |
| `gaming`      | `gaming-play`       | purple  | Bored → find gamepad → play → rest          |
| `calendar`    | `calendar-mark`     | cyan    | Pages flip → date highlights → reminder      |
| `alarm`       | `alarm-bell`        | red     | Sleep → bell rings violently → wake          |
| `notification`| `notif-cards`       | warm    | Cards stack in, get dismissed one by one    |
| `birthday`    | `birthday-cake`     | rose    | Cake / candle / wish                        |
| `reminder`    | `reminder-triple`   | red     | Water → meds → stretch (three vignettes)     |
| `video`       | `video-watch`       | rose    | Player loads → play → buffer → resume → end  |
| `reading`     | `reading-book`      | warm    | Curious → find book → read → close          |
| `smarthome`   | `home-lights`       | warm    | Rooms light up one by one → all on → off     |
| `shopping`    | `shopping-bag`      | green   | Empty bag → items fly in → checkout         |
| `lock`        | `lock-bio`          | green   | Padlock drops → scan → fail → retry → unlock |
| `delivery`    | `delivery-route`    | orange  | Map → truck travels → arrives → box drops    |
| `flashlight`  | `flashlight-sweep`  | warm    | Dark → click on → beam reveals 3 finds → off |
| `podcast`     | `podcast-onair`     | purple  | Mic drops → ON AIR → waveform → off-air      |
| `stopwatch`   | `stopwatch-lap`     | orange  | Drop in → start → tick → lap → stop          |

### Status (kind: 'status') — 2 categories · 11 variants

| Category   | Variants | Purpose                                                  |
| ---------- | -------- | -------------------------------------------------------- |
| `boot`     | 4        | Brand-clean power-on: poweron → credits → checks → ready  |
| `network`  | 7        | Connectivity: wifi-scan / wifi-connect / wifi-retry (orange) / offline (red) / bt-scan (purple) / bt-paired (purple) / server-error (red) |

`boot`: `boot-poweron` · `boot-credits` · `boot-checks-personal` ·
`boot-ready-personal`

`network`: `network-wifi-scan` · `network-wifi-connect` ·
`network-wifi-retry` · `network-offline` · `network-bt-scan` ·
`network-bt-paired` · `network-server-error`

### Variant contract

```js
{
  id: 'normal-look',        // unique kebab-case across the whole library
  label: 'Look around',     // human label
  duration: 4000,           // ms per loop
  tone: 'warm',             // (optional) overrides category.tone; 'multi' for
                            //   variants wanting every tone as --tone-* vars
  render: (t) => /* JSX */, // pure function of t ∈ [0, 1)
}
```

Variants in the same category must be **visually distinct**.

---

## 8. File layout

All paths are relative to `ui/`.

```text
index.html                   ← the sheet: entry point (CSS, React + Babel loader)
src/emotion-core.jsx         ← primitives, constants, EYE_TONES palette
src/screen.jsx               ← screen profiles + Screen (any display) + ScreenData
src/scene-arc.jsx            ← scene-arc engine (window.SceneArc): sceneArc(),
                               EmotionFace, TransformedFace, EMOTION_COLOR
src/emotion-list.jsx         ← base emotion variants; publishes CATEGORIES + KEYS
src/emotion-extras.jsx       ← additional emotion variants + categories
src/scenes.jsx               ← (tiny) tags every existing category kind:'emotion'
src/scenes-boot.jsx          ← boot status flow (kind:'status', 4 variants)
src/scenes-network.jsx       ← network status flow (kind:'status', 7 variants)
src/emotion-balance.jsx      ← balance pass: tops up under-filled emotion cats
src/emotion-more.jsx         ← 8 emotion cats (disgusted, nervous, embarrassed,
                               curious, annoyed, cool, suspicious, determined)
src/emotion-color.jsx        ← tones for emotions + boot/network status
src/emotion-pack-1.jsx       ← emotions sick/cold/calm/playful
src/emotion-pack-2.jsx       ← emotions hot/lonely/grateful
src/emotion-pack-3.jsx       ← emotions brave/dreamy/awe
src/scenes-arc-pack-1.jsx    ← scene-arc videos: 15 scenes (weather/timer/call/…)
src/scenes-arc-pack-2.jsx    ← scene-arc videos: cooking/plant/night/walking/…
src/scenes-arc-pack-3.jsx    ← scene-arc videos: clock/celebrate/fitness/morning/…
src/scenes-arc-pack-3b.jsx   ← scene-arc videos: reminder/video/lock/flashlight/…
                               + authoritative EMOTION_CATEGORY_KEYS order block
src/scenes-weather.jsx       ← multi-case WEATHER: append cloudy/rainy/storm/snow/
                               fog/windy onto cats.weather (per-variant tones)
src/scenes-comms.jsx         ← multi-case CALL (outgoing/missed) + MESSAGE
                               (incoming/sent) appended onto their categories
src/scenes-moon.jsx          ← multi-case MOON: new `moon` category, one story
                               per lunar phase + window.MoonPhase date hookup
src/sheet.jsx                ← the sheet's UI (screen picker, Color/Mono, Idle)
tests/smoke.html, smoke.jsx  ← smoke test: every variant, every screen
docs/requirements.md         ← this file
docs/screens.md              ← how the stage maps onto displays
```

### Load order (as in `index.html`)

```text
 1. emotion-core.jsx        ← window.EmotionCore (+ EYE_TONES)
 2. screen.jsx              ← window.Screens + window.ScreenData
 3. scene-arc.jsx           ← window.SceneArc
 4. emotion-list.jsx        ← window.EMOTION_CATEGORIES + KEYS
 5. emotion-extras.jsx      ← more emotion variants + categories
 6. scenes.jsx              ← tag every existing category kind:'emotion'
 7. scenes-boot.jsx         ← boot status cat + key
 8. scenes-network.jsx      ← network status cat + key
 9. emotion-balance.jsx     ← top up emotion variant counts
10. emotion-more.jsx        ← +8 emotion cats
11. emotion-color.jsx       ← tones for emotions + boot/network
12. emotion-pack-1.jsx      ← +4 emotions
13. emotion-pack-2.jsx      ← +3 emotions
14. emotion-pack-3.jsx      ← +3 emotions
15. scenes-arc-pack-1.jsx   ← define 15 scene-arc videos (cat + inline tone)
16. scenes-arc-pack-2.jsx   ← define 6 scene-arc videos
17. scenes-arc-pack-3.jsx   ← define 5 scene-arc videos
18. scenes-arc-pack-3b.jsx  ← define 6 scene-arc videos + authoritative KEYS order
19. scenes-weather.jsx      ← append weather cases: cloudy/rainy/storm/snow/fog/windy
20. scenes-comms.jsx        ← append call (outgoing/missed) + message (incoming/sent)
21. scenes-moon.jsx         ← new `moon` category (8 phase stories) + KEYS splice
22. sheet.jsx               ← consumes
```

### Architecture note — who owns what

Each category lives in exactly one place now:

- **Emotions** — `emotion-list` / `emotion-extras` / `emotion-balance` /
  `emotion-more` / the three `emotion-pack-*` files. Tones come from
  `emotion-color.jsx` (or inline on the emotion-pack categories).
- **Status** (`boot`, `network`) — `scenes-boot.jsx` / `scenes-network.jsx`;
  tones from `emotion-color.jsx`.
- **Scenes** — authored *only* by the four `scenes-arc-pack-*` files, each
  as a single cinematic arc with its tone set inline. No scene render code
  is duplicated anywhere else.

**One global scope.** Babel compiles every file into a classic script, so
all top-level names land in the same global scope, and a file loaded later
replaces an earlier file's name. Share values only through `window.*`
objects (`EmotionCore`, `SceneArc`, `Screens`, …), and give file-local
helpers names no other file uses. (A `pulse` helper in `scenes-moon.jsx`
once replaced `EmotionCore.pulse` for the whole library; the smoke test now
checks for this.)

`scenes.jsx` is now just the one-line side-effect that tags pre-existing
categories as `kind:'emotion'` (the scene/status packs set their own kind).

**Key order is centralised.** Intermediate files still splice their keys
into `EMOTION_CATEGORY_KEYS`, but the **authoritative order** is the final
block at the end of `scenes-arc-pack-3b.jsx` — one explicit list of every
category, filtered to those that exist (orphans appended at the end). To
reorder or add a category, edit that list. Final grouping: emotions, then
status (`boot`, `network`), then scenes.

---

## 9. Random-picker reference (firmware side)

```js
function pickVariant(categoryKey, recentIds) {
  const cat = EMOTION_CATEGORIES[categoryKey];
  const pool = cat.variants.filter(v => !recentIds.includes(v.id));
  const choices = pool.length ? pool : cat.variants;
  return choices[Math.floor(Math.random() * choices.length)];
}

// Filter by kind:
const emotionKeys = EMOTION_CATEGORY_KEYS
  .filter(k => !EMOTION_CATEGORIES[k].kind || EMOTION_CATEGORIES[k].kind === 'emotion');
const sceneKeys  = EMOTION_CATEGORY_KEYS.filter(k => EMOTION_CATEGORIES[k].kind === 'scene');
const statusKeys = EMOTION_CATEGORY_KEYS.filter(k => EMOTION_CATEGORIES[k].kind === 'status');

// Idle loop (firmware default behaviour):
function tickIdle(state) {
  const v = pickVariant('normal', state.recent);
  state.recent = [...state.recent, v.id].slice(-6);
  play(v);
  schedule(tickIdle, 3000 + Math.random() * 3000); // 3–6 s
}

// Resolving color for any variant:
function toneFor(cat, variant) {
  return variant.tone || cat.tone || 'cyan';
}
```

**Scenes and status flows are picked explicitly** by the host — they don't
enter the random idle pool. Use scenes when there is something to show
(`showScene('weather')`); use status flows for boot / connectivity.

---

## 10. Porting checklist

1. Copy every `src/*.jsx` file under § 8 (except `sheet.jsx`) and this
   file. Mind the load order — color assignment and arc overrides depend on
   every category being registered first.
2. Replace the SVG primitives in `emotion-core.jsx` (`Eye`, `Eyes`,
   `heartPath`, `starPath`, `arcPath`) and the `scene-arc.jsx` engine with
   your renderer's native draw calls. Renderer is called once per frame
   with quantized `t`.
3. Build a color LUT keyed by tone name (`EYE_TONES`). At draw time resolve
   the active tone with `variant.tone || cat.tone || 'cyan'`.
4. **Honor the two-layer color rule (§ 4.2):** cyan for face shapes, the
   resolved tone for accessories / scene props. Status bar always cyan.
5. For `tone: 'multi'` variants, expose every tone as a named slot.
6. Implement `pickVariant` (§ 9) with a per-category recent ring buffer
   (length 4 – 6) and an idle scheduler that picks `normal` every 3 – 6 s.
7. Implement `showScene(catKey)` and the boot/network status FSMs (§ 6.5).
8. Honour the stage geometry: `W=320`, `H=240`, `STATUS_H=20`, `LX=85`,
   `RX=235`, `EYE_W=88`, `EYE_H=96`, `GAP=150`, then place the stage on the
   real display as [screens.md](screens.md) describes.
9. Fill `ScreenData` (§ 6.8) from the robot's configuration.

---

## 11. Design constraints worth keeping

- Eyes fill the screen generously — outer margin only ~41 px each side.
- One visual language across all variants: same eye-shape vocabulary,
  stroke weights, and accessory style (dots, arcs, stars, hearts, Zs).
- In scenes, eyes never disappear — they shrink to a corner and watch.
- Status bar always visible during playback; always fixed cyan.
- Face shapes (eyes, mouth, brows) are fixed cyan across every emotion —
  the category's tone only colors accessories / props.
- No emoji. No raster images. SVG only.
- One bright accent color per frame (except `tone: 'multi'`).

---

## 12. Out of scope (future)

- Sprite-sheet PNG / GIF export per variant.
- Inter-emotion transitions (e.g. `listening → thinking` smooth blend).
- Tweaks panel for eye color / shape / personality preset.
- 16-color palette per scene (currently 9 tones).
