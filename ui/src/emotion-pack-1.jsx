// SPDX-License-Identifier: MIT
/* Emotion pack 1.
   Adds emotions: sick, cold, calm, playful.
   (Scenes alarm/notification/birthday/reminder/video are authored by the
    scenes-arc-pack-* files; this pack only contributes emotions now.)
   Loaded AFTER emotion-color.jsx, so we set tones inline.
*/

const {
  W, H, STATUS_H, CY, GAP, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, wrap, ease, pulse, blink,
  Eye, Eyes, heartPath, starPath, arcPath,
} = window.EmotionCore;

const cats = window.EMOTION_CATEGORIES;

// =============================================================
// EMOTION: SICK — 3 variants
// =============================================================
cats.sick = {
  label: 'Sick',
  desc: 'Feverish / unwell.',
  kind: 'emotion',
  tone: 'green',
  variants: [
    { id: 'sick-fever', label: 'Fever', duration: 2800,
      render: (t) => {
        const droop = 4 + Math.sin(t * TAU * 0.5) * 1.5;
        const y = CY + droop;
        const sweat = (t * 1.4) % 1;
        return (
          <g>
            <Eyes L={{ y, h: EYE_H * 0.55, rx: 14 }}
                  R={{ y, h: EYE_H * 0.55, rx: 14 }} />
            {/* sweat drop on forehead */}
            <g opacity={1 - sweat * 0.4}>
              <path d={`M ${W/2 + 28} ${STATUS_H + 18 + sweat * 40}
                        q -6 -8, 0 -14 q 6 6, 0 14 Z`}
                    fill="var(--accent)" />
            </g>
            {/* thermometer bar across top */}
            <g transform={`translate(${W/2 - 36}, ${STATUS_H + 10})`}>
              <rect x={0} y={0} width={72} height={6} rx={3}
                    fill="none" stroke="var(--eye)" strokeWidth={1.5} opacity={0.5} />
              <rect x={2} y={2} width={lerp(40, 64, (Math.sin(t * TAU * 2) + 1) / 2)}
                    height={2} rx={1} fill="var(--accent)" />
            </g>
            {/* downturned mouth */}
            <path d={arcPath(W/2, H - 30, 30, 5)}
                  fill="none" stroke="var(--eye)" strokeWidth={4}
                  strokeLinecap="round" opacity={0.7} />
          </g>
        );
      } },

    { id: 'sick-queasy', label: 'Queasy', duration: 2400,
      render: (t) => {
        const wob = Math.sin(t * TAU * 1.5) * 5;
        const ty = Math.cos(t * TAU * 1.5) * 3;
        return (
          <g>
            <Eyes L={{ x: LX + wob, y: CY + ty, h: EYE_H * 0.6 }}
                  R={{ x: RX - wob, y: CY - ty, h: EYE_H * 0.6 }} />
            {/* wavy nausea line at bottom */}
            <g fill="none" stroke="var(--accent)" strokeWidth={3.5}
               strokeLinecap="round">
              <path d={`M 60 ${H - 28}
                        Q 90 ${H - 28 + Math.sin(t * TAU * 2) * 6}, 120 ${H - 28}
                        T 180 ${H - 28}
                        T 240 ${H - 28}
                        T 260 ${H - 28}`} />
            </g>
          </g>
        );
      } },

    { id: 'sick-mask', label: 'Mask', duration: 3200,
      render: (t) => {
        const breath = Math.sin(t * TAU) * 1.5;
        return (
          <g>
            <Eyes L={{ y: CY - 8, h: EYE_H * 0.7 }}
                  R={{ y: CY - 8, h: EYE_H * 0.7 }} />
            {/* surgical mask shape across lower half */}
            <g>
              <rect x={W/2 - 70} y={H - 60 + breath} width={140} height={42}
                    rx={20} fill="var(--eye)" opacity={0.85} />
              {/* mask fold lines */}
              <line x1={W/2 - 60} y1={H - 46 + breath} x2={W/2 + 60} y2={H - 46 + breath}
                    stroke="var(--bg)" strokeWidth={1} opacity={0.5} />
              <line x1={W/2 - 60} y1={H - 36 + breath} x2={W/2 + 60} y2={H - 36 + breath}
                    stroke="var(--bg)" strokeWidth={1} opacity={0.5} />
              {/* ear loops */}
              <path d={`M ${W/2 - 70} ${H - 50 + breath}
                        Q ${W/2 - 96} ${H - 40 + breath}, ${W/2 - 70} ${H - 28 + breath}`}
                    stroke="var(--eye)" strokeWidth={2} fill="none" opacity={0.7} />
              <path d={`M ${W/2 + 70} ${H - 50 + breath}
                        Q ${W/2 + 96} ${H - 40 + breath}, ${W/2 + 70} ${H - 28 + breath}`}
                    stroke="var(--eye)" strokeWidth={2} fill="none" opacity={0.7} />
            </g>
          </g>
        );
      } },
  ],
};

// =============================================================
// EMOTION: COLD — 2 variants
// =============================================================
cats.cold = {
  label: 'Cold',
  desc: 'Shivering / freezing.',
  kind: 'emotion',
  tone: 'blue',
  variants: [
    { id: 'cold-shiver', label: 'Shiver', duration: 700,
      render: (t) => {
        const sh = Math.sin(t * TAU * 10) * 3;
        const sv = Math.cos(t * TAU * 10) * 2;
        return (
          <g transform={`translate(${sh} ${sv})`}>
            <Eyes L={{ h: EYE_H * 0.6, rx: 16 }}
                  R={{ h: EYE_H * 0.6, rx: 16 }} />
            {/* chattering teeth (zigzag bar) */}
            <path d={`M ${W/2 - 24} ${H - 30}
                      l 6 4 l 6 -4 l 6 4 l 6 -4 l 6 4 l 6 -4`}
                  fill="none" stroke="var(--eye)" strokeWidth={3}
                  strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'cold-snowflakes', label: 'Snowflakes', duration: 3000,
      render: (t) => {
        const sh = Math.sin(t * TAU * 8) * 1.5;
        return (
          <g>
            <g transform={`translate(${sh} 0)`}>
              <Eyes L={{ h: EYE_H * 0.65 }}
                    R={{ h: EYE_H * 0.65 }} />
            </g>
            {/* drifting snowflakes */}
            {[0, 1, 2, 3, 4].map((i) => {
              const seed = i * 0.21;
              const p = ((t + seed) % 1);
              const x = 30 + (i * 56) % (W - 60) + Math.sin(p * TAU + i) * 8;
              const y = lerp(STATUS_H + 4, H - 8, p);
              const r = 3 + (i % 2) * 1;
              return (
                <g key={i} transform={`translate(${x} ${y}) rotate(${p * 360})`}
                   opacity={1 - p * 0.3}>
                  <line x1={-r} y1={0} x2={r} y2={0}
                        stroke="var(--eye)" strokeWidth={1.5} strokeLinecap="round" />
                  <line x1={0} y1={-r} x2={0} y2={r}
                        stroke="var(--eye)" strokeWidth={1.5} strokeLinecap="round" />
                  <line x1={-r * 0.7} y1={-r * 0.7} x2={r * 0.7} y2={r * 0.7}
                        stroke="var(--eye)" strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
                  <line x1={r * 0.7} y1={-r * 0.7} x2={-r * 0.7} y2={r * 0.7}
                        stroke="var(--eye)" strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
                </g>
              );
            })}
          </g>
        );
      } },
  ],
};

// =============================================================
// EMOTION: CALM — 3 variants
// =============================================================
cats.calm = {
  label: 'Calm',
  desc: 'Meditation / serene.',
  kind: 'emotion',
  tone: 'cyan',
  variants: [
    { id: 'calm-breathe', label: 'Slow breathe', duration: 6000,
      render: (t) => {
        const phase = (Math.sin(t * TAU - Math.PI / 2) + 1) / 2;
        const h = lerp(10, 22, phase);
        return (
          <g fill="none" stroke="var(--eye)" strokeWidth={lerp(10, 13, phase)}
             strokeLinecap="round">
            <path d={arcPath(LX, CY, EYE_W - 8, h)} />
            <path d={arcPath(RX, CY, EYE_W - 8, h)} />
            {/* breathing dot */}
            <circle cx={W / 2} cy={H - 28} r={lerp(3, 6, phase)}
                    fill="var(--accent)" opacity={0.7} />
          </g>
        );
      } },

    { id: 'calm-zen', label: 'Zen circle', duration: 4800,
      render: (t) => {
        // Slowly-drawing enso (zen circle) behind closed eyes.
        const drawn = clamp(t * 1.3, 0, 1);
        const start = Math.PI * 0.75;
        const end = start + drawn * Math.PI * 1.7;
        const cx = W / 2, cy = CY, r = 60;
        const x1 = cx + Math.cos(start) * r, y1 = cy + Math.sin(start) * r;
        const x2 = cx + Math.cos(end) * r, y2 = cy + Math.sin(end) * r;
        const large = (end - start) > Math.PI ? 1 : 0;
        return (
          <g>
            <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
                  fill="none" stroke="var(--accent)" strokeWidth={6}
                  strokeLinecap="round" opacity={0.55} />
            <g fill="none" stroke="var(--eye)" strokeWidth={10}
               strokeLinecap="round">
              <path d={arcPath(LX, CY + 4, EYE_W - 16, 14)} />
              <path d={arcPath(RX, CY + 4, EYE_W - 16, 14)} />
            </g>
          </g>
        );
      } },

    { id: 'calm-lotus', label: 'Lotus', duration: 4000,
      render: (t) => {
        const breath = (Math.sin(t * TAU - Math.PI / 2) + 1) / 2;
        return (
          <g>
            <g fill="none" stroke="var(--eye)" strokeWidth={11}
               strokeLinecap="round">
              <path d={arcPath(LX, CY, EYE_W - 14, lerp(12, 18, breath))} />
              <path d={arcPath(RX, CY, EYE_W - 14, lerp(12, 18, breath))} />
            </g>
            {/* lotus petals at bottom */}
            <g fill="var(--accent)" opacity={0.7}>
              {[-30, -15, 0, 15, 30].map((deg, i) => {
                const a = deg * Math.PI / 180;
                const cx = W / 2 + Math.sin(a) * 36;
                const cy = H - 36 + (1 - Math.cos(a)) * -10;
                return (
                  <ellipse key={i} cx={cx} cy={cy}
                           rx={5 + breath * 1.5} ry={11 + breath * 2}
                           transform={`rotate(${deg} ${cx} ${cy})`}
                           opacity={0.5 + i * 0.08} />
                );
              })}
            </g>
          </g>
        );
      } },
  ],
};

// =============================================================
// EMOTION: PLAYFUL — 3 variants
// =============================================================
cats.playful = {
  label: 'Playful',
  desc: 'Silly / cheeky.',
  kind: 'emotion',
  tone: 'rose',
  variants: [
    { id: 'playful-blep', label: 'Tongue blep', duration: 2000,
      render: (t) => {
        const wob = Math.sin(t * TAU * 3) * 2;
        const tongueOut = pulse(t, 0.5, 0.35);
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.85, y: CY - 4 + wob }}
                  R={{ h: EYE_H * 0.85, y: CY - 4 + wob }} />
            {/* tongue */}
            {tongueOut > 0.05 && (
              <g>
                <ellipse cx={W / 2} cy={H - 24 + tongueOut * 16}
                         rx={12} ry={9 + tongueOut * 4}
                         fill="var(--accent)" />
                <line x1={W/2} y1={H - 30 + tongueOut * 12}
                      x2={W/2} y2={H - 20 + tongueOut * 18}
                      stroke="var(--bg)" strokeWidth={1.5} opacity={0.6} />
              </g>
            )}
          </g>
        );
      } },

    { id: 'playful-tease', label: 'Wink + stick', duration: 2400,
      render: (t) => {
        const close = pulse(t, 0.35, 0.18);
        const stick = pulse(t, 0.5, 0.3);
        return (
          <g>
            {close > 0.5 ? (
              <path d={arcPath(LX, CY + 6, EYE_W - 6, 18, true)}
                    fill="none" stroke="var(--eye)"
                    strokeWidth={12} strokeLinecap="round" />
            ) : (
              <Eye x={LX} y={CY} h={EYE_H * (1 - close * 0.6)} />
            )}
            <Eye x={RX} y={CY} h={EYE_H * 0.95} />
            {stick > 0.05 && (
              <ellipse cx={W / 2 + 8} cy={H - 26 + stick * 8}
                       rx={10} ry={6 + stick * 3} fill="var(--accent)" />
            )}
          </g>
        );
      } },

    { id: 'playful-boop', label: 'Boop', duration: 1800,
      render: (t) => {
        const hit = pulse(t, 0.5, 0.12);
        const sq = 1 - hit * 0.18;
        return (
          <g>
            <Eyes L={{ w: EYE_W * sq, h: EYE_H * sq }}
                  R={{ w: EYE_W * sq, h: EYE_H * sq }} />
            {/* finger boop indicator: dot + radiating rings */}
            {hit > 0.05 && [0, 1, 2].map((i) => (
              <circle key={i} cx={W / 2} cy={CY + 2}
                      r={6 + i * 12 * hit}
                      fill="none" stroke="var(--accent)" strokeWidth={2}
                      opacity={(1 - i * 0.3) * (1 - hit * 0.5)} />
            ))}
            {/* smile */}
            <path d={arcPath(W / 2, H - 30, 50, 10, true)}
                  fill="none" stroke="var(--eye)" strokeWidth={5}
                  strokeLinecap="round" />
          </g>
        );
      } },
  ],
};

// =============================================================
// Merge new EMOTION keys into the public KEYS list.
// (This pack's scene categories are authored + key-registered by the
//  scenes-arc-pack-* files, which load last. Final order is fixed by the
//  authoritative ORDER block at the end of scenes-arc-pack-3b.jsx.)
// =============================================================
(() => {
  const newEmotionKeys = ['sick', 'cold', 'calm', 'playful'];
  const keys = (window.EMOTION_CATEGORY_KEYS || Object.keys(cats))
                 .filter((k) => !newEmotionKeys.includes(k));
  let firstScene = keys.findIndex((k) => cats[k] && cats[k].kind === 'scene');
  if (firstScene === -1) firstScene = keys.length;
  keys.splice(firstScene, 0, ...newEmotionKeys.filter((k) => k in cats));
  window.EMOTION_CATEGORY_KEYS = keys;
})();
