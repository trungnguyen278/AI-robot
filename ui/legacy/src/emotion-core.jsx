// SPDX-License-Identifier: MIT
/* Emotion core — primitives, helpers, constants.
   Loaded BEFORE emotion-list.jsx. Exposes window.EmotionCore.
*/

// ---------- screen + eye geometry ----------
const W = 320, H = 240, STATUS_H = 20;
const CY = STATUS_H + (H - STATUS_H) / 2; // 130 (vertical center of usable area)

// Eyes are deliberately large + spread toward the edges so the screen
// shows the "two ends" of the face. Outer margin (~41 px) leaves room for
// accessories that live outside the eyes (sparkles, tears, Zs, hearts).
const GAP    = 150;
const LX     = Math.round(W / 2 - GAP / 2); // 85
const RX     = Math.round(W / 2 + GAP / 2); // 235
const EYE_W  = 88;
const EYE_H  = 96;
const EYE_RX = 22;

// ---------- math helpers ----------
const TAU = Math.PI * 2;
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap  = (v, m) => ((v % m) + m) % m;
const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out:   (t) => 1 - Math.pow(1 - t, 3),
  in:    (t) => t * t * t,
};
const pulse = (t, center, w) => {
  const d = Math.abs(t - center);
  if (d > w) return 0;
  return Math.cos((d / w) * (Math.PI / 2)) ** 2;
};
const blink = (t, at, d = 0.06) => {
  const dd = t - at;
  if (dd < 0 || dd > d) return 0;
  return Math.sin((dd / d) * Math.PI);
};

// ---------- primitives ----------
function Eye({ x, y, w = EYE_W, h = EYE_H, rx = EYE_RX, rot = 0, op = 1, fill = 'var(--eye)' }) {
  const W2 = w / 2, H2 = Math.max(h, 0.5) / 2;
  return (
    <rect
      x={x - W2} y={y - H2}
      width={w} height={Math.max(h, 0.5)}
      rx={Math.min(rx, w / 2, Math.max(h, 1) / 2)}
      fill={fill} opacity={op}
      transform={`rotate(${rot} ${x} ${y})`}
    />
  );
}

// Two default-positioned eyes with optional per-side overrides.
function Eyes({ L = {}, R = {}, fill = 'var(--eye)' }) {
  const Ld = { x: LX, y: CY, w: EYE_W, h: EYE_H, rx: EYE_RX, rot: 0, op: 1, ...L };
  const Rd = { x: RX, y: CY, w: EYE_W, h: EYE_H, rx: EYE_RX, rot: 0, op: 1, ...R };
  return (
    <g>
      <Eye {...Ld} fill={fill} />
      <Eye {...Rd} fill={fill} />
    </g>
  );
}

// ---------- shape paths ----------
function heartPath(cx, cy, s) {
  const k = s / 30;
  return `M ${cx} ${cy + 9 * k}
          C ${cx - 18 * k} ${cy - 3 * k}, ${cx - 18 * k} ${cy - 18 * k}, ${cx - 9 * k} ${cy - 18 * k}
          C ${cx - 4 * k} ${cy - 18 * k}, ${cx} ${cy - 12 * k}, ${cx} ${cy - 6 * k}
          C ${cx} ${cy - 12 * k}, ${cx + 4 * k} ${cy - 18 * k}, ${cx + 9 * k} ${cy - 18 * k}
          C ${cx + 18 * k} ${cy - 18 * k}, ${cx + 18 * k} ${cy - 3 * k}, ${cx} ${cy + 9 * k} Z`;
}

function starPath(cx, cy, r1, r2) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (-Math.PI / 2) + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? r1 : r2;
    d += (i === 0 ? 'M' : 'L') + ` ${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r} `;
  }
  return d + 'Z';
}

function arcPath(cx, cy, w, depth, flip = false) {
  const sign = flip ? -1 : 1;
  return `M ${cx - w / 2} ${cy} Q ${cx} ${cy + sign * depth}, ${cx + w / 2} ${cy}`;
}

// Slanted mask cap — useful for sad/angry lids.
function lidPath(cx, cy, w, leftHigh, rightHigh) {
  // Returns a closed polygon that covers (cx,cy) area's top, with the inner edges descending/rising
  return `M ${cx - w / 2} ${cy - 40}
          L ${cx + w / 2} ${cy - 40}
          L ${cx + w / 2} ${cy + rightHigh}
          L ${cx - w / 2} ${cy + leftHigh} Z`;
}

// ---------- color tones (TFT-friendly palette) ----------
// Single accent color per category — keeps the "robot display" feel
// (one bright color on near-black), but uses TFT's color range so each
// emotion reads with the right temperature. RGB565-safe values.
const EYE_TONES = {
  cyan:   { eye: '#5be9ff', glow: 'rgba(91,  233, 255, 0.55)' }, // default — calm, neutral
  warm:   { eye: '#ffd166', glow: 'rgba(255, 209, 102, 0.55)' }, // happy, smug, proud
  rose:   { eye: '#ff6b9d', glow: 'rgba(255, 107, 157, 0.55)' }, // love, shy, embarrassed
  red:    { eye: '#ff5b6e', glow: 'rgba(255,  91, 110, 0.60)' }, // angry, error, dead
  blue:   { eye: '#76b8ff', glow: 'rgba(118, 184, 255, 0.55)' }, // sad, crying
  green:  { eye: '#7be88e', glow: 'rgba(123, 232, 142, 0.55)' }, // charging, disgusted
  purple: { eye: '#b48cff', glow: 'rgba(180, 140, 255, 0.55)' }, // sleepy, sleeping, mischievous, dizzy
  orange: { eye: '#ff9d5b', glow: 'rgba(255, 157,  91, 0.55)' }, // hungry, confused, curious, annoyed
  white:  { eye: '#f0f4ff', glow: 'rgba(240, 244, 255, 0.55)' }, // surprised, scared
};

// ---------- expose ----------
window.EmotionCore = {
  W, H, STATUS_H, CY, GAP, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, wrap, ease, pulse, blink,
  Eye, Eyes,
  heartPath, starPath, arcPath, lidPath,
  EYE_TONES,
};
