// SPDX-License-Identifier: MIT
/* Emotion library — categories × variants.
   Depends on emotion-core.jsx (loaded first → window.EmotionCore).
   Exposes window.EMOTION_CATEGORIES (ordered map).
*/

const {
  W, H, STATUS_H, CY, GAP, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, wrap, ease, pulse, blink,
  Eye, Eyes, heartPath, starPath, arcPath,
} = window.EmotionCore;

// Convenience to render the two-eye baseline.
const baseEyes = (L = {}, R = {}) => <Eyes L={L} R={R} />;

// =============================================================
// NORMAL — 8 variants (the most-played idle state)
// `idle` mode in firmware = random picks from this category.
// =============================================================
const normal = {
  label: 'Normal',
  desc: 'Default state. Picked most often.',
  variants: [

    { id: 'normal-steady', label: 'Steady', duration: 5200,
      render: (t) => {
        const b = Math.max(blink(t, 0.32, 0.07), blink(t, 0.78, 0.07));
        const h = lerp(EYE_H, 4, b);
        return baseEyes({ h }, { h });
      } },

    { id: 'normal-breathe', label: 'Breathe', duration: 3800,
      render: (t) => {
        const s = 1 + Math.sin(t * TAU) * 0.05;
        const dy = Math.sin(t * TAU) * 3;
        const b = blink(t, 0.55, 0.07);
        const h = lerp(EYE_H * s, 4, b);
        return baseEyes(
          { y: CY + dy, w: EYE_W * s, h },
          { y: CY + dy, w: EYE_W * s, h },
        );
      } },

    { id: 'normal-look', label: 'Look around', duration: 4400,
      render: (t) => {
        const seq = [{x:0,y:0},{x:-8,y:0},{x:0,y:0},{x:8,y:0},{x:0,y:-4},{x:0,y:0}];
        const n = seq.length;
        const idx = clamp(Math.floor(t * n), 0, n - 1);
        const sub = t * n - idx;
        const cur = seq[idx], nxt = seq[(idx + 1) % n];
        const e = ease.inOut(sub);
        const dx = lerp(cur.x, nxt.x, e), dy = lerp(cur.y, nxt.y, e);
        return (
          <g>
            <Eyes />
            <circle cx={LX + dx} cy={CY + dy} r={11} fill="var(--bg)" />
            <circle cx={RX + dx} cy={CY + dy} r={11} fill="var(--bg)" />
          </g>
        );
      } },

    { id: 'normal-hum', label: 'Hum sway', duration: 3000,
      render: (t) => {
        const sway = Math.sin(t * TAU) * 4;
        const tilt = Math.sin(t * TAU) * 3;
        const b = blink(t, 0.85, 0.06);
        const h = lerp(EYE_H, 4, b);
        return baseEyes(
          { x: LX + sway, h, rot: tilt },
          { x: RX + sway, h, rot: tilt },
        );
      } },

    { id: 'normal-twitch', label: 'Micro twitch', duration: 4800,
      render: (t) => {
        const tw = (t > 0.62 && t < 0.66) ? 4 : 0;
        const b = blink(t, 0.4, 0.06);
        const h = lerp(EYE_H, 4, b);
        return baseEyes({ x: LX + tw, h }, { x: RX + tw, h });
      } },

    { id: 'normal-tilt', label: 'Curious tilt', duration: 3600,
      render: (t) => {
        const tilt = Math.sin(t * TAU) * 6;
        const dy = Math.cos(t * TAU) * -2;
        return (
          <g transform={`rotate(${tilt} ${W/2} ${CY})`}>
            <Eyes L={{ y: CY + dy }} R={{ y: CY + dy }} />
          </g>
        );
      } },

    { id: 'normal-double-blink', label: 'Double blink', duration: 4400,
      render: (t) => {
        const b = Math.max(blink(t, 0.42, 0.05), blink(t, 0.52, 0.05), blink(t, 0.88, 0.06));
        const h = lerp(EYE_H, 4, b);
        return baseEyes({ h }, { h });
      } },

    { id: 'normal-drift', label: 'Slow drift', duration: 6000,
      render: (t) => {
        const dx = Math.sin(t * TAU) * 5;
        const dy = Math.cos(t * TAU * 0.5) * 3;
        const b = blink(t, 0.3, 0.07);
        const h = lerp(EYE_H, 4, b);
        return baseEyes(
          { x: LX + dx, y: CY + dy, h },
          { x: RX + dx, y: CY + dy, h },
        );
      } },
  ],
};

// =============================================================
// HAPPY — 4 variants
// =============================================================
const happy = {
  label: 'Happy',
  desc: 'Positive ack.',
  variants: [

    { id: 'happy-arc', label: 'Smile arc', duration: 1800,
      render: (t) => {
        const bob = Math.sin(t * TAU * 2) * 3;
        const d = 22 + Math.sin(t * TAU) * 2;
        return (
          <g fill="none" stroke="var(--eye)" strokeWidth={14} strokeLinecap="round">
            <path d={arcPath(LX, CY + 10 + bob, EYE_W - 10, d, true)} />
            <path d={arcPath(RX, CY + 10 + bob, EYE_W - 10, d, true)} />
          </g>
        );
      } },

    { id: 'happy-bouncy', label: 'Bouncy', duration: 1200,
      render: (t) => {
        const bounce = Math.abs(Math.sin(t * TAU * 2)) * 10;
        const sq = 1 + Math.sin(t * TAU * 2) * 0.06;
        return baseEyes(
          { y: CY - bounce, w: EYE_W / sq, h: EYE_H * sq, rx: 32 },
          { y: CY - bounce, w: EYE_W / sq, h: EYE_H * sq, rx: 32 },
        );
      } },

    { id: 'happy-closed', label: 'Closed smile', duration: 2400,
      render: (t) => {
        const wob = Math.sin(t * TAU) * 1.5;
        return (
          <g fill="none" stroke="var(--eye)" strokeWidth={12} strokeLinecap="round">
            <path d={arcPath(LX, CY + 4 + wob, EYE_W - 4, 26, true)} />
            <path d={arcPath(RX, CY + 4 + wob, EYE_W - 4, 26, true)} />
            {/* tiny mouth */}
            <path d={arcPath(W / 2, H - 36, 40, 8, true)}
                  strokeWidth={5} opacity={0.7} />
          </g>
        );
      } },

    { id: 'happy-cheek', label: 'Cheek up', duration: 2000,
      render: (t) => {
        const sq = 1 + Math.sin(t * TAU * 2) * 0.04;
        const h = EYE_H * 0.55 * sq;
        return (
          <g>
            <Eyes L={{ h, y: CY - 6 }} R={{ h, y: CY - 6 }} />
            {/* cheek triangles */}
            <g fill="var(--accent)" opacity={0.8}>
              <circle cx={LX} cy={CY + 36} r={6} />
              <circle cx={RX} cy={CY + 36} r={6} />
            </g>
          </g>
        );
      } },
  ],
};

// =============================================================
// SAD — 4 variants
// =============================================================
function sadLids(eyeCx, eyeY, slantPx) {
  // slantPx > 0 → outer lid is lower (sad slant), bg-colored polygon
  return (
    <polygon
      points={`
        ${eyeCx - EYE_W/2 - 4},${eyeY - EYE_H/2 - 4}
        ${eyeCx + EYE_W/2 + 4},${eyeY - EYE_H/2 - 4}
        ${eyeCx + EYE_W/2 + 4},${eyeY - 6}
        ${eyeCx - EYE_W/2 - 4},${eyeY - 6 + slantPx}
      `}
      fill="var(--bg)"
    />
  );
}

const sad = {
  label: 'Sad',
  desc: 'Negative outcome / empathy.',
  variants: [

    { id: 'sad-droop', label: 'Droop', duration: 3200,
      render: (t) => {
        const droop = 4 + Math.sin(t * TAU * 0.5) * 2;
        const y = CY + droop;
        return (
          <g>
            <Eyes L={{ y, h: EYE_H * 0.78 }} R={{ y, h: EYE_H * 0.78 }} />
            {sadLids(LX, y, 30)}
            <g transform={`scale(-1 1) translate(${-W} 0)`}>{sadLids(W - RX, y, 30)}</g>
            {/* downturned mouth */}
            <path d={arcPath(W / 2, H - 32, 36, 6)} fill="none" stroke="var(--eye)"
                  strokeWidth={4} strokeLinecap="round" opacity={0.7} />
          </g>
        );
      } },

    { id: 'sad-look-down', label: 'Looking down', duration: 3400,
      render: (t) => {
        const y = CY + 8 + Math.sin(t * TAU * 0.5) * 1;
        return (
          <g>
            <Eyes L={{ y, h: EYE_H * 0.7 }} R={{ y, h: EYE_H * 0.7 }} />
            {sadLids(LX, y, 24)}
            <g transform={`scale(-1 1) translate(${-W} 0)`}>{sadLids(W - RX, y, 24)}</g>
            <circle cx={LX} cy={y + 12} r={8} fill="var(--bg)" />
            <circle cx={RX} cy={y + 12} r={8} fill="var(--bg)" />
          </g>
        );
      } },

    { id: 'sad-big-droopy', label: 'Big droopy', duration: 4000,
      render: (t) => {
        const droop = 6 + Math.sin(t * TAU * 0.4) * 3;
        const y = CY + droop;
        return (
          <g>
            <Eyes L={{ y, w: EYE_W * 1.05, h: EYE_H * 0.9 }}
                  R={{ y, w: EYE_W * 1.05, h: EYE_H * 0.9 }} />
            {sadLids(LX, y, 42)}
            <g transform={`scale(-1 1) translate(${-W} 0)`}>{sadLids(W - RX, y, 42)}</g>
            {/* highlight glint */}
            <circle cx={LX - 16} cy={y + 6} r={6} fill="var(--bg)" />
            <circle cx={RX - 16} cy={y + 6} r={6} fill="var(--bg)" />
          </g>
        );
      } },

    { id: 'sad-quiver', label: 'Quiver', duration: 1600,
      render: (t) => {
        const q = Math.sin(t * TAU * 6) * 1.5;
        const y = CY + 4;
        return (
          <g>
            <Eyes L={{ y: y + q, h: EYE_H * 0.75 }} R={{ y: y - q, h: EYE_H * 0.75 }} />
            {sadLids(LX, y + q, 28)}
            <g transform={`scale(-1 1) translate(${-W} 0)`}>{sadLids(W - RX, y - q, 28)}</g>
            {/* trembling lower lip */}
            <path d={`M ${W/2 - 22} ${H - 30} Q ${W/2 - 8} ${H - 30 + q*2}, ${W/2} ${H - 30}
                      T ${W/2 + 22} ${H - 30}`}
                  fill="none" stroke="var(--eye)" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
          </g>
        );
      } },
  ],
};

// =============================================================
// ANGRY — 3 variants
// =============================================================
function angryBrows(t) {
  // Two angled bars (V shape pointing down-center).
  const sh = Math.sin(t * TAU * 6) * 1;
  return (
    <g stroke="var(--eye)" strokeWidth={10} strokeLinecap="round">
      <line x1={LX - 38} y1={CY - 50 + sh} x2={LX + 32} y2={CY - 28} />
      <line x1={RX + 38} y1={CY - 50 - sh} x2={RX - 32} y2={CY - 28} />
    </g>
  );
}

const angry = {
  label: 'Angry',
  desc: 'Frustration / boundary.',
  variants: [

    { id: 'angry-glare', label: 'Glare', duration: 1800,
      render: (t) => {
        const sh = Math.sin(t * TAU * 4) * 0.8;
        return (
          <g>
            <Eyes L={{ x: LX + sh, h: EYE_H * 0.55, rx: 12 }}
                  R={{ x: RX - sh, h: EYE_H * 0.55, rx: 12 }} />
            {angryBrows(t)}
          </g>
        );
      } },

    { id: 'angry-steam', label: 'Steam', duration: 2200,
      render: (t) => (
        <g>
          <Eyes L={{ h: EYE_H * 0.5, rx: 10 }} R={{ h: EYE_H * 0.5, rx: 10 }} />
          {angryBrows(t)}
          {[0, 1, 2].map((i) => {
            const p = (t * 1.5 + i * 0.33) % 1;
            const x = (i % 2 === 0 ? 28 : W - 28) + (i === 1 ? Math.sin(p * TAU) * 6 : 0);
            const y = CY - 30 - p * 60;
            return (
              <circle key={i} cx={x} cy={y} r={4 + p * 4}
                      fill="var(--accent)" opacity={(1 - p) * 0.7} />
            );
          })}
        </g>
      ) },

    { id: 'angry-shake', label: 'Furious shake', duration: 700,
      render: (t) => {
        const sh = Math.sin(t * TAU * 8) * 4;
        return (
          <g transform={`translate(${sh} ${Math.cos(t * TAU * 8) * 2})`}>
            <Eyes L={{ h: EYE_H * 0.55, rx: 14 }} R={{ h: EYE_H * 0.55, rx: 14 }} />
            {angryBrows(t * 4)}
          </g>
        );
      } },
  ],
};

// =============================================================
// SURPRISED — 2 variants
// =============================================================
const surprised = {
  label: 'Surprised',
  desc: 'Sudden new info.',
  variants: [

    { id: 'surprised-pop', label: 'Pop', duration: 2200,
      render: (t) => {
        let s;
        if (t < 0.12) s = ease.out(t / 0.12) * 1.35;
        else if (t < 0.7) s = 1.35 - Math.sin((t - 0.12) * TAU * 1.5) * 0.04;
        else s = lerp(1.35, 1, ease.inOut((t - 0.7) / 0.3));
        const r = (EYE_W / 2) * s;
        return (
          <g>
            <circle cx={LX} cy={CY} r={r} fill="var(--eye)" />
            <circle cx={RX} cy={CY} r={r} fill="var(--eye)" />
            {/* tiny mouth O */}
            <circle cx={W / 2} cy={H - 32} r={6 + s * 2} fill="none"
                    stroke="var(--eye)" strokeWidth={4} />
          </g>
        );
      } },

    { id: 'surprised-exclaim', label: 'Exclaim', duration: 2400,
      render: (t) => {
        const s = t < 0.15 ? ease.out(t / 0.15) : 1;
        const r = (EYE_W / 2) * 1.1 * s;
        return (
          <g>
            <circle cx={LX} cy={CY} r={r} fill="var(--eye)" />
            <circle cx={RX} cy={CY} r={r} fill="var(--eye)" />
            <circle cx={LX - 8} cy={CY - 14} r={5} fill="var(--bg)" />
            <circle cx={RX - 8} cy={CY - 14} r={5} fill="var(--bg)" />
            {t > 0.1 && t < 0.55 && (
              <g opacity={1 - Math.abs((t - 0.32) / 0.25)}>
                <rect x={W/2 - 4} y={H - 60} width={8} height={22} rx={2} fill="var(--accent)" />
                <circle cx={W/2} cy={H - 26} r={4} fill="var(--accent)" />
              </g>
            )}
          </g>
        );
      } },
  ],
};

// =============================================================
// LOVE — 3 variants
// =============================================================
const love = {
  label: 'Love',
  desc: 'Affection / praise.',
  variants: [

    { id: 'love-hearts', label: 'Heart eyes', duration: 1600,
      render: (t) => {
        const s = (1 + Math.sin(t * TAU * 2) * 0.1) * EYE_W * 0.95;
        return (
          <g>
            <path d={heartPath(LX, CY, s)} fill="var(--eye)" />
            <path d={heartPath(RX, CY, s)} fill="var(--eye)" />
          </g>
        );
      } },

    { id: 'love-floating', label: 'Floating hearts', duration: 2400,
      render: (t) => (
        <g>
          <Eyes L={{ h: EYE_H * 0.85 }} R={{ h: EYE_H * 0.85 }} />
          {[0, 1, 2, 3].map((i) => {
            const p = ((t + i * 0.25) % 1);
            const x = 40 + i * 80 + Math.sin(p * TAU + i) * 8;
            const y = lerp(H - 30, STATUS_H + 6, p);
            return (
              <path key={i} d={heartPath(x, y, 14 + (1 - p) * 4)}
                    fill="var(--accent)" opacity={1 - p} />
            );
          })}
        </g>
      ) },

    { id: 'love-wink', label: 'Heart wink', duration: 2400,
      render: (t) => {
        const sz = EYE_W * 0.9;
        const close = pulse(t, 0.5, 0.2);
        return (
          <g>
            <path d={heartPath(LX, CY, sz)} fill="var(--eye)" />
            {close > 0.5 ? (
              <path d={arcPath(RX, CY + 6, EYE_W - 6, 18, true)}
                    fill="none" stroke="var(--eye)" strokeWidth={12} strokeLinecap="round" />
            ) : (
              <path d={heartPath(RX, CY, sz * (1 - close * 0.3))} fill="var(--eye)" />
            )}
          </g>
        );
      } },
  ],
};

// =============================================================
// SLEEPY — 2 variants
// =============================================================
const sleepy = {
  label: 'Sleepy',
  desc: 'Low-power / late hours.',
  variants: [

    { id: 'sleepy-heavy', label: 'Heavy lids', duration: 4000,
      render: (t) => {
        const droop = Math.sin(t * TAU * 0.6) * 4;
        const h = 18 + droop;
        return baseEyes({ y: CY + 28, h: Math.max(h, 8), rx: 12 },
                        { y: CY + 28, h: Math.max(h, 8), rx: 12 });
      } },

    { id: 'sleepy-yawn', label: 'Yawn', duration: 2800,
      render: (t) => {
        const yawn = pulse(t, 0.55, 0.18);
        const lidH = lerp(24, 8, yawn);
        return (
          <g>
            <Eyes L={{ y: CY + 22, h: lidH, rx: 10 }}
                  R={{ y: CY + 22, h: lidH, rx: 10 }} />
            {yawn > 0.03 && (
              <ellipse cx={W / 2} cy={H - 36} rx={8 + yawn * 4} ry={6 + yawn * 12}
                       fill="none" stroke="var(--eye)" strokeWidth={4} />
            )}
          </g>
        );
      } },
  ],
};

// =============================================================
// SLEEPING — 2 variants
// =============================================================
const sleeping = {
  label: 'Sleeping',
  desc: 'Deep idle / standby.',
  variants: [

    { id: 'sleeping-zzz', label: 'Zzz drift', duration: 3200,
      render: (t) => (
        <g>
          <g fill="none" stroke="var(--eye)" strokeWidth={10} strokeLinecap="round">
            <path d={arcPath(LX, CY + 14, EYE_W, 14)} />
            <path d={arcPath(RX, CY + 14, EYE_W, 14)} />
          </g>
          {[0, 1, 2].map((i) => {
            const p = (t + i * 0.33) % 1;
            const size = lerp(10, 26, p);
            const x = RX + 22 + i * 6 + p * 24;
            const y = CY - 24 - p * 36;
            return (
              <text key={i} x={x} y={y} fontSize={size} fontFamily="ui-monospace, Menlo, monospace"
                    fontWeight="700" fill="var(--accent)" opacity={1 - p}>z</text>
            );
          })}
        </g>
      ) },

    { id: 'sleeping-calm', label: 'Calm', duration: 4400,
      render: (t) => {
        const breathe = Math.sin(t * TAU) * 1.5;
        return (
          <g fill="none" stroke="var(--eye)" strokeWidth={9} strokeLinecap="round">
            <path d={arcPath(LX, CY + 16 + breathe, EYE_W - 6, 12)} />
            <path d={arcPath(RX, CY + 16 + breathe, EYE_W - 6, 12)} />
          </g>
        );
      } },
  ],
};

// =============================================================
// CRYING — 2 variants
// =============================================================
const crying = {
  label: 'Crying',
  desc: 'Strong sad.',
  variants: [

    { id: 'crying-tears', label: 'Tears', duration: 2400,
      render: (t) => (
        <g>
          <g fill="none" stroke="var(--eye)" strokeWidth={12} strokeLinecap="round">
            <path d={arcPath(LX, CY + 12, EYE_W, 22)} />
            <path d={arcPath(RX, CY + 12, EYE_W, 22)} />
          </g>
          {[0, 1].map((side) => {
            const x = side === 0 ? LX - 32 : RX + 32;
            return [0, 1].map((i) => {
              const p = ((t * 1.5) + i * 0.5 + side * 0.25) % 1;
              const yPos = CY + 26 + p * 80;
              const len = lerp(6, 16, Math.sin(p * Math.PI));
              return (
                <ellipse key={`${side}-${i}`} cx={x} cy={yPos}
                         rx={5} ry={len} fill="var(--accent)" opacity={1 - p * 0.5} />
              );
            });
          })}
        </g>
      ) },

    { id: 'crying-waterfall', label: 'Waterfall', duration: 1600,
      render: (t) => (
        <g>
          <g fill="none" stroke="var(--eye)" strokeWidth={10} strokeLinecap="round">
            <path d={arcPath(LX, CY, EYE_W, 26)} />
            <path d={arcPath(RX, CY, EYE_W, 26)} />
          </g>
          {/* heavy multi-stream tears across full bottom */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const x = LX - 20 + i * 32;
            const p = ((t * 2) + i * 0.18) % 1;
            return (
              <rect key={i} x={x - 2.5} y={CY + 14 + p * 70} width={5} height={lerp(8, 18, p)}
                    rx={2.5} fill="var(--accent)" opacity={1 - p * 0.6} />
            );
          })}
        </g>
      ) },
  ],
};

// =============================================================
// EXCITED — 3 variants
// =============================================================
const excited = {
  label: 'Excited',
  desc: 'High-positive event.',
  variants: [

    { id: 'excited-stars', label: 'Star eyes', duration: 1200,
      render: (t) => {
        const bob = Math.abs(Math.sin(t * TAU * 2)) * 8;
        const scl = 1 + Math.sin(t * TAU * 4) * 0.08;
        return (
          <g>
            <path d={starPath(LX, CY - bob, (EYE_W / 2) * scl, (EYE_W / 4) * scl)} fill="var(--eye)" />
            <path d={starPath(RX, CY - bob, (EYE_W / 2) * scl, (EYE_W / 4) * scl)} fill="var(--eye)" />
            {[0, 1, 2, 3].map((i) => {
              const p = ((t * 2) + i * 0.25) % 1;
              const a = i * (TAU / 4) + t * TAU;
              const r = 80 + p * 40;
              const x = W / 2 + Math.cos(a) * r;
              const y = CY + Math.sin(a) * r * 0.55;
              const s = lerp(10, 2, p);
              return <path key={i} d={starPath(x, y, s, s * 0.4)} fill="var(--accent)" opacity={1 - p} />;
            })}
          </g>
        );
      } },

    { id: 'excited-bounce', label: 'Bounce', duration: 800,
      render: (t) => {
        const b = Math.abs(Math.sin(t * TAU * 2));
        const dy = -14 * b;
        const sq = 1 - b * 0.15;
        return baseEyes(
          { y: CY + dy, w: EYE_W / sq, h: EYE_H * sq, rx: 30 },
          { y: CY + dy, w: EYE_W / sq, h: EYE_H * sq, rx: 30 },
        );
      } },

    { id: 'excited-grin', label: 'Wide grin', duration: 1600,
      render: (t) => {
        const wob = Math.sin(t * TAU * 3) * 2;
        return (
          <g>
            <Eyes L={{ w: EYE_W * 1.1, h: EYE_H * 1.05, y: CY - 6 + wob }}
                  R={{ w: EYE_W * 1.1, h: EYE_H * 1.05, y: CY - 6 + wob }} />
            {/* wide smile arc */}
            <path d={arcPath(W / 2, H - 36, 120, 16, true)}
                  fill="none" stroke="var(--eye)" strokeWidth={6} strokeLinecap="round" />
          </g>
        );
      } },
  ],
};

// =============================================================
// CONFUSED — 2 variants
// =============================================================
const confused = {
  label: 'Confused',
  desc: 'Did not understand.',
  variants: [

    { id: 'confused-qmark', label: 'Question mark', duration: 2600,
      render: (t) => {
        const swap = Math.sin(t * TAU) > 0;
        const lW = swap ? EYE_W * 0.7 : EYE_W * 1.05;
        const lH = swap ? EYE_H * 0.7 : EYE_H * 1.05;
        const rW = swap ? EYE_W * 1.05 : EYE_W * 0.7;
        const rH = swap ? EYE_H * 1.05 : EYE_H * 0.7;
        return (
          <g>
            <Eyes L={{ w: lW, h: lH }} R={{ w: rW, h: rH }} />
            <g transform={`translate(${W / 2 + 56}, ${STATUS_H + 18}) rotate(${Math.sin(t * TAU) * 14})`}>
              <path d="M -10 -6 Q -10 -18 0 -18 Q 10 -18 10 -8 Q 10 0 0 6 L 0 10"
                    fill="none" stroke="var(--accent)" strokeWidth={5} strokeLinecap="round" />
              <circle cx={0} cy={20} r={4} fill="var(--accent)" />
            </g>
          </g>
        );
      } },

    { id: 'confused-tilt', label: 'Head tilt', duration: 3000,
      render: (t) => {
        const tilt = Math.sin(t * TAU) * 12;
        const sq = 0.75;
        return (
          <g transform={`rotate(${tilt} ${W / 2} ${CY})`}>
            <Eyes L={{ h: EYE_H * sq }} R={{ h: EYE_H * sq }} />
            <path d={arcPath(W / 2, H - 34, 30, 3, true)}
                  fill="none" stroke="var(--eye)" strokeWidth={4} strokeLinecap="round" opacity={0.7} />
          </g>
        );
      } },
  ],
};

// =============================================================
// BORED — 2 variants
// =============================================================
const bored = {
  label: 'Bored',
  desc: 'No interaction for a while.',
  variants: [

    { id: 'bored-half', label: 'Half lids', duration: 4200,
      render: (t) => {
        const look = Math.sin(t * TAU) * 10;
        return (
          <g>
            <Eyes L={{ x: LX + look, h: EYE_H * 0.35, y: CY + 14, rx: 14 }}
                  R={{ x: RX + look, h: EYE_H * 0.35, y: CY + 14, rx: 14 }} />
            <rect x={W / 2 - 20} y={H - 30} width={40} height={4} rx={2} fill="var(--eye)" opacity={0.6} />
          </g>
        );
      } },

    { id: 'bored-sideways', label: 'Sideways stare', duration: 3800,
      render: (t) => {
        const phase = Math.sin(t * TAU) > 0 ? 1 : -1;
        const slide = phase * 18;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.6 }} R={{ h: EYE_H * 0.6 }} />
            <circle cx={LX + slide} cy={CY} r={14} fill="var(--bg)" />
            <circle cx={RX + slide} cy={CY} r={14} fill="var(--bg)" />
          </g>
        );
      } },
  ],
};

// =============================================================
// LISTENING — 4 variants (REQUIRED, conversational state)
// =============================================================
const listening = {
  label: 'Listening',
  desc: 'Receiving voice input from user.',
  variants: [

    { id: 'listening-attentive', label: 'Attentive', duration: 2200,
      render: (t) => {
        // Wide, very still eyes with a subtle pupil that breathes.
        const pulseR = 12 + Math.sin(t * TAU * 2) * 1.5;
        return (
          <g>
            <Eyes L={{ w: EYE_W * 1.05, h: EYE_H * 1.05 }}
                  R={{ w: EYE_W * 1.05, h: EYE_H * 1.05 }} />
            <circle cx={LX} cy={CY} r={pulseR} fill="var(--bg)" />
            <circle cx={RX} cy={CY} r={pulseR} fill="var(--bg)" />
            {/* subtle ring on right side hinting at audio */}
            <g stroke="var(--accent)" strokeWidth={2} fill="none" opacity={0.6}>
              <circle cx={W - 24} cy={H - 40} r={6 + Math.sin(t * TAU * 2) * 3} />
            </g>
          </g>
        );
      } },

    { id: 'listening-waves', label: 'Sound waves', duration: 1600,
      render: (t) => {
        // Standard eyes + audio bars at the bottom of the screen.
        const bars = 9;
        const cx0 = W / 2 - ((bars - 1) * 14) / 2;
        return (
          <g>
            <Eyes L={{ y: CY - 18, h: EYE_H * 0.85 }} R={{ y: CY - 18, h: EYE_H * 0.85 }} />
            {Array.from({ length: bars }).map((_, i) => {
              const phase = (t * TAU * 2) + i * 0.6;
              const h = 6 + Math.abs(Math.sin(phase)) * 22;
              return (
                <rect key={i} x={cx0 + i * 14 - 4} y={H - 22 - h / 2}
                      width={8} height={h} rx={3} fill="var(--accent)" />
              );
            })}
          </g>
        );
      } },

    { id: 'listening-eq', label: 'EQ pulse', duration: 1400,
      render: (t) => {
        // Eyes themselves pulse with audio envelope; floating concentric arcs from sides.
        const env = 0.5 + 0.5 * Math.abs(Math.sin(t * TAU * 3));
        const h = EYE_H * (0.7 + 0.25 * env);
        return (
          <g>
            <Eyes L={{ h }} R={{ h }} />
            {/* Left side incoming arcs */}
            {[0, 1, 2].map((i) => {
              const p = ((t * 2) + i * 0.3) % 1;
              const x = 18 + p * 12;
              const op = 1 - p;
              return (
                <g key={`l${i}`} stroke="var(--accent)" strokeWidth={3}
                   fill="none" opacity={op} strokeLinecap="round">
                  <path d={`M ${x} ${CY - 16} Q ${x - 6} ${CY}, ${x} ${CY + 16}`} />
                </g>
              );
            })}
            {/* Right side */}
            {[0, 1, 2].map((i) => {
              const p = ((t * 2) + i * 0.3) % 1;
              const x = W - 18 - p * 12;
              const op = 1 - p;
              return (
                <g key={`r${i}`} stroke="var(--accent)" strokeWidth={3}
                   fill="none" opacity={op} strokeLinecap="round">
                  <path d={`M ${x} ${CY - 16} Q ${x + 6} ${CY}, ${x} ${CY + 16}`} />
                </g>
              );
            })}
          </g>
        );
      } },

    { id: 'listening-cup', label: 'Cupped ear', duration: 2600,
      render: (t) => {
        // Eyes drift slightly to one side as if leaning in to listen.
        const lean = Math.sin(t * TAU * 0.6) * 8;
        return (
          <g>
            <Eyes L={{ x: LX + lean, h: EYE_H * 0.9 }}
                  R={{ x: RX + lean, h: EYE_H * 0.9 }} />
            {/* Rotating ((( marks on right side */}
            {[0, 1, 2].map((i) => {
              const p = ((t * 1.2) + i * 0.33) % 1;
              const x = W - 12 - p * 14;
              return (
                <g key={i} stroke="var(--accent)" strokeWidth={3}
                   fill="none" opacity={1 - p}>
                  <path d={`M ${x} ${CY - 14} Q ${x + 5} ${CY}, ${x} ${CY + 14}`}
                        strokeLinecap="round" />
                </g>
              );
            })}
          </g>
        );
      } },
  ],
};

// =============================================================
// THINKING — 4 variants (REQUIRED, conversational state)
// =============================================================
const thinking = {
  label: 'Thinking',
  desc: 'Generating response / processing.',
  variants: [

    { id: 'thinking-look-up', label: 'Look up', duration: 2800,
      render: (t) => {
        // Eyes glance up-left as if recalling; three dots in corner pulse.
        const phase = Math.sin(t * TAU * 0.5);
        const dx = -10 + phase * 6;
        const dy = -16;
        return (
          <g>
            <Eyes L={{ w: EYE_W, h: EYE_H }} R={{ w: EYE_W, h: EYE_H }} />
            <circle cx={LX + dx} cy={CY + dy} r={12} fill="var(--bg)" />
            <circle cx={RX + dx} cy={CY + dy} r={12} fill="var(--bg)" />
            {/* dots over the head */}
            {[0, 1, 2].map((i) => {
              const p = ((t * 2) + i * 0.2) % 1;
              const op = p < 0.5 ? p * 2 : (1 - p) * 2;
              return (
                <circle key={i} cx={LX + 10 + i * 14} cy={STATUS_H + 12}
                        r={3.5} fill="var(--accent)" opacity={clamp(op, 0.25, 1)} />
              );
            })}
          </g>
        );
      } },

    { id: 'thinking-spinner', label: 'Spinner', duration: 1200,
      render: (t) => {
        const ang = t * 360;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.8 }} R={{ h: EYE_H * 0.8 }} />
            {/* corner spinner */}
            <g transform={`translate(${W - 30} ${H - 30}) rotate(${ang})`}>
              <path d="M -10 0 A 10 10 0 0 1 10 0" stroke="var(--accent)"
                    strokeWidth={4} fill="none" strokeLinecap="round" />
            </g>
          </g>
        );
      } },

    { id: 'thinking-scanning', label: 'Scanning', duration: 2400,
      render: (t) => {
        // Eyes scan L → R as if reading.
        const phase = Math.sin(t * TAU - Math.PI / 2);
        const dx = phase * 14;
        return (
          <g>
            <Eyes />
            <circle cx={LX + dx} cy={CY} r={11} fill="var(--bg)" />
            <circle cx={RX + dx} cy={CY} r={11} fill="var(--bg)" />
            {/* scan line */}
            <line x1={20} y1={H - 14} x2={W - 20} y2={H - 14}
                  stroke="var(--accent)" strokeWidth={1} opacity={0.25} />
            <circle cx={lerp(20, W - 20, (Math.sin(t * TAU - Math.PI / 2) + 1) / 2)} cy={H - 14}
                    r={3} fill="var(--accent)" />
          </g>
        );
      } },

    { id: 'thinking-dots', label: 'Dots above', duration: 1500,
      render: (t) => (
        <g>
          <Eyes L={{ h: EYE_H * 0.7, y: CY + 10 }}
                R={{ h: EYE_H * 0.7, y: CY + 10 }} />
          {[0, 1, 2].map((i) => {
            const phase = (t - i * 0.15 + 1) % 1;
            const r = phase < 0.4 ? 3 + (phase / 0.4) * 5 : 8 - (phase - 0.4) * 8;
            const op = phase < 0.6 ? 1 : 1 - (phase - 0.6) * 2;
            return (
              <circle key={i} cx={W / 2 - 22 + i * 22} cy={CY - 50}
                      r={clamp(r, 2.5, 8)} fill="var(--accent)"
                      opacity={clamp(op, 0.3, 1)} />
            );
          })}
        </g>
      ) },
  ],
};

// =============================================================
// LOADING — 3 variants
// =============================================================
const loading = {
  label: 'Loading',
  desc: 'Background task.',
  variants: [

    { id: 'loading-dots', label: 'Three dots', duration: 1200,
      render: (t) => (
        <g>
          {[0, 1, 2].map((i) => {
            const p = (t - i * 0.15 + 1) % 1;
            const op = p < 0.4 ? 0.3 + (p / 0.4) * 0.7 : 1 - (p - 0.4) * 0.8;
            const r = 14 + Math.max(0, op - 0.3) * 6;
            return (
              <circle key={i} cx={W / 2 - 56 + i * 56} cy={CY}
                      r={r} fill="var(--accent)" opacity={clamp(op, 0.3, 1)} />
            );
          })}
        </g>
      ) },

    { id: 'loading-bar', label: 'Progress bar', duration: 2400,
      render: (t) => (
        <g>
          <Eyes L={{ h: EYE_H * 0.55 }} R={{ h: EYE_H * 0.55 }} />
          <rect x={40} y={H - 28} width={W - 80} height={8} rx={4}
                fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.5} />
          <rect x={42} y={H - 26} width={(W - 84) * t} height={4} rx={2} fill="var(--accent)" />
        </g>
      ) },

    { id: 'loading-spinner-big', label: 'Big spinner', duration: 1000,
      render: (t) => {
        const ang = t * 360;
        return (
          <g transform={`translate(${W / 2} ${CY}) rotate(${ang})`}>
            <path d="M -38 0 A 38 38 0 0 1 26 -28" stroke="var(--accent)"
                  strokeWidth={8} fill="none" strokeLinecap="round" />
            <circle cx={38} cy={0} r={6} fill="var(--accent)" />
          </g>
        );
      } },
  ],
};

// =============================================================
// DIZZY — 2 variants
// =============================================================
const dizzy = {
  label: 'Dizzy',
  desc: 'Error / overload.',
  variants: [

    { id: 'dizzy-spirals', label: 'Spiral eyes', duration: 1600,
      render: (t) => {
        const rot = t * 360 * 2;
        function spiral(cx, cy) {
          const pts = [];
          const turns = 2.4, steps = 60;
          for (let i = 0; i <= steps; i++) {
            const a = (i / steps) * turns * TAU;
            const r = (i / steps) * 32;
            pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
          }
          return pts.join(' ');
        }
        return (
          <g>
            <g transform={`rotate(${rot} ${LX} ${CY})`}>
              <polyline points={spiral(LX, CY)} fill="none" stroke="var(--eye)"
                        strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <g transform={`rotate(${-rot} ${RX} ${CY})`}>
              <polyline points={spiral(RX, CY)} fill="none" stroke="var(--eye)"
                        strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        );
      } },

    { id: 'dizzy-wobble', label: 'Wobble', duration: 1200,
      render: (t) => {
        const wob = Math.sin(t * TAU * 3) * 6;
        const tilt = Math.sin(t * TAU * 3 + 0.5) * 18;
        return (
          <g>
            <Eyes L={{ x: LX + wob, rot: tilt, h: EYE_H * 0.7 }}
                  R={{ x: RX - wob, rot: -tilt, h: EYE_H * 0.7 }} />
            {/* asterisk-like sparkle near top */}
            <g stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" opacity={0.7}>
              <line x1={30} y1={STATUS_H + 18} x2={30} y2={STATUS_H + 30} />
              <line x1={24} y1={STATUS_H + 24} x2={36} y2={STATUS_H + 24} />
            </g>
          </g>
        );
      } },
  ],
};

// =============================================================
// DEAD — 2 variants
// =============================================================
const dead = {
  label: 'Dead',
  desc: 'Critical failure.',
  variants: [

    { id: 'dead-x', label: 'X eyes', duration: 2800,
      render: (t) => {
        const flick = t > 0.92 ? 0.3 : 1;
        const sz = 28;
        const X = ({ cx, cy }) => (
          <g stroke="var(--eye)" strokeWidth={10} strokeLinecap="round" opacity={flick}>
            <line x1={cx - sz} y1={cy - sz} x2={cx + sz} y2={cy + sz} />
            <line x1={cx + sz} y1={cy - sz} x2={cx - sz} y2={cy + sz} />
          </g>
        );
        return (
          <g>
            <X cx={LX} cy={CY} />
            <X cx={RX} cy={CY} />
            <path d={arcPath(W / 2, H - 32, 60, 8, true)}
                  fill="none" stroke="var(--eye)" strokeWidth={5}
                  strokeLinecap="round" opacity={flick} />
          </g>
        );
      } },

    { id: 'dead-fade', label: 'Fade', duration: 3600,
      render: (t) => {
        // Static X with slow fade-blink.
        const op = 0.4 + Math.abs(Math.sin(t * TAU * 0.5)) * 0.6;
        const sz = 24;
        const X = ({ cx, cy }) => (
          <g stroke="var(--eye)" strokeWidth={8} strokeLinecap="round" opacity={op}>
            <line x1={cx - sz} y1={cy - sz} x2={cx + sz} y2={cy + sz} />
            <line x1={cx + sz} y1={cy - sz} x2={cx - sz} y2={cy + sz} />
          </g>
        );
        return (
          <g>
            <X cx={LX} cy={CY} />
            <X cx={RX} cy={CY} />
          </g>
        );
      } },
  ],
};

// =============================================================
// EXPORT — ordered map (insertion order = display order)
// =============================================================
const EMOTION_CATEGORIES = {
  normal, happy, sad, angry, surprised, love, sleepy, sleeping,
  crying, excited, confused, bored,
  listening, thinking,
  loading, dizzy, dead,
};

window.EMOTION_CATEGORIES = EMOTION_CATEGORIES;
window.EMOTION_CATEGORY_KEYS = Object.keys(EMOTION_CATEGORIES);
