// SPDX-License-Identifier: MIT
/* Screens — the 320×240 stage, shown on any display.

   Every variant draws into the same stage (W × H = 320 × 240, from
   emotion-core.jsx) with the eyes centered on (W / 2, CY). A screen
   profile describes one display, and Screen places the stage on it:

     rect   the stage is scaled to fit and centered; whatever lies outside
            it is cut off, and the status strip runs across the full width.
     round  the eye center sits on the disc center, at native size on a
            360 px disc (scale = diameter / 360); the corners of the stage
            are cut off at the rim, and a curved cluster replaces the strip.

   Supporting another display means adding a profile to PROFILES; no
   variant changes. Values that differ from one robot to the next (names,
   the network) come from window.ScreenData, which the host fills in.

   Loaded AFTER emotion-core.jsx. Exposes window.Screens and
   window.ScreenData.
*/

const { useState, useEffect, useRef, useId } = React;
const { W, H, STATUS_H, CY, EYE_TONES } = window.EmotionCore;

const BG = '#06090d';            // the screen's background, in every theme
const CYAN = EYE_TONES.cyan.eye; // status chrome is always cyan
const ROUND_BASE = 360;          // disc diameter showing the stage at 1:1

// Displays the library is checked on: width × height in pixels; a round
// display is a disc whose diameter is `width`.
const PROFILES = [
  // This robot's face: Waveshare 7inch DSI LCD (C), hardware/components/.
  { id: 'lcd-1024x600', label: '7" LCD', shape: 'rect', width: 1024, height: 600 },
  // The previous generation's 2" TFT, the size the library was drawn for.
  { id: 'tft-320x240', label: '2" TFT', shape: 'rect', width: 320, height: 240 },
  { id: 'round-240', label: 'Round 240', shape: 'round', width: 240, height: 240 },
  { id: 'round-360', label: 'Round 360', shape: 'round', width: 360, height: 360 },
  { id: 'round-466', label: 'Round 466', shape: 'round', width: 466, height: 466 },
];

// Where the stage goes on a display: drawn at `scale`, its top-left corner
// at (x, y) in the display's pixels.
function placement({ shape, width, height }) {
  if (shape === 'round') {
    const scale = width / ROUND_BASE;
    return { scale, x: width / 2 - (W / 2) * scale, y: height / 2 - CY * scale };
  }
  const scale = Math.min(width / W, height / H);
  return { scale, x: (width - W * scale) / 2, y: (height - H * scale) / 2 };
}

// Values the host provides (the robot's software on the robot, the sheet
// when previewing), so that nothing personal or product-specific is written
// into the library. Variants read them while rendering: update the fields
// in place, e.g. Object.assign(window.ScreenData, { ssid: 'Home' }).
window.ScreenData = Object.assign({
  credits: {                     // boot-credits and boot-ready-personal
    monogram: 'AI',
    name: 'AI ROBOT',
    role: 'design · firmware · hardware',
    tagline: 'one-person build',
  },
  ssid: 'HOME-WIFI',             // network-wifi-connect
  pairedDevice: 'Phone',         // network-bt-paired
}, window.ScreenData);

// Every tone's eye color as a CSS variable (--tone-cyan, --tone-warm…), so
// multi-color scene variants can paint with specific tones.
const MULTI_TONE_VARS = Object.fromEntries(
  Object.entries(EYE_TONES).map(([name, tone]) => [`--tone-${name}`, tone.eye]));

// The CSS palette of one screen.
//   Emotions: --eye is ALWAYS cyan, so the robot's face never changes
//   color between emotions; the emotion's tone only colors accessories
//   (--accent).
//   Scenes: --eye becomes the scene's tone, so scene PROPS read in that
//   tone; the robot's eyes in a scene are still drawn cyan (EmotionFace).
//   Status (boot, network): --eye stays cyan.
//   'multi' is cyan, with every tone also exposed as --tone-*.
function toneVars(tone, kind) {
  const isScene = kind === 'scene';
  const resolved = tone === 'multi' ? 'cyan' : tone;
  const td = EYE_TONES[resolved] || EYE_TONES.cyan;
  const base = isScene
    ? { '--eye': td.eye, '--accent': td.eye, '--eye-glow': td.glow }
    : { '--eye': CYAN, '--accent': td.eye, '--eye-glow': EYE_TONES.cyan.glow };
  return isScene ? { ...base, ...MULTI_TONE_VARS } : base;
}

// A variant's own tone wins over its category's.
function resolveTone(variant, cat) {
  return (variant && variant.tone) || (cat && cat.tone) || 'cyan';
}

// Status strip of a rectangular screen: clock, center dot (or label), Wi-Fi
// and battery, fixed cyan. Drawn in stage units, `width` wide.
function StatusStrip({ width, time, label }) {
  return (
    <g>
      <rect x={0} y={0} width={width} height={STATUS_H} fill="var(--bg)" />
      <line x1={0} y1={STATUS_H} x2={width} y2={STATUS_H}
            stroke={CYAN} strokeWidth={0.5} opacity={0.25} />
      <text x={8} y={14} fontFamily="ui-monospace, Menlo, monospace"
            fontSize={11} fill={CYAN} opacity={0.85}>{time}</text>
      {label ? (
        <text x={width / 2} y={14} textAnchor="middle"
              fontFamily="ui-monospace, Menlo, monospace" fontSize={11}
              fontWeight={600} fill={CYAN} opacity={0.6} letterSpacing={2}>
          {label}
        </text>
      ) : (
        <circle cx={width / 2} cy={10} r={2} fill={CYAN} opacity={0.7} />
      )}
      <g transform={`translate(${width - 46}, 6)`} fill="none"
         stroke={CYAN} strokeWidth={1.2} opacity={0.85}>
        <path d="M 0 6 Q 5 1, 10 6" />
        <path d="M 2 8 Q 5 5, 8 8" />
        <circle cx={5} cy={10} r={0.8} fill={CYAN} />
      </g>
      <g transform={`translate(${width - 28}, 5)`}>
        <rect x={0} y={0} width={20} height={10} rx={1.5} fill="none"
              stroke={CYAN} strokeWidth={1} opacity={0.85} />
        <rect x={20} y={3} width={2} height={4} fill={CYAN} opacity={0.85} />
        <rect x={2} y={2} width={13} height={6} fill={CYAN} opacity={0.85} />
      </g>
    </g>
  );
}

// Status cluster of a round screen, hugging an arc near the top so it clears
// both the rim and the eyes. Drawn on a ROUND_BASE disc, fixed cyan.
function StatusArc({ time, label }) {
  return (
    <g fill="none" stroke={CYAN}>
      {/* clock, left of the arc */}
      <text x={112} y={52} textAnchor="middle" stroke="none" fill={CYAN}
            fontFamily="ui-monospace, Menlo, monospace" fontSize={13}
            opacity={0.85}>{time}</text>

      {/* center marker or label */}
      {label
        ? <text x={180} y={34} textAnchor="middle" stroke="none" fill={CYAN}
                fontFamily="ui-monospace, Menlo, monospace" fontSize={11}
                fontWeight={600} letterSpacing={2} opacity={0.6}>{label}</text>
        : <circle cx={180} cy={32} r={2.4} fill={CYAN} stroke="none" opacity={0.7} />}

      {/* Wi-Fi and battery, right of the arc */}
      <g transform="translate(230 44)" strokeWidth={1.4} opacity={0.85}>
        <path d="M 0 6 Q 6 0, 12 6" />
        <path d="M 2.5 8.5 Q 6 4.8, 9.5 8.5" />
        <circle cx={6} cy={10.5} r={1} fill={CYAN} stroke="none" />
      </g>
      <g transform="translate(250 39)">
        <rect x={0} y={0} width={22} height={11} rx={1.8} fill="none"
              stroke={CYAN} strokeWidth={1.1} opacity={0.85} />
        <rect x={22} y={3.2} width={2.2} height={4.6} fill={CYAN} stroke="none" opacity={0.85} />
        <rect x={2} y={2} width={14} height={7} fill={CYAN} stroke="none" opacity={0.85} />
      </g>
    </g>
  );
}

// One display showing one variant, looping at `fps`: time is quantized to
// whole frames, as on a real panel. Pass `t` (0 to 1) to draw one still
// frame instead.
function Screen({
  variant, profile, fps = 30, t: still, showStatus = true,
  statusTime = '14:32', label = '', tone = 'cyan', kind = 'emotion',
}) {
  const [tick, setTick] = useState(0);
  const startRef = useRef(performance.now());
  const clipId = 'screen' + useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    if (still !== undefined) return undefined;
    startRef.current = performance.now();
    let raf;
    let lastFrame = 0;
    const interval = 1000 / fps;
    const loop = (now) => {
      if (now - lastFrame >= interval) {
        lastFrame = now;
        setTick(now);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps, variant.id, still]);

  let t = still;
  if (t === undefined) {
    const elapsed = Math.max(0, tick - startRef.current);
    const frame = Math.floor((elapsed / 1000) * fps);
    const totalFrames = Math.max(1, Math.round((variant.duration / 1000) * fps));
    t = (((frame % totalFrames) + totalFrames) % totalFrames) / totalFrames;
  }

  const { shape, width, height } = profile;
  const { scale, x, y } = placement(profile);
  const round = shape === 'round';
  const r = width / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet"
         style={{ display: 'block', width: '100%', height: '100%', '--bg': BG }}>
      <defs>
        <clipPath id={clipId}>
          {round
            ? <circle cx={r} cy={r} r={r} />
            : <rect x={x} y={y} width={W * scale} height={H * scale} />}
        </clipPath>
      </defs>

      {/* screen base */}
      {round
        ? <circle cx={r} cy={r} r={r} fill="var(--bg)" />
        : <rect x={0} y={0} width={width} height={height} fill="var(--bg)" />}

      <g style={toneVars(tone, kind)}>
        {!round && showStatus && (
          <g transform={`scale(${scale})`}>
            <StatusStrip width={width / scale} time={statusTime} label={label} />
          </g>
        )}
        <g clipPath={`url(#${clipId})`}>
          <g transform={`translate(${x} ${y}) scale(${scale})`}>
            {variant.render(t)}
          </g>
          {round && showStatus && (
            <g transform={`scale(${width / ROUND_BASE})`}>
              <StatusArc time={statusTime} label={label} />
            </g>
          )}
        </g>
      </g>

      {/* faint inner rim of a round screen */}
      {round && (
        <circle cx={r} cy={r} r={r - 0.75} fill="none"
                stroke={CYAN} strokeWidth={0.75} opacity={0.12} />
      )}
    </svg>
  );
}

window.Screens = { BG, ROUND_BASE, PROFILES, placement, toneVars, resolveTone, Screen };
