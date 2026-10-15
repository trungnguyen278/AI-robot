// SPDX-License-Identifier: MIT
/* Emotion pack 3.
   Adds emotions: brave, dreamy, awe.
   (Its former scenes are authored by the scenes-arc-pack-* files.)
   Loaded AFTER emotion-pack-2.jsx.
   Checked for overlap with: every existing category in cats.
*/

const {
  W, H, STATUS_H, CY, GAP, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, wrap, ease, pulse, blink,
  Eye, Eyes, heartPath, starPath, arcPath,
} = window.EmotionCore;

const cats = window.EMOTION_CATEGORIES;

// =============================================================
// EMOTION: BRAVE — 3 variants
// =============================================================
cats.brave = {
  label: 'Brave',
  desc: 'Fierce / steady courage.',
  kind: 'emotion',
  tone: 'red',
  variants: [
    { id: 'brave-stance', label: 'Fierce stance', duration: 2400,
      render: (t) => {
        const breath = Math.sin(t * TAU * 0.7) * 1.5;
        return (
          <g>
            {/* sharp, narrowed eyes */}
            <Eyes L={{ h: EYE_H * 0.5, rx: 8, y: CY + 4 + breath }}
                  R={{ h: EYE_H * 0.5, rx: 8, y: CY + 4 + breath }} />
            {/* strong V-brows */}
            <g stroke="var(--eye)" strokeWidth={9} strokeLinecap="round">
              <line x1={LX - 38} y1={CY - 44} x2={LX + 28} y2={CY - 26} />
              <line x1={RX + 38} y1={CY - 44} x2={RX - 28} y2={CY - 26} />
            </g>
            {/* small flame icon over center */}
            <g transform={`translate(${W / 2} ${STATUS_H + 24})`}>
              <path d={`M 0 8
                        C -8 4, -8 -6, -2 -10
                        C -2 -4, 4 -2, 4 -10
                        C 8 -6, 8 4, 0 8 Z`}
                    fill="var(--accent)"
                    transform={`scale(${1 + breath * 0.05})`} />
            </g>
          </g>
        );
      } },

    { id: 'brave-shield', label: 'Shield up', duration: 2200,
      render: (t) => {
        const pop = t < 0.2 ? ease.out(t / 0.2) : 1;
        return (
          <g>
            {/* shield centered, slightly behind eyes */}
            <g transform={`translate(${W / 2} ${CY + 8}) scale(${pop})`}>
              <path d="M 0 -42
                       L 40 -34
                       L 36 8
                       Q 30 28, 0 42
                       Q -30 28, -36 8
                       L -40 -34 Z"
                    fill="var(--eye)" />
              <path d="M -6 -22 L 6 -22 L 6 0 L 14 0 L 0 16 L -14 0 L -6 0 Z"
                    fill="var(--bg)" opacity={0.7} />
            </g>
            {/* eye peeks at the top corners of the shield */}
            <Eye x={LX} y={CY - 32} h={EYE_H * 0.35} rx={10} />
            <Eye x={RX} y={CY - 32} h={EYE_H * 0.35} rx={10} />
          </g>
        );
      } },

    { id: 'brave-charge', label: 'Charge', duration: 1200,
      render: (t) => {
        const step = Math.sin(t * TAU * 2) * 6;
        return (
          <g transform={`translate(${step} 0)`}>
            {/* angled determined eyes */}
            <g>
              <Eye x={LX} y={CY} h={EYE_H * 0.55} rx={10} rot={-8} />
              <Eye x={RX} y={CY} h={EYE_H * 0.55} rx={10} rot={8} />
            </g>
            {/* speed lines trailing behind */}
            {[0, 1, 2, 3].map((i) => {
              const p = ((t * 3) + i * 0.25) % 1;
              return (
                <line key={i}
                      x1={2 + p * 28} y1={STATUS_H + 30 + i * 36}
                      x2={20 + p * 28} y2={STATUS_H + 30 + i * 36}
                      stroke="var(--accent)" strokeWidth={2.5}
                      strokeLinecap="round" opacity={1 - p} />
              );
            })}
            {/* forward arrow */}
            <path d={`M ${W - 28} ${CY - 10}
                      L ${W - 12} ${CY}
                      L ${W - 28} ${CY + 10}
                      M ${W - 12} ${CY} L ${W - 40} ${CY}`}
                  fill="none" stroke="var(--accent)" strokeWidth={4}
                  strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      } },
  ],
};

// =============================================================
// EMOTION: DREAMY — 3 variants
// =============================================================
cats.dreamy = {
  label: 'Dreamy',
  desc: 'Daydreaming / head in clouds.',
  kind: 'emotion',
  tone: 'purple',
  variants: [
    { id: 'dreamy-clouds', label: 'Floating clouds', duration: 4400,
      render: (t) => {
        const drift = Math.sin(t * TAU * 0.4) * 4;
        return (
          <g>
            {/* soft, slightly upturned eyes */}
            <Eyes L={{ y: CY - 2 + drift, h: EYE_H * 0.75, rx: 28 }}
                  R={{ y: CY - 2 + drift, h: EYE_H * 0.75, rx: 28 }} />
            {/* small twinkle in each eye */}
            <circle cx={LX - 14} cy={CY - 8 + drift} r={5} fill="var(--bg)" opacity={0.85} />
            <circle cx={RX - 14} cy={CY - 8 + drift} r={5} fill="var(--bg)" opacity={0.85} />
            {/* clouds drifting across top */}
            {[0, 1, 2].map((i) => {
              const seed = i * 0.33;
              const p = ((t * 0.5) + seed) % 1;
              const x = -40 + p * (W + 80);
              const y = STATUS_H + 8 + (i % 2) * 6;
              return (
                <g key={i} transform={`translate(${x} ${y})`}
                   fill="var(--accent)" opacity={0.7}>
                  <ellipse cx={0} cy={0} rx={10} ry={5} />
                  <ellipse cx={8} cy={-3} rx={8} ry={5} />
                  <ellipse cx={-8} cy={-2} rx={7} ry={4} />
                </g>
              );
            })}
          </g>
        );
      } },

    { id: 'dreamy-bubbles', label: 'Thought bubbles', duration: 3800,
      render: (t) => {
        const lookUp = Math.sin(t * TAU * 0.5) * 4 - 8;
        return (
          <g>
            <Eyes L={{ y: CY + 4, h: EYE_H * 0.7 }}
                  R={{ y: CY + 4, h: EYE_H * 0.7 }} />
            {/* pupils look up-right */}
            <circle cx={LX + 8} cy={CY + 4 + lookUp} r={10} fill="var(--bg)" />
            <circle cx={RX + 8} cy={CY + 4 + lookUp} r={10} fill="var(--bg)" />
            {/* rising thought bubbles */}
            {[0, 1, 2, 3].map((i) => {
              const seed = i * 0.25;
              const p = ((t * 0.7) + seed) % 1;
              const x = RX + 30 + p * 24;
              const y = lerp(CY - 20, STATUS_H + 8, p);
              const r = lerp(3, 14, p);
              return (
                <circle key={i} cx={x} cy={y} r={r}
                        fill="none" stroke="var(--accent)" strokeWidth={2}
                        opacity={1 - p * 0.4} />
              );
            })}
          </g>
        );
      } },

    { id: 'dreamy-sparkle', label: 'Distant sparkle', duration: 3000,
      render: (t) => (
        <g>
          {/* unfocused soft eyes */}
          <Eyes L={{ h: EYE_H * 0.65, rx: 28 }}
                R={{ h: EYE_H * 0.65, rx: 28 }} />
          {/* hollow centers — gaze goes through */}
          <circle cx={LX} cy={CY} r={14} fill="var(--bg)" opacity={0.6} />
          <circle cx={RX} cy={CY} r={14} fill="var(--bg)" opacity={0.6} />
          {/* distant sparkle field */}
          {Array.from({ length: 7 }).map((_, i) => {
            const seed = ((i * 53) % 100) / 100;
            const p = ((t * 0.8) + seed) % 1;
            const x = (i * 47) % (W - 20) + 10;
            const y = STATUS_H + 14 + ((i * 31) % 60);
            const s = 2 + Math.abs(Math.sin(p * TAU)) * 3;
            return (
              <path key={i} d={starPath(x, y, s, s * 0.4)}
                    fill="var(--accent)" opacity={0.4 + Math.abs(Math.sin(p * TAU)) * 0.5} />
            );
          })}
        </g>
      ) },
  ],
};

// =============================================================
// EMOTION: AWE — 2 variants (distinct from surprised: sustained wonder,
//   not sudden shock)
// =============================================================
cats.awe = {
  label: 'Awe',
  desc: 'Wonder / quiet amazement.',
  kind: 'emotion',
  tone: 'white',
  variants: [
    { id: 'awe-gaze', label: 'Slow gaze', duration: 3600,
      render: (t) => {
        const lift = (Math.sin(t * TAU - Math.PI / 2) + 1) / 2;
        const sz = 1 + lift * 0.15;
        return (
          <g>
            {/* wide round eyes that grow slowly */}
            <Eyes L={{ w: EYE_W * 1.08 * sz, h: EYE_H * 1.05 * sz }}
                  R={{ w: EYE_W * 1.08 * sz, h: EYE_H * 1.05 * sz }} />
            {/* dual highlights — twinkle stars inside */}
            <path d={starPath(LX - 12, CY - 12, 8, 3.2)}
                  fill="var(--bg)" opacity={0.85} />
            <path d={starPath(RX - 12, CY - 12, 8, 3.2)}
                  fill="var(--bg)" opacity={0.85} />
            {/* small upturned mouth (parted lips of wonder) */}
            <ellipse cx={W / 2} cy={H - 30}
                     rx={5 + lift * 3} ry={3 + lift * 5}
                     fill="none" stroke="var(--eye)" strokeWidth={3} />
          </g>
        );
      } },

    { id: 'awe-rays', label: 'Light rays', duration: 3200,
      render: (t) => (
        <g>
          {/* radial rays emanating from a high source */}
          {Array.from({ length: 9 }).map((_, i) => {
            const a = -Math.PI + (i / 8) * Math.PI; // -180 to 0 → top half
            const len = 70 + Math.sin(t * TAU + i) * 6;
            const x1 = W / 2 + Math.cos(a) * 12;
            const y1 = STATUS_H + 6 + Math.sin(a) * 12;
            const x2 = W / 2 + Math.cos(a) * len;
            const y2 = STATUS_H + 6 + Math.sin(a) * len;
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="var(--accent)" strokeWidth={2}
                    strokeLinecap="round" opacity={0.45} />
            );
          })}
          {/* lit-up wide eyes looking up */}
          <Eyes L={{ y: CY + 4, w: EYE_W, h: EYE_H * 0.95 }}
                R={{ y: CY + 4, w: EYE_W, h: EYE_H * 0.95 }} />
          {/* pupils tucked at top of eye */}
          <ellipse cx={LX} cy={CY - 16} rx={12} ry={8} fill="var(--bg)" />
          <ellipse cx={RX} cy={CY - 16} rx={12} ry={8} fill="var(--bg)" />
        </g>
      ) },
  ],
};

// =============================================================
// Merge new EMOTION keys into the public KEYS list.
// (This pack's scene categories are authored + key-registered by the
//  scenes-arc-pack-* files, which load last. Final order is fixed by the
//  authoritative ORDER block at the end of scenes-arc-pack-3b.jsx.)
// =============================================================
(() => {
  const newEmotionKeys = ['brave', 'dreamy', 'awe'];
  const keys = (window.EMOTION_CATEGORY_KEYS || Object.keys(cats))
                 .filter((k) => !newEmotionKeys.includes(k));
  let firstScene = keys.findIndex((k) => cats[k] && cats[k].kind === 'scene');
  if (firstScene === -1) firstScene = keys.length;
  keys.splice(firstScene, 0, ...newEmotionKeys.filter((k) => k in cats));
  window.EMOTION_CATEGORY_KEYS = keys;
})();
