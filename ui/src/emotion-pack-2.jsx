// SPDX-License-Identifier: MIT
/* Emotion pack 2.
   Adds emotions: hot, lonely, grateful.
   (Its former scenes are authored by the scenes-arc-pack-* files.)
   Loaded AFTER emotion-pack-1.jsx.
*/

const {
  W, H, STATUS_H, CY, GAP, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, wrap, ease, pulse, blink,
  Eye, Eyes, heartPath, starPath, arcPath,
} = window.EmotionCore;

const cats = window.EMOTION_CATEGORIES;

// =============================================================
// EMOTION: HOT — 3 variants
// =============================================================
cats.hot = {
  label: 'Hot',
  desc: 'Sweltering / overheated.',
  kind: 'emotion',
  tone: 'red',
  variants: [
    { id: 'hot-sweat', label: 'Sweat drops', duration: 2200,
      render: (t) => {
        const droop = 2 + Math.sin(t * TAU * 0.6) * 1;
        const y = CY + droop;
        return (
          <g>
            <Eyes L={{ y, h: EYE_H * 0.65 }} R={{ y, h: EYE_H * 0.65 }} />
            {/* sweat beads dripping from above the eyes */}
            {[0, 1, 2].map((i) => {
              const seed = i * 0.33;
              const p = ((t * 1.2) + seed) % 1;
              const x = i === 0 ? LX - 24 : i === 1 ? W / 2 : RX + 24;
              const yPos = STATUS_H + 8 + p * 80;
              return (
                <g key={i} opacity={1 - p * 0.3}>
                  <path d={`M ${x} ${yPos}
                            q -5 -8, 0 -14 q 5 6, 0 14 Z`}
                        fill="var(--accent)" />
                  <ellipse cx={x - 1.5} cy={yPos - 5} rx={1.5} ry={2.5}
                           fill="var(--bg)" opacity={0.7} />
                </g>
              );
            })}
            {/* heat lines on right */}
            {[0, 1, 2].map((i) => {
              const wob = Math.sin(t * TAU * 2 + i) * 4;
              return (
                <path key={i}
                      d={`M ${W - 20 - i * 8} ${CY - 30}
                          q ${wob} 12, 0 24
                          q ${-wob} 12, 0 24`}
                      fill="none" stroke="var(--accent)" strokeWidth={2}
                      strokeLinecap="round" opacity={0.55} />
              );
            })}
          </g>
        );
      } },

    { id: 'hot-fan', label: 'Fan self', duration: 1400,
      render: (t) => {
        const swing = Math.sin(t * TAU * 3) * 24;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.7 }} R={{ h: EYE_H * 0.7 }} />
            {/* hand-fan arc swinging across right side */}
            <g transform={`translate(${W - 36} ${CY + 8}) rotate(${swing})`}>
              <path d="M 0 0 L -22 -14 A 26 26 0 0 1 -22 14 Z"
                    fill="var(--accent)" />
              <line x1={0} y1={0} x2={-22} y2={-14}
                    stroke="var(--eye)" strokeWidth={1} opacity={0.5} />
              <line x1={0} y1={0} x2={-26} y2={0}
                    stroke="var(--eye)" strokeWidth={1} opacity={0.5} />
              <line x1={0} y1={0} x2={-22} y2={14}
                    stroke="var(--eye)" strokeWidth={1} opacity={0.5} />
            </g>
            {/* wind lines opposite */}
            {[0, 1, 2].map((i) => {
              const p = ((t * 2) + i * 0.3) % 1;
              return (
                <line key={i}
                      x1={W - 70 - p * 24} y1={CY - 16 + i * 16}
                      x2={W - 90 - p * 24} y2={CY - 16 + i * 16}
                      stroke="var(--accent)" strokeWidth={2.5}
                      strokeLinecap="round" opacity={1 - p} />
              );
            })}
          </g>
        );
      } },

    { id: 'hot-melt', label: 'Melting', duration: 3000,
      render: (t) => {
        const melt = (Math.sin(t * TAU - Math.PI / 2) + 1) / 2;
        const dropH = lerp(0, 22, melt);
        return (
          <g>
            {/* eyes melt down — bottoms stretched into drips */}
            {[LX, RX].map((cx, i) => (
              <g key={i}>
                <Eye x={cx} y={CY} h={EYE_H * (0.8 - melt * 0.15)} />
                {/* drip below */}
                <ellipse cx={cx - 14} cy={CY + EYE_H / 2 + dropH * 0.4}
                         rx={6} ry={dropH * 0.5} fill="var(--eye)" />
                <ellipse cx={cx + 14} cy={CY + EYE_H / 2 + dropH * 0.7}
                         rx={5} ry={dropH * 0.6} fill="var(--eye)" />
                <circle cx={cx - 14} cy={CY + EYE_H / 2 + dropH * 0.8}
                        r={4 + melt * 2} fill="var(--eye)" />
                <circle cx={cx + 14} cy={CY + EYE_H / 2 + dropH * 1.2}
                        r={3 + melt * 2} fill="var(--eye)" />
              </g>
            ))}
            {/* puddle at bottom */}
            <ellipse cx={W / 2} cy={H - 14}
                     rx={lerp(20, 70, melt)} ry={lerp(2, 6, melt)}
                     fill="var(--accent)" opacity={0.6} />
          </g>
        );
      } },
  ],
};

// =============================================================
// EMOTION: LONELY — 3 variants
// =============================================================
cats.lonely = {
  label: 'Lonely',
  desc: 'Alone / wanting company.',
  kind: 'emotion',
  tone: 'blue',
  variants: [
    { id: 'lonely-sigh', label: 'Lonely sigh', duration: 4400,
      render: (t) => {
        const phase = Math.sin(t * TAU - Math.PI / 2);
        const droop = lerp(2, 8, (phase + 1) / 2);
        const y = CY + droop;
        return (
          <g>
            <Eyes L={{ y, h: EYE_H * 0.55, rx: 14 }}
                  R={{ y, h: EYE_H * 0.55, rx: 14 }} />
            {/* breath-out cloud */}
            {phase > 0.2 && (
              <g opacity={(phase - 0.2) * 1.2} fill="var(--accent)">
                {[0, 1, 2].map((i) => (
                  <circle key={i}
                          cx={W / 2 + (i - 1) * 10}
                          cy={H - 24 + (phase - 0.2) * 14}
                          r={4 + (1 - Math.abs(i - 1) * 0.3) * 2}
                          opacity={0.5} />
                ))}
              </g>
            )}
            {/* faint dotted ring around eyes = isolation */}
            <ellipse cx={W / 2} cy={CY + 8} rx={120} ry={56}
                     fill="none" stroke="var(--accent)" strokeWidth={1}
                     strokeDasharray="2 6" opacity={0.35} />
          </g>
        );
      } },

    { id: 'lonely-empty', label: 'Empty room', duration: 5200,
      render: (t) => {
        const driftX = Math.sin(t * TAU * 0.4) * 4;
        return (
          <g>
            {/* one solo eye centered */}
            <Eye x={W / 2 + driftX} y={CY} w={EYE_W * 0.9}
                 h={EYE_H * 0.6} rx={16} />
            {/* faint outline of where the other eye "should be" */}
            <ellipse cx={LX} cy={CY} rx={EYE_W / 2} ry={EYE_H * 0.3}
                     fill="none" stroke="var(--eye)" strokeWidth={1}
                     opacity={0.2} strokeDasharray="3 5" />
            <ellipse cx={RX} cy={CY} rx={EYE_W / 2} ry={EYE_H * 0.3}
                     fill="none" stroke="var(--eye)" strokeWidth={1}
                     opacity={0.2} strokeDasharray="3 5" />
            {/* dim status text */}
            <text x={W / 2} y={H - 14} textAnchor="middle"
                  fontFamily="ui-monospace, Menlo, monospace"
                  fontSize={10} fontWeight={600}
                  fill="var(--accent)" letterSpacing={3} opacity={0.6}>
              ALONE
            </text>
          </g>
        );
      } },

    { id: 'lonely-window', label: 'At the window', duration: 4800,
      render: (t) => {
        const droop = 4;
        const y = CY + droop;
        return (
          <g>
            {/* window frame */}
            <g stroke="var(--accent)" strokeWidth={2} fill="none" opacity={0.45}>
              <rect x={W / 2 - 70} y={STATUS_H + 14}
                    width={140} height={H - STATUS_H - 32} rx={2} />
              <line x1={W / 2} y1={STATUS_H + 14} x2={W / 2} y2={H - 18} />
              <line x1={W / 2 - 70} y1={CY} x2={W / 2 + 70} y2={CY} />
            </g>
            {/* eyes look down through window */}
            <Eyes L={{ y, h: EYE_H * 0.55 }}
                  R={{ y, h: EYE_H * 0.55 }} />
            <circle cx={LX} cy={y + 12} r={9} fill="var(--bg)" />
            <circle cx={RX} cy={y + 12} r={9} fill="var(--bg)" />
            {/* falling rain */}
            {Array.from({ length: 6 }).map((_, i) => {
              const seed = (i * 17) % 100 / 100;
              const p = ((t * 1.4) + seed) % 1;
              const x = (W / 2 - 60) + (i * 24) + Math.sin(seed * TAU) * 4;
              return (
                <line key={i}
                      x1={x} y1={STATUS_H + 16 + p * (H - STATUS_H - 40)}
                      x2={x - 2} y2={STATUS_H + 22 + p * (H - STATUS_H - 40)}
                      stroke="var(--accent)" strokeWidth={1.5}
                      opacity={(1 - p) * 0.65} />
              );
            })}
          </g>
        );
      } },
  ],
};

// =============================================================
// EMOTION: GRATEFUL — 2 variants
// =============================================================
cats.grateful = {
  label: 'Grateful',
  desc: 'Thankful / heartfelt.',
  kind: 'emotion',
  tone: 'rose',
  variants: [
    { id: 'grateful-bow', label: 'Deep bow', duration: 3200,
      render: (t) => {
        const phase = Math.sin(t * TAU - Math.PI / 2);
        const tilt = lerp(0, 22, (phase + 1) / 2);
        const dy = lerp(0, 14, (phase + 1) / 2);
        return (
          <g transform={`rotate(${tilt} ${W / 2} ${H + 60}) translate(0 ${dy})`}>
            <g fill="none" stroke="var(--eye)" strokeWidth={12}
               strokeLinecap="round">
              <path d={arcPath(LX, CY + 4, EYE_W - 4, 22, true)} />
              <path d={arcPath(RX, CY + 4, EYE_W - 4, 22, true)} />
            </g>
            {/* small heart between eyes */}
            <path d={heartPath(W / 2, CY - 6, 18)}
                  fill="var(--accent)" />
            {/* gentle mouth */}
            <path d={arcPath(W / 2, H - 32, 28, 5, true)}
                  fill="none" stroke="var(--eye)" strokeWidth={4}
                  strokeLinecap="round" opacity={0.7} />
          </g>
        );
      } },

    { id: 'grateful-sparkle', label: 'Heart sparkle', duration: 2400,
      render: (t) => (
        <g>
          {/* warm eyes */}
          <Eyes L={{ y: CY - 4, h: EYE_H * 0.8 }}
                R={{ y: CY - 4, h: EYE_H * 0.8 }} />
          {/* heart cheek pads */}
          <path d={heartPath(LX, CY + 34, 12)} fill="var(--accent)" opacity={0.85} />
          <path d={heartPath(RX, CY + 34, 12)} fill="var(--accent)" opacity={0.85} />
          {/* sparkles drifting up */}
          {[0, 1, 2, 3].map((i) => {
            const seed = i * 0.25;
            const p = ((t + seed) % 1);
            const baseX = 40 + i * 80;
            const x = baseX + Math.sin(p * TAU + i) * 6;
            const y = lerp(H - 30, STATUS_H + 12, p);
            const s = lerp(8, 2, p);
            return (
              <path key={i} d={starPath(x, y, s, s * 0.4)}
                    fill="var(--accent)" opacity={1 - p} />
            );
          })}
          {/* THX text */}
          <text x={W / 2} y={H - 14} textAnchor="middle"
                fontFamily="ui-monospace, Menlo, monospace"
                fontSize={10} fontWeight={700}
                fill="var(--eye)" letterSpacing={4} opacity={0.75}>
            THANK YOU
          </text>
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
  const newEmotionKeys = ['hot', 'lonely', 'grateful'];
  const keys = (window.EMOTION_CATEGORY_KEYS || Object.keys(cats))
                 .filter((k) => !newEmotionKeys.includes(k));
  let firstScene = keys.findIndex((k) => cats[k] && cats[k].kind === 'scene');
  if (firstScene === -1) firstScene = keys.length;
  keys.splice(firstScene, 0, ...newEmotionKeys.filter((k) => k in cats));
  window.EMOTION_CATEGORY_KEYS = keys;
})();
