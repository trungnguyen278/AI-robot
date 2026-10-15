// SPDX-License-Identifier: MIT
/* Emotion library — EXTRAS
   Adds extra variants to base categories + new categories.
   Loaded AFTER emotion-list.jsx. Mutates window.EMOTION_CATEGORIES in place,
   then refreshes window.EMOTION_CATEGORY_KEYS.
*/

const {
  W, H, STATUS_H, CY, GAP, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, wrap, ease, pulse, blink,
  Eye, Eyes, heartPath, starPath, arcPath,
} = window.EmotionCore;

const cats = window.EMOTION_CATEGORIES;

// ---------- local helpers ----------
const baseEyes = (L = {}, R = {}) => <Eyes L={L} R={R} />;

function sadLid(eyeCx, eyeY, slantPx) {
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
function sadLidMirrored(eyeCx, eyeY, slantPx) {
  return (
    <g transform={`scale(-1 1) translate(${-W} 0)`}>
      {sadLid(W - eyeCx, eyeY, slantPx)}
    </g>
  );
}

// =============================================================
// NORMAL — add 8 more (8 → 16)
// =============================================================
cats.normal.variants.push(

  { id: 'normal-search', label: 'Search scan', duration: 4800,
    render: (t) => {
      const seq = [{x:0,y:0},{x:-14,y:-2},{x:14,y:-2},{x:0,y:0},{x:-8,y:6},{x:8,y:6},{x:0,y:0}];
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

  { id: 'normal-look-up', label: 'Look up', duration: 4200,
    render: (t) => {
      const phase = Math.sin(t * TAU - Math.PI / 2);
      const dy = phase < 0 ? phase * 22 : 0;
      const b = blink(t, 0.9, 0.06);
      const h = lerp(EYE_H, 4, b);
      return (
        <g>
          <Eyes L={{ h }} R={{ h }} />
          {h > 30 && (
            <g>
              <circle cx={LX} cy={CY + dy} r={11} fill="var(--bg)" />
              <circle cx={RX} cy={CY + dy} r={11} fill="var(--bg)" />
            </g>
          )}
        </g>
      );
    } },

  { id: 'normal-tired-blink', label: 'Tired blink', duration: 3800,
    render: (t) => {
      const b = Math.max(blink(t, 0.18, 0.09), blink(t, 0.5, 0.09), blink(t, 0.82, 0.09));
      const h = lerp(EYE_H * 0.78, 4, b);
      return baseEyes({ y: CY + 8, h }, { y: CY + 8, h });
    } },

  { id: 'normal-stare', label: 'Long stare', duration: 6800,
    render: (t) => {
      // Very still with one slow blink at the end.
      const tw = (t > 0.84 && t < 0.94) ? Math.sin((t - 0.84) / 0.1 * Math.PI) * 6 : 0;
      const b = blink(t, 0.96, 0.04);
      const h = lerp(EYE_H, 4, b);
      return baseEyes({ x: LX, h }, { x: RX + tw, h });
    } },

  { id: 'normal-peek', label: 'Peek around', duration: 5200,
    render: (t) => {
      const seq = [{x:0},{x:14},{x:0},{x:-14},{x:0}];
      const n = seq.length;
      const idx = clamp(Math.floor(t * n), 0, n - 1);
      const sub = t * n - idx;
      const cur = seq[idx], nxt = seq[(idx + 1) % n];
      const e = ease.inOut(sub);
      const dx = lerp(cur.x, nxt.x, e);
      const b = blink(t, 0.55, 0.06);
      const h = lerp(EYE_H * 0.9, 4, b);
      return (
        <g>
          <Eyes L={{ h }} R={{ h }} />
          {h > 30 && (
            <g>
              <circle cx={LX + dx} cy={CY} r={11} fill="var(--bg)" />
              <circle cx={RX + dx} cy={CY} r={11} fill="var(--bg)" />
            </g>
          )}
        </g>
      );
    } },

  { id: 'normal-pendulum', label: 'Pendulum', duration: 3400,
    render: (t) => {
      const dx = Math.sin(t * TAU) * 12;
      return (
        <g>
          <Eyes />
          <circle cx={LX + dx} cy={CY} r={11} fill="var(--bg)" />
          <circle cx={RX + dx} cy={CY} r={11} fill="var(--bg)" />
        </g>
      );
    } },

  { id: 'normal-puff', label: 'Cheek puff', duration: 2800,
    render: (t) => {
      const puff = pulse(t, 0.5, 0.18);
      return (
        <g>
          <Eyes L={{ h: EYE_H * (1 - puff * 0.3) }}
                R={{ h: EYE_H * (1 - puff * 0.3) }} />
          {puff > 0.05 && (
            <g opacity={puff}>
              <ellipse cx={28} cy={CY + 18} rx={20} ry={14} fill="var(--accent)" opacity={0.6} />
              <ellipse cx={W - 28} cy={CY + 18} rx={20} ry={14} fill="var(--accent)" opacity={0.6} />
            </g>
          )}
        </g>
      );
    } },

  { id: 'normal-rem', label: 'REM twitch', duration: 2400,
    render: (t) => {
      const a = Math.sin(t * TAU * 4) * 10;
      const b = Math.cos(t * TAU * 5) * 5;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.85 }} R={{ h: EYE_H * 0.85 }} />
          <circle cx={LX + a} cy={CY + b} r={10} fill="var(--bg)" />
          <circle cx={RX + a} cy={CY + b} r={10} fill="var(--bg)" />
        </g>
      );
    } },
);

// =============================================================
// HAPPY — add 4 (4 → 8)
// =============================================================
cats.happy.variants.push(

  { id: 'happy-laugh', label: 'Laugh', duration: 900,
    render: (t) => {
      const shake = Math.sin(t * TAU * 4) * 3;
      const sq = 1 + Math.abs(Math.sin(t * TAU * 2)) * 0.15;
      return (
        <g fill="none" stroke="var(--eye)" strokeWidth={13} strokeLinecap="round">
          <path d={arcPath(LX + shake, CY + 4, (EYE_W - 4) / sq, 26, true)} />
          <path d={arcPath(RX + shake, CY + 4, (EYE_W - 4) / sq, 26, true)} />
          <path d={arcPath(W / 2, H - 32, 60, 14, true)} strokeWidth={6} />
        </g>
      );
    } },

  { id: 'happy-giggle', label: 'Giggle', duration: 1400,
    render: (t) => {
      const wob = Math.sin(t * TAU * 5) * 4;
      const sq = 1 + Math.sin(t * TAU * 3) * 0.07;
      return (
        <g fill="none" stroke="var(--eye)" strokeWidth={13} strokeLinecap="round">
          <path d={arcPath(LX, CY + 4 + wob, (EYE_W - 4) * sq, 22, true)} />
          <path d={arcPath(RX, CY + 4 - wob, (EYE_W - 4) * sq, 22, true)} />
        </g>
      );
    } },

  { id: 'happy-shimmer', label: 'Shimmer', duration: 2000,
    render: (t) => {
      return (
        <g>
          <g fill="none" stroke="var(--eye)" strokeWidth={13} strokeLinecap="round">
            <path d={arcPath(LX, CY + 6, EYE_W - 4, 20, true)} />
            <path d={arcPath(RX, CY + 6, EYE_W - 4, 20, true)} />
          </g>
          {[0, 1, 2].map((i) => {
            const p = ((t * 1.5) + i * 0.33) % 1;
            const x = LX + (i - 1) * 60 + W / 2 - LX;
            const y = STATUS_H + 16 + p * 20;
            const s = lerp(7, 2, p);
            return <path key={i} d={starPath(x, y, s, s * 0.4)} fill="var(--accent)" opacity={1 - p} />;
          })}
        </g>
      );
    } },

  { id: 'happy-skip', label: 'Skip', duration: 1100,
    render: (t) => {
      const bx = Math.sin(t * TAU * 2) * 5;
      const b = Math.abs(Math.sin(t * TAU * 2));
      const dy = -b * 8;
      return (
        <g>
          <Eyes L={{ x: LX + bx, y: CY + dy, h: EYE_H * 1.05 }}
                R={{ x: RX + bx, y: CY + dy, h: EYE_H * 1.05 }} />
        </g>
      );
    } },
);

// =============================================================
// SAD — add 2 (4 → 6)
// =============================================================
cats.sad.variants.push(

  { id: 'sad-sigh', label: 'Deep sigh', duration: 4000,
    render: (t) => {
      const phase = Math.sin(t * TAU - Math.PI / 2);
      const sigh = (phase + 1) / 2;
      const y = CY + 6 + sigh * 4;
      return (
        <g>
          <Eyes L={{ y, h: EYE_H * (0.74 - sigh * 0.08) }}
                R={{ y, h: EYE_H * (0.74 - sigh * 0.08) }} />
          {sadLid(LX, y, 28)}
          {sadLidMirrored(RX, y, 28)}
          {sigh > 0.4 && (
            <circle cx={W / 2 - 10 + (sigh - 0.4) * 80} cy={H - 30} r={3 + sigh * 3}
                    fill="var(--accent)" opacity={(1 - sigh) * 0.9} />
          )}
        </g>
      );
    } },

  { id: 'sad-rain', label: 'Rain', duration: 1800,
    render: (t) => {
      const y = CY + 4;
      return (
        <g>
          <Eyes L={{ y, h: EYE_H * 0.7 }} R={{ y, h: EYE_H * 0.7 }} />
          {sadLid(LX, y, 24)}
          {sadLidMirrored(RX, y, 24)}
          {/* rain drops across whole screen */}
          {[0,1,2,3,4,5,6,7].map((i) => {
            const p = ((t * 1.8) + i * 0.12) % 1;
            const x = 20 + i * 38;
            return (
              <line key={i} x1={x} y1={STATUS_H + 2 + p * 60} x2={x - 3}
                    y2={STATUS_H + 14 + p * 60} stroke="var(--accent)" strokeWidth={2}
                    opacity={0.55 * (1 - p)} />
            );
          })}
        </g>
      );
    } },
);

// =============================================================
// ANGRY — add 2 (3 → 5)
// =============================================================
cats.angry.variants.push(

  { id: 'angry-narrow', label: 'Narrow glare', duration: 2400,
    render: (t) => {
      const sh = Math.sin(t * TAU * 1.6) * 1.5;
      return (
        <g>
          <Eyes L={{ x: LX + sh, h: 12, rx: 6 }}
                R={{ x: RX - sh, h: 12, rx: 6 }} />
          <g stroke="var(--eye)" strokeWidth={9} strokeLinecap="round">
            <line x1={LX - 36} y1={CY - 30} x2={LX + 30} y2={CY - 12} />
            <line x1={RX + 36} y1={CY - 30} x2={RX - 30} y2={CY - 12} />
          </g>
        </g>
      );
    } },

  { id: 'angry-pouty', label: 'Pouty', duration: 2200,
    render: (t) => {
      const wob = Math.sin(t * TAU * 2) * 1.5;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.6, y: CY + 8, rx: 14 }}
                R={{ h: EYE_H * 0.6, y: CY + 8, rx: 14 }} />
          <g stroke="var(--eye)" strokeWidth={9} strokeLinecap="round">
            <line x1={LX - 30} y1={CY - 22 + wob} x2={LX + 26} y2={CY - 12} />
            <line x1={RX + 30} y1={CY - 22 - wob} x2={RX - 26} y2={CY - 12} />
          </g>
          {/* pouty downturn mouth */}
          <path d={arcPath(W/2, H - 28, 36, 8)} fill="none"
                stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
        </g>
      );
    } },
);

// =============================================================
// SURPRISED — add 2 (2 → 4)
// =============================================================
cats.surprised.variants.push(

  { id: 'surprised-flash', label: 'Flash', duration: 1400,
    render: (t) => {
      const s = pulse(t, 0.2, 0.18);
      const r = (EYE_W / 2) * (1 + s * 0.4);
      return (
        <g>
          <circle cx={LX} cy={CY} r={r} fill="var(--eye)" />
          <circle cx={RX} cy={CY} r={r} fill="var(--eye)" />
          {[-2, -1, 0, 1, 2].map((i) => (
            <line key={i} x1={W/2 + i * 16} y1={STATUS_H + 8}
                  x2={W/2 + i * 24} y2={STATUS_H - 4}
                  stroke="var(--accent)" strokeWidth={3} strokeLinecap="round"
                  opacity={Math.max(0, 1 - (t - 0.1) / 0.35)} />
          ))}
        </g>
      );
    } },

  { id: 'surprised-mild', label: 'Mild', duration: 2400,
    render: (t) => {
      const phase = t < 0.35;
      const s = phase ? ease.out(t / 0.35) : 1 - ease.in((t - 0.35) / 0.65);
      const sz = EYE_W / 2 * (1 + s * 0.22);
      return (
        <g>
          <circle cx={LX} cy={CY} r={sz} fill="var(--eye)" />
          <circle cx={RX} cy={CY} r={sz} fill="var(--eye)" />
          <circle cx={LX - 6} cy={CY - 10} r={5} fill="var(--bg)" />
          <circle cx={RX - 6} cy={CY - 10} r={5} fill="var(--bg)" />
        </g>
      );
    } },
);

// =============================================================
// LOVE — add 2 (3 → 5)
// =============================================================
cats.love.variants.push(

  { id: 'love-blush', label: 'Blush', duration: 2800,
    render: (t) => {
      const sz = EYE_W * 0.85;
      const p2 = 1 + Math.sin(t * TAU * 2) * 0.06;
      return (
        <g>
          <path d={heartPath(LX, CY - 6, sz * p2)} fill="var(--eye)" />
          <path d={heartPath(RX, CY - 6, sz * p2)} fill="var(--eye)" />
          <ellipse cx={LX} cy={CY + 42} rx={16} ry={5} fill="var(--accent)" opacity={0.6} />
          <ellipse cx={RX} cy={CY + 42} rx={16} ry={5} fill="var(--accent)" opacity={0.6} />
        </g>
      );
    } },

  { id: 'love-shower', label: 'Heart shower', duration: 3000,
    render: (t) => (
      <g>
        <Eyes L={{ h: EYE_H * 0.7 }} R={{ h: EYE_H * 0.7 }} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const p = ((t + i * 0.125) % 1);
          const x = 24 + i * 38 + Math.sin(p * TAU + i) * 6;
          const y = lerp(STATUS_H + 4, H - 4, p);
          const sz = 10 + (i % 3) * 4;
          return (
            <path key={i} d={heartPath(x, y, sz * (1 - p * 0.3))}
                  fill="var(--accent)" opacity={(1 - p) * 0.9} />
          );
        })}
      </g>
    ) },
);

// =============================================================
// SLEEPY — add 1 (2 → 3)
// =============================================================
cats.sleepy.variants.push(

  { id: 'sleepy-nod', label: 'Drowsy nod', duration: 3200,
    render: (t) => {
      const phase = ((t * 2) % 1);
      const droopY = phase < 0.85
        ? lerp(8, 32, phase / 0.85)
        : lerp(32, 8, (phase - 0.85) / 0.15);
      const h = lerp(20, 6, droopY / 32);
      return baseEyes({ y: CY + droopY, h, rx: 12 }, { y: CY + droopY, h, rx: 12 });
    } },
);

// =============================================================
// SLEEPING — add 1 (2 → 3)
// =============================================================
cats.sleeping.variants.push(

  { id: 'sleeping-deep', label: 'Deep snore', duration: 3600,
    render: (t) => {
      const phase = Math.sin(t * TAU);
      return (
        <g>
          <g fill="none" stroke="var(--eye)" strokeWidth={11} strokeLinecap="round">
            <path d={arcPath(LX, CY + 16, EYE_W, 14)} />
            <path d={arcPath(RX, CY + 16, EYE_W, 14)} />
          </g>
          {phase > 0 && (
            <ellipse cx={W / 2} cy={H - 30} rx={6 + phase * 8} ry={4 + phase * 4}
                     fill="none" stroke="var(--accent)" strokeWidth={3} opacity={0.7} />
          )}
          {[0, 1].map((i) => {
            const p = ((t * 0.6) + i * 0.5) % 1;
            const x = RX + 28 + p * 28;
            const y = CY - 16 - p * 50;
            return (
              <text key={i} x={x} y={y} fontSize={lerp(14, 30, p)}
                    fontFamily="ui-monospace, Menlo, monospace"
                    fontWeight="700" fill="var(--accent)" opacity={1 - p}>Z</text>
            );
          })}
        </g>
      );
    } },
);

// =============================================================
// CRYING — add 1 (2 → 3)
// =============================================================
cats.crying.variants.push(

  { id: 'crying-sob', label: 'Sob', duration: 1200,
    render: (t) => {
      const sob = Math.sin(t * TAU * 3) * 3;
      return (
        <g transform={`translate(0 ${sob})`}>
          <g fill="none" stroke="var(--eye)" strokeWidth={12} strokeLinecap="round">
            <path d={arcPath(LX, CY + 8, EYE_W, 22)} />
            <path d={arcPath(RX, CY + 8, EYE_W, 22)} />
          </g>
          {[0, 1].map((side) => {
            const x = side === 0 ? LX - 30 : RX + 30;
            const p = ((t * 1.4) + side * 0.5) % 1;
            const cy0 = CY + 16 + p * 70;
            return (
              <path key={side}
                    d={`M ${x} ${cy0}
                        Q ${x + 7} ${cy0 + 18}, ${x} ${cy0 + 32}
                        Q ${x - 7} ${cy0 + 18}, ${x} ${cy0} Z`}
                    fill="var(--accent)" opacity={1 - p * 0.4} />
            );
          })}
        </g>
      );
    } },
);

// =============================================================
// EXCITED — add 2 (3 → 5)
// =============================================================
cats.excited.variants.push(

  { id: 'excited-giddy', label: 'Giddy', duration: 900,
    render: (t) => {
      const bx = Math.sin(t * TAU * 4) * 6;
      const by = Math.cos(t * TAU * 4) * 4;
      const sq = 1 + Math.sin(t * TAU * 8) * 0.08;
      return baseEyes(
        { x: LX + bx, y: CY + by, w: EYE_W / sq, h: EYE_H * sq, rx: 30 },
        { x: RX - bx, y: CY + by, w: EYE_W / sq, h: EYE_H * sq, rx: 30 },
      );
    } },

  { id: 'excited-shockwave', label: 'Shockwave', duration: 1600,
    render: (t) => (
      <g>
        <Eyes />
        {[0, 1, 2].map((i) => {
          const p = ((t * 1.2) + i * 0.33) % 1;
          const r = lerp(EYE_W / 2, EYE_W * 1.8, p);
          return (
            <g key={i} opacity={(1 - p) * 0.85}>
              <circle cx={LX} cy={CY} r={r} fill="none" stroke="var(--accent)" strokeWidth={2} />
              <circle cx={RX} cy={CY} r={r} fill="none" stroke="var(--accent)" strokeWidth={2} />
            </g>
          );
        })}
      </g>
    ) },
);

// =============================================================
// CONFUSED — add 1 (2 → 3)
// =============================================================
cats.confused.variants.push(

  { id: 'confused-mismatch', label: 'Mismatch blink', duration: 2200,
    render: (t) => {
      const a = Math.sin(t * TAU) > 0;
      const lh = a ? EYE_H * 0.35 : EYE_H * 0.95;
      const rh = a ? EYE_H * 0.95 : EYE_H * 0.35;
      return baseEyes({ h: lh, rx: 18 }, { h: rh, rx: 18 });
    } },
);

// =============================================================
// BORED — add 2 (2 → 4)
// =============================================================
cats.bored.variants.push(

  { id: 'bored-eye-roll', label: 'Eye roll', duration: 2400,
    render: (t) => {
      const a = t * TAU - Math.PI / 2;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.85 }} R={{ h: EYE_H * 0.85 }} />
          <circle cx={LX + Math.cos(a) * 18} cy={CY + Math.sin(a) * 18}
                  r={11} fill="var(--bg)" />
          <circle cx={RX + Math.cos(a) * 18} cy={CY + Math.sin(a) * 18}
                  r={11} fill="var(--bg)" />
        </g>
      );
    } },

  { id: 'bored-yawn-small', label: 'Quiet yawn', duration: 3000,
    render: (t) => {
      const y = pulse(t, 0.5, 0.16);
      return (
        <g>
          <Eyes L={{ h: EYE_H * (0.45 - y * 0.18), y: CY + 10 }}
                R={{ h: EYE_H * (0.45 - y * 0.18), y: CY + 10 }} />
          {y > 0.05 && (
            <ellipse cx={W / 2} cy={H - 28} rx={6 + y * 4} ry={3 + y * 8}
                     fill="none" stroke="var(--eye)" strokeWidth={3} opacity={0.7} />
          )}
        </g>
      );
    } },
);

// =============================================================
// LISTENING — add 3 (4 → 7)
// =============================================================
cats.listening.variants.push(

  { id: 'listening-focused', label: 'Focused', duration: 2000,
    render: (t) => {
      const r = 9 + Math.sin(t * TAU * 3) * 1.5;
      const ringOp = 0.4 + Math.sin(t * TAU * 2) * 0.2;
      return (
        <g>
          <Eyes L={{ w: EYE_W * 1.08, h: EYE_H * 1.05 }}
                R={{ w: EYE_W * 1.08, h: EYE_H * 1.05 }} />
          <circle cx={LX} cy={CY} r={r} fill="var(--bg)" />
          <circle cx={RX} cy={CY} r={r} fill="var(--bg)" />
          <g stroke="var(--accent)" strokeWidth={2} fill="none" opacity={ringOp}>
            <rect x={4} y={STATUS_H + 4} width={W - 8} height={H - STATUS_H - 8} rx={6} />
          </g>
        </g>
      );
    } },

  { id: 'listening-mic', label: 'Mic icon', duration: 1600,
    render: (t) => {
      const pulseO = 0.4 + 0.6 * (Math.sin(t * TAU * 3) + 1) / 2;
      return (
        <g>
          <Eyes L={{ y: CY - 16, h: EYE_H * 0.7 }} R={{ y: CY - 16, h: EYE_H * 0.7 }} />
          {/* Mic icon at bottom center */}
          <g transform={`translate(${W/2} ${H - 36})`} fill="var(--accent)" opacity={pulseO}>
            <rect x={-9} y={-22} width={18} height={28} rx={9} />
            <path d="M -16 -2 Q -16 14, 0 14 Q 16 14, 16 -2" fill="none" stroke="var(--accent)" strokeWidth={2.5} />
            <line x1={0} y1={14} x2={0} y2={22} stroke="var(--accent)" strokeWidth={2.5} />
          </g>
        </g>
      );
    } },

  { id: 'listening-bars', label: 'Vertical bars', duration: 1200,
    render: (t) => {
      // Eye-shaped EQ bars themselves (no eye fills).
      const cols = 5;
      return (
        <g fill="var(--accent)">
          {[LX, RX].map((cx) => {
            const items = [];
            for (let i = 0; i < cols; i++) {
              const phase = (t * TAU * 2) + i * 0.7 + (cx === RX ? 0.4 : 0);
              const h = 12 + Math.abs(Math.sin(phase)) * 70;
              const x = cx - 36 + i * 18;
              items.push(<rect key={i} x={x} y={CY - h / 2} width={10} height={h} rx={3} />);
            }
            return <g key={cx}>{items}</g>;
          })}
        </g>
      );
    } },
);

// =============================================================
// THINKING — add 3 (4 → 7)
// =============================================================
cats.thinking.variants.push(

  { id: 'thinking-hmm', label: 'Hmm narrow', duration: 2400,
    render: (t) => {
      const narrow = Math.sin(t * TAU) * 0.2;
      return (
        <g>
          <Eyes L={{ h: EYE_H * (0.5 - narrow), rx: 14 }}
                R={{ h: EYE_H * (0.5 + narrow), rx: 14 }} />
          <circle cx={W / 2} cy={H - 30} r={4} fill="var(--accent)" opacity={0.7} />
        </g>
      );
    } },

  { id: 'thinking-aha', label: 'Aha spark', duration: 1800,
    render: (t) => {
      const second = t > 0.6;
      const fade = second ? 1 - (t - 0.6) / 0.4 : 1;
      return (
        <g>
          <Eyes L={{ h: EYE_H * (second ? 1.05 : 0.78) }}
                R={{ h: EYE_H * (second ? 1.05 : 0.78) }} />
          {!second ? (
            [0, 1, 2].map((i) => {
              const p = ((t / 0.6) - i * 0.15 + 1) % 1;
              const op = clamp(p < 0.5 ? p * 2 : 1, 0.3, 1);
              return (
                <circle key={i} cx={LX + i * 14} cy={STATUS_H + 12}
                        r={3.5} fill="var(--accent)" opacity={op} />
              );
            })
          ) : (
            <g opacity={fade}>
              <path d={starPath(W / 2, STATUS_H + 30, 14 + (1 - fade) * 8, 5)}
                    fill="var(--accent)" />
            </g>
          )}
        </g>
      );
    } },

  { id: 'thinking-cog', label: 'Cogs', duration: 2400,
    render: (t) => {
      const cog = (cx, cy, r, dir = 1) => {
        const teeth = 8;
        let d = '';
        for (let i = 0; i < teeth * 2; i++) {
          const a = (i / (teeth * 2)) * TAU;
          const rr = i % 2 === 0 ? r : r * 0.78;
          d += (i === 0 ? 'M' : 'L') + ` ${cx + Math.cos(a) * rr} ${cy + Math.sin(a) * rr} `;
        }
        d += 'Z';
        return (
          <g transform={`rotate(${t * 360 * dir} ${cx} ${cy})`}>
            <path d={d} fill="var(--accent)" />
            <circle cx={cx} cy={cy} r={r * 0.3} fill="var(--bg)" />
          </g>
        );
      };
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.55 }} R={{ h: EYE_H * 0.55 }} />
          {cog(W - 40, H - 36, 18, 1)}
          {cog(W - 18, H - 18, 10, -1)}
        </g>
      );
    } },
);

// =============================================================
// LOADING — add 2 (3 → 5)
// =============================================================
cats.loading.variants.push(

  { id: 'loading-rings', label: 'Pulse rings', duration: 2000,
    render: (t) => (
      <g>
        <Eyes L={{ h: EYE_H * 0.5, rx: 10 }} R={{ h: EYE_H * 0.5, rx: 10 }} />
        {[0, 1, 2].map((i) => {
          const p = ((t * 1.5) + i * 0.33) % 1;
          const r = lerp(6, 60, p);
          return (
            <circle key={i} cx={W / 2} cy={CY} r={r} fill="none"
                    stroke="var(--accent)" strokeWidth={2} opacity={(1 - p) * 0.7} />
          );
        })}
      </g>
    ) },

  { id: 'loading-bricks', label: 'Bricks', duration: 1600,
    render: (t) => {
      const N = 10;
      const total = (t * N) % N;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.4, rx: 8 }} R={{ h: EYE_H * 0.4, rx: 8 }} />
          {Array.from({ length: N }).map((_, i) => {
            const op = (i < total) ? 1 : 0.18;
            const x = 24 + i * 28;
            return <rect key={i} x={x} y={H - 22} width={22} height={10} rx={2}
                         fill="var(--accent)" opacity={op} />;
          })}
        </g>
      );
    } },
);

// =============================================================
// DIZZY — add 1 (2 → 3)
// =============================================================
cats.dizzy.variants.push(

  { id: 'dizzy-stars', label: 'KO stars', duration: 1800,
    render: (t) => (
      <g>
        <g stroke="var(--eye)" strokeWidth={9} strokeLinecap="round">
          <line x1={LX - 22} y1={CY - 22} x2={LX + 22} y2={CY + 22} />
          <line x1={LX + 22} y1={CY - 22} x2={LX - 22} y2={CY + 22} />
          <line x1={RX - 22} y1={CY - 22} x2={RX + 22} y2={CY + 22} />
          <line x1={RX + 22} y1={CY - 22} x2={RX - 22} y2={CY + 22} />
        </g>
        {[0, 1, 2, 3].map((i) => {
          const a = t * TAU + (i / 4) * TAU;
          const cx = W / 2 + Math.cos(a) * 110;
          const cy = STATUS_H + 28 + Math.sin(a) * 12;
          return <path key={i} d={starPath(cx, cy, 8, 3)} fill="var(--accent)" opacity={0.8} />;
        })}
      </g>
    ) },
);

// =============================================================
// DEAD — add 1 (2 → 3)
// =============================================================
cats.dead.variants.push(

  { id: 'dead-glitch', label: 'Glitch', duration: 1800,
    render: (t) => {
      const flick = Math.sin(t * TAU * 5) > 0.6 ? 0.3 : 1;
      const dx = (Math.sin(t * TAU * 7) > 0.85) ? 4 : 0;
      const sz = 24;
      return (
        <g transform={`translate(${dx} 0)`} opacity={flick}>
          <g stroke="var(--eye)" strokeWidth={9} strokeLinecap="round">
            <line x1={LX - sz} y1={CY - sz} x2={LX + sz} y2={CY + sz} />
            <line x1={LX + sz} y1={CY - sz} x2={LX - sz} y2={CY + sz} />
            <line x1={RX - sz} y1={CY - sz} x2={RX + sz} y2={CY + sz} />
            <line x1={RX + sz} y1={CY - sz} x2={RX - sz} y2={CY + sz} />
          </g>
          <line x1={0} y1={CY + 20} x2={W} y2={CY + 20}
                stroke="var(--accent)" strokeWidth={2} opacity={0.5} />
        </g>
      );
    } },
);

// =============================================================
// NEW: WINK — 3 variants
// =============================================================
cats.wink = {
  label: 'Wink',
  desc: 'Playful acknowledgement.',
  variants: [

    { id: 'wink-right', label: 'Right wink', duration: 2000,
      render: (t) => {
        const close = pulse(t, 0.4, 0.18);
        const rH = lerp(EYE_H, 4, close);
        return (
          <g>
            <Eye x={LX} y={CY} />
            {close > 0.7 ? (
              <path d={arcPath(RX, CY + 4, EYE_W - 4, 18, true)}
                    fill="none" stroke="var(--eye)" strokeWidth={12} strokeLinecap="round" />
            ) : (
              <Eye x={RX} y={CY} h={rH} />
            )}
            {close > 0.5 && (
              <path d={starPath(RX + 36, CY - 28, 7 + close * 4, 3)}
                    fill="var(--accent)" opacity={close} />
            )}
          </g>
        );
      } },

    { id: 'wink-left', label: 'Left wink', duration: 2000,
      render: (t) => {
        const close = pulse(t, 0.4, 0.18);
        const lH = lerp(EYE_H, 4, close);
        return (
          <g>
            {close > 0.7 ? (
              <path d={arcPath(LX, CY + 4, EYE_W - 4, 18, true)}
                    fill="none" stroke="var(--eye)" strokeWidth={12} strokeLinecap="round" />
            ) : (
              <Eye x={LX} y={CY} h={lH} />
            )}
            <Eye x={RX} y={CY} />
            {close > 0.5 && (
              <path d={starPath(LX - 36, CY - 28, 7 + close * 4, 3)}
                    fill="var(--accent)" opacity={close} />
            )}
          </g>
        );
      } },

    { id: 'wink-double', label: 'Double wink', duration: 1800,
      render: (t) => {
        const close = Math.max(pulse(t, 0.25, 0.12), pulse(t, 0.6, 0.12));
        return (
          <g>
            {close > 0.6 ? (
              <g fill="none" stroke="var(--eye)" strokeWidth={12} strokeLinecap="round">
                <path d={arcPath(LX, CY + 4, EYE_W - 4, 18, true)} />
                <path d={arcPath(RX, CY + 4, EYE_W - 4, 18, true)} />
              </g>
            ) : (
              <Eyes L={{ h: lerp(EYE_H, 4, close) }} R={{ h: lerp(EYE_H, 4, close) }} />
            )}
          </g>
        );
      } },
  ],
};

// =============================================================
// NEW: SCARED — 3 variants
// =============================================================
cats.scared = {
  label: 'Scared',
  desc: 'Frightened response.',
  variants: [

    { id: 'scared-tremble', label: 'Tremble', duration: 600,
      render: (t) => {
        const sh = Math.sin(t * TAU * 8) * 3;
        const sv = Math.cos(t * TAU * 8) * 2;
        return (
          <g transform={`translate(${sh} ${sv})`}>
            <circle cx={LX} cy={CY} r={EYE_W / 2 * 1.15} fill="var(--eye)" />
            <circle cx={RX} cy={CY} r={EYE_W / 2 * 1.15} fill="var(--eye)" />
            <circle cx={LX} cy={CY} r={8} fill="var(--bg)" />
            <circle cx={RX} cy={CY} r={8} fill="var(--bg)" />
          </g>
        );
      } },

    { id: 'scared-shrink', label: 'Shrink', duration: 2200,
      render: (t) => {
        const phase = t < 0.3 ? 1 - ease.out(t / 0.3) : 0;
        const sz = lerp(8, EYE_W / 2 * 1.2, phase);
        return (
          <g>
            <Eyes L={{ w: EYE_W * 1.15, h: EYE_H * 1.15 }}
                  R={{ w: EYE_W * 1.15, h: EYE_H * 1.15 }} />
            <circle cx={LX} cy={CY} r={Math.max(sz, 8)} fill="var(--bg)" />
            <circle cx={RX} cy={CY} r={Math.max(sz, 8)} fill="var(--bg)" />
          </g>
        );
      } },

    { id: 'scared-flinch', label: 'Flinch', duration: 1400,
      render: (t) => {
        const f = pulse(t, 0.15, 0.1);
        const r = (EYE_W / 2) * (1 + f * 0.5);
        const tremble = (t > 0.25) ? Math.sin(t * TAU * 10) * 2 : 0;
        return (
          <g transform={`translate(${tremble} 0)`}>
            <circle cx={LX} cy={CY} r={r} fill="var(--eye)" />
            <circle cx={RX} cy={CY} r={r} fill="var(--eye)" />
            <circle cx={LX} cy={CY} r={6 + f * 4} fill="var(--bg)" />
            <circle cx={RX} cy={CY} r={6 + f * 4} fill="var(--bg)" />
          </g>
        );
      } },
  ],
};

// =============================================================
// NEW: SHY — 2 variants
// =============================================================
cats.shy = {
  label: 'Shy',
  desc: 'Bashful / hiding.',
  variants: [

    { id: 'shy-away', label: 'Look away', duration: 3000,
      render: (t) => {
        const side = Math.sin(t * TAU * 0.5) * 16;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.7, y: CY + 6 }}
                  R={{ h: EYE_H * 0.7, y: CY + 6 }} />
            <circle cx={LX + side} cy={CY + 8} r={10} fill="var(--bg)" />
            <circle cx={RX + side} cy={CY + 8} r={10} fill="var(--bg)" />
            <ellipse cx={LX} cy={CY + 40} rx={14} ry={4} fill="var(--accent)" opacity={0.6} />
            <ellipse cx={RX} cy={CY + 40} rx={14} ry={4} fill="var(--accent)" opacity={0.6} />
          </g>
        );
      } },

    { id: 'shy-down', label: 'Look down', duration: 2800,
      render: (t) => {
        const wob = Math.sin(t * TAU * 2) * 1;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.55, y: CY + 10 }}
                  R={{ h: EYE_H * 0.55, y: CY + 10 }} />
            <circle cx={LX + wob} cy={CY + 22} r={9} fill="var(--bg)" />
            <circle cx={RX + wob} cy={CY + 22} r={9} fill="var(--bg)" />
            <ellipse cx={LX} cy={CY + 44} rx={16} ry={5} fill="var(--accent)" opacity={0.65} />
            <ellipse cx={RX} cy={CY + 44} rx={16} ry={5} fill="var(--accent)" opacity={0.65} />
          </g>
        );
      } },
  ],
};

// =============================================================
// NEW: SMUG — 2 variants
// =============================================================
cats.smug = {
  label: 'Smug',
  desc: 'Confident / self-satisfied.',
  variants: [

    { id: 'smug-smirk', label: 'Smirk', duration: 2400,
      render: (t) => {
        const b = blink(t, 0.6, 0.06);
        const h = lerp(EYE_H * 0.45, 4, b);
        return (
          <g>
            <Eyes L={{ h, y: CY + 8, rx: 10 }} R={{ h, y: CY + 8, rx: 10 }} />
            <g fill="var(--bg)">
              <polygon points={`${LX - 50},${CY - 50} ${LX + 50},${CY - 50} ${LX + 50},${CY - 4} ${LX - 50},${CY + 8}`} />
              <polygon points={`${RX - 50},${CY - 50} ${RX + 50},${CY - 50} ${RX + 50},${CY + 8} ${RX - 50},${CY - 4}`} />
            </g>
            <path d={`M ${W/2 - 24} ${H - 30} Q ${W/2 + 4} ${H - 36}, ${W/2 + 28} ${H - 26}`}
                  fill="none" stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'smug-side', label: 'Side glance', duration: 2600,
      render: (t) => {
        const side = Math.sin(t * TAU * 0.7) * 14 + 6;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.6 }} R={{ h: EYE_H * 0.6 }} />
            <g fill="var(--bg)">
              <polygon points={`${LX - 50},${CY - 50} ${LX + 50},${CY - 50} ${LX + 50},${CY - 10} ${LX - 50},${CY + 2}`} />
              <polygon points={`${RX - 50},${CY - 50} ${RX + 50},${CY - 50} ${RX + 50},${CY + 2} ${RX - 50},${CY - 10}`} />
            </g>
            <circle cx={LX + side} cy={CY + 6} r={10} fill="var(--bg)" />
            <circle cx={RX + side} cy={CY + 6} r={10} fill="var(--bg)" />
          </g>
        );
      } },
  ],
};

// =============================================================
// NEW: FOCUSED — 3 variants
// =============================================================
cats.focused = {
  label: 'Focused',
  desc: 'Locked-on / task attention.',
  variants: [

    { id: 'focused-laser', label: 'Laser', duration: 1800,
      render: (t) => {
        const pulseI = 1 + Math.sin(t * TAU * 4) * 0.1;
        return (
          <g>
            <Eyes L={{ w: EYE_W * 0.9, h: EYE_H * 0.65, rx: 10 }}
                  R={{ w: EYE_W * 0.9, h: EYE_H * 0.65, rx: 10 }} />
            <circle cx={LX} cy={CY} r={6 * pulseI} fill="var(--bg)" />
            <circle cx={RX} cy={CY} r={6 * pulseI} fill="var(--bg)" />
            <line x1={W / 2} y1={CY} x2={W} y2={CY}
                  stroke="var(--accent)" strokeWidth={1.5}
                  opacity={0.25 + Math.sin(t * TAU * 6) * 0.15} />
          </g>
        );
      } },

    { id: 'focused-scan', label: 'Scan lock', duration: 2200,
      render: (t) => {
        const phase = ((t * 2) % 1);
        const dx = phase < 0.5 ? lerp(-14, 14, phase * 2) : lerp(14, -14, (phase - 0.5) * 2);
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.7 }} R={{ h: EYE_H * 0.7 }} />
            <rect x={LX + dx - 8} y={CY - 8} width={16} height={16} rx={2}
                  fill="none" stroke="var(--bg)" strokeWidth={3} />
            <rect x={RX + dx - 8} y={CY - 8} width={16} height={16} rx={2}
                  fill="none" stroke="var(--bg)" strokeWidth={3} />
          </g>
        );
      } },

    { id: 'focused-target', label: 'Target', duration: 1600,
      render: (t) => {
        const r = 22 + Math.sin(t * TAU * 2) * 3;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.75 }} R={{ h: EYE_H * 0.75 }} />
            {[LX, RX].map((cx) => (
              <g key={cx} stroke="var(--bg)" strokeWidth={2} fill="none">
                <circle cx={cx} cy={CY} r={r * 0.6} />
                <line x1={cx - r} y1={CY} x2={cx + r} y2={CY} />
                <line x1={cx} y1={CY - r} x2={cx} y2={CY + r} />
              </g>
            ))}
          </g>
        );
      } },
  ],
};

// =============================================================
// NEW: ERROR — 2 variants
// =============================================================
cats.error = {
  label: 'Error',
  desc: 'System / connection issue.',
  variants: [

    { id: 'error-bang', label: 'Bang', duration: 1400,
      render: (t) => {
        const flicker = Math.sin(t * TAU * 6) > 0 ? 1 : 0.4;
        return (
          <g opacity={flicker}>
            {[LX, RX].map((cx) => (
              <g key={cx} fill="var(--accent)">
                <rect x={cx - 8} y={CY - 36} width={16} height={48} rx={4} />
                <circle cx={cx} cy={CY + 26} r={9} />
              </g>
            ))}
          </g>
        );
      } },

    { id: 'error-noconn', label: 'No connection', duration: 2200,
      render: (t) => {
        const fade = 0.4 + Math.abs(Math.sin(t * TAU)) * 0.6;
        return (
          <g opacity={fade}>
            <g stroke="var(--accent)" strokeWidth={6} fill="none" strokeLinecap="round">
              <path d={`M ${W/2 - 50} ${CY + 12} Q ${W/2} ${CY - 38}, ${W/2 + 50} ${CY + 12}`} />
              <path d={`M ${W/2 - 32} ${CY + 22} Q ${W/2} ${CY - 12}, ${W/2 + 32} ${CY + 22}`} />
              <circle cx={W/2} cy={CY + 36} r={4} fill="var(--accent)" stroke="none" />
              <line x1={W/2 - 60} y1={CY - 30} x2={W/2 + 60} y2={CY + 50}
                    stroke="var(--accent)" strokeWidth={6} />
            </g>
          </g>
        );
      } },
  ],
};

// =============================================================
// NEW: PROUD — 2 variants
// =============================================================
cats.proud = {
  label: 'Proud',
  desc: 'Self-confident / accomplished.',
  variants: [

    { id: 'proud-puffed', label: 'Puffed', duration: 2400,
      render: (t) => {
        const lift = Math.sin(t * TAU) * 2;
        return (
          <g>
            <Eyes L={{ y: CY - 4 + lift, h: EYE_H * 0.55, rx: 12 }}
                  R={{ y: CY - 4 + lift, h: EYE_H * 0.55, rx: 12 }} />
            {/* upper lid shadows from above */}
            <g fill="var(--bg)">
              <polygon points={`${LX - 50},${CY - 50} ${LX + 50},${CY - 50} ${LX + 50},${CY - 10 + lift} ${LX - 50},${CY - 10 + lift}`} />
              <polygon points={`${RX - 50},${CY - 50} ${RX + 50},${CY - 50} ${RX + 50},${CY - 10 + lift} ${RX - 50},${CY - 10 + lift}`} />
            </g>
            {/* confident closed-smile */}
            <path d={arcPath(W/2, H - 30, 60, 10, true)} fill="none"
                  stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'proud-glow', label: 'Glow', duration: 2200,
      render: (t) => {
        const p = (Math.sin(t * TAU) + 1) / 2;
        const r = lerp(EYE_W / 2 * 1.1, EYE_W / 2 * 1.2, p);
        return (
          <g>
            <circle cx={LX} cy={CY} r={r} fill="var(--accent)" opacity={0.18 + p * 0.18} />
            <circle cx={RX} cy={CY} r={r} fill="var(--accent)" opacity={0.18 + p * 0.18} />
            <Eyes L={{ h: EYE_H * 0.95 }} R={{ h: EYE_H * 0.95 }} />
            {/* crown-like sparkle */}
            {[-1, 0, 1].map((i) => {
              const x = W / 2 + i * 18;
              const y = STATUS_H + 22 - Math.abs(i) * 4;
              return <path key={i} d={starPath(x, y, 6, 2.5)} fill="var(--accent)" opacity={0.85} />;
            })}
          </g>
        );
      } },
  ],
};

// =============================================================
// NEW: MISCHIEVOUS — 2 variants
// =============================================================
cats.mischievous = {
  label: 'Mischievous',
  desc: 'Sneaky / playful.',
  variants: [

    { id: 'mischievous-grin', label: 'Sneaky grin', duration: 2400,
      render: (t) => {
        const wob = Math.sin(t * TAU * 2) * 1.5;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.5, rx: 14, y: CY + 4 }}
                  R={{ h: EYE_H * 0.5, rx: 14, y: CY + 4 }} />
            {/* lower lids slanting up at outer corners */}
            <g fill="var(--bg)">
              <polygon points={`${LX - 50},${CY + 20 + wob} ${LX + 50},${CY + 14 - wob} ${LX + 50},${CY + 60} ${LX - 50},${CY + 60}`} />
              <polygon points={`${RX - 50},${CY + 14 + wob} ${RX + 50},${CY + 20 - wob} ${RX + 50},${CY + 60} ${RX - 50},${CY + 60}`} />
            </g>
            {/* wide cunning smile */}
            <path d={arcPath(W/2, H - 32, 100, 12, true)} fill="none"
                  stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'mischievous-laugh', label: 'Sneaky laugh', duration: 1400,
      render: (t) => {
        const sh = Math.sin(t * TAU * 5) * 2;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.35, y: CY + 6 + sh, rx: 14 }}
                  R={{ h: EYE_H * 0.35, y: CY + 6 - sh, rx: 14 }} />
            <g fill="var(--bg)">
              <polygon points={`${LX - 50},${CY + 18} ${LX + 50},${CY + 12} ${LX + 50},${CY + 60} ${LX - 50},${CY + 60}`} />
              <polygon points={`${RX - 50},${CY + 12} ${RX + 50},${CY + 18} ${RX + 50},${CY + 60} ${RX - 50},${CY + 60}`} />
            </g>
            <path d={arcPath(W/2, H - 32, 110, 18, true)} fill="none"
                  stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
          </g>
        );
      } },
  ],
};

// =============================================================
// NEW: HUNGRY — 2 variants
// =============================================================
cats.hungry = {
  label: 'Hungry',
  desc: 'Wants food / craving.',
  variants: [

    { id: 'hungry-eye-food', label: 'Eye food', duration: 2000,
      render: (t) => {
        const sz = EYE_W * 0.4 * (1 + Math.sin(t * TAU * 2) * 0.06);
        // Bowl shape in each eye.
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.95 }} R={{ h: EYE_H * 0.95 }} />
            {[LX, RX].map((cx) => (
              <g key={cx}>
                <path d={`M ${cx - sz} ${CY + 4} A ${sz} ${sz * 0.65} 0 0 0 ${cx + sz} ${CY + 4}`}
                      fill="var(--bg)" />
                {/* steam */}
                {[0, 1].map((i) => {
                  const p = ((t * 1.4) + i * 0.5) % 1;
                  return (
                    <path key={i}
                          d={`M ${cx - 6 + i * 12} ${CY - 12 - p * 30}
                              Q ${cx - 2 + i * 12} ${CY - 18 - p * 30},
                                ${cx - 6 + i * 12} ${CY - 24 - p * 30}`}
                          fill="none" stroke="var(--bg)" strokeWidth={2.5}
                          strokeLinecap="round" opacity={(1 - p) * 0.9} />
                  );
                })}
              </g>
            ))}
          </g>
        );
      } },

    { id: 'hungry-drool', label: 'Drool', duration: 2400,
      render: (t) => {
        const sq = 0.7 + Math.sin(t * TAU) * 0.05;
        const drool = (t * 2) % 1;
        return (
          <g>
            <Eyes L={{ h: EYE_H * sq }} R={{ h: EYE_H * sq }} />
            <ellipse cx={W / 2 + 16} cy={H - 24 + drool * 6}
                     rx={4} ry={6 + drool * 4} fill="var(--accent)" opacity={(1 - drool) * 0.9} />
          </g>
        );
      } },
  ],
};

// =============================================================
// NEW: CHARGING — 2 variants
// =============================================================
cats.charging = {
  label: 'Charging',
  desc: 'Battery charging / power up.',
  variants: [

    { id: 'charging-bolt', label: 'Bolt', duration: 1600,
      render: (t) => {
        const pulseB = 0.5 + Math.abs(Math.sin(t * TAU)) * 0.5;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.55 }} R={{ h: EYE_H * 0.55 }} />
            <g fill="var(--accent)" opacity={pulseB}>
              <polygon points={`
                ${W/2 - 6},${STATUS_H + 18}
                ${W/2 + 4},${STATUS_H + 36}
                ${W/2 - 2},${STATUS_H + 38}
                ${W/2 + 6},${STATUS_H + 58}
                ${W/2 - 4},${STATUS_H + 42}
                ${W/2 + 2},${STATUS_H + 40}
              `} />
            </g>
          </g>
        );
      } },

    { id: 'charging-fill', label: 'Battery fill', duration: 2800,
      render: (t) => {
        const fill = (t * 1) % 1;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.4, rx: 10 }} R={{ h: EYE_H * 0.4, rx: 10 }} />
            {/* Battery shell at the bottom */}
            <g transform={`translate(${W/2 - 60} ${H - 32})`}>
              <rect x={0} y={0} width={108} height={20} rx={3}
                    fill="none" stroke="var(--accent)" strokeWidth={2} />
              <rect x={108} y={6} width={4} height={8} fill="var(--accent)" />
              <rect x={3} y={3} width={102 * fill} height={14} fill="var(--accent)" />
            </g>
          </g>
        );
      } },
  ],
};

// =============================================================
// NEW: MUTE — 2 variants
// =============================================================
cats.mute = {
  label: 'Mute',
  desc: 'Mic off / silenced.',
  variants: [

    { id: 'mute-x', label: 'Mic X', duration: 2200,
      render: (t) => {
        const fade = 0.6 + Math.abs(Math.sin(t * TAU * 0.5)) * 0.4;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.6 }} R={{ h: EYE_H * 0.6 }} />
            <g transform={`translate(${W/2} ${H - 38})`} fill="var(--accent)" opacity={fade}>
              <rect x={-9} y={-22} width={18} height={28} rx={9} />
              <path d="M -16 -2 Q -16 14, 0 14 Q 16 14, 16 -2" fill="none"
                    stroke="var(--accent)" strokeWidth={2.5} />
            </g>
            <g stroke="var(--accent)" strokeWidth={4} strokeLinecap="round"
               transform={`translate(${W/2} ${H - 32})`}>
              <line x1={-22} y1={-22} x2={22} y2={22} />
            </g>
          </g>
        );
      } },

    { id: 'mute-zip', label: 'Zipped', duration: 2600,
      render: (t) => {
        const zip = (t * 1.2) % 1;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.7 }} R={{ h: EYE_H * 0.7 }} />
            <line x1={W/2 - 50} y1={H - 30} x2={W/2 + 50} y2={H - 30}
                  stroke="var(--eye)" strokeWidth={4} strokeLinecap="round" />
            {/* zip teeth */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <line key={i} x1={W/2 - 48 + i * 11} y1={H - 34}
                    x2={W/2 - 48 + i * 11} y2={H - 26}
                    stroke="var(--accent)" strokeWidth={2}
                    opacity={(i / 10) < zip ? 1 : 0.25} />
            ))}
          </g>
        );
      } },
  ],
};

// =============================================================
// NEW: GREET — 2 variants
// =============================================================
cats.greet = {
  label: 'Greet',
  desc: 'Hello / wake-up handshake.',
  variants: [

    { id: 'greet-bow', label: 'Bow', duration: 2400,
      render: (t) => {
        const phase = Math.sin(t * TAU - Math.PI/2);
        const dy = phase > 0 ? phase * 18 : 0;
        const close = phase > 0 ? phase * 0.7 : 0;
        const h = lerp(EYE_H, 8, close);
        return baseEyes(
          { y: CY + dy, h }, { y: CY + dy, h }
        );
      } },

    { id: 'greet-wave', label: 'Wave hi', duration: 2000,
      render: (t) => {
        const tilt = Math.sin(t * TAU * 2) * 6;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.95 }} R={{ h: EYE_H * 0.95 }} />
            {/* waving hand-like arc above */}
            <g transform={`translate(${W - 30} ${STATUS_H + 22}) rotate(${tilt})`}>
              <path d="M 0 -16 L 0 6 M -8 0 L 8 0" stroke="var(--accent)" strokeWidth={4}
                    fill="none" strokeLinecap="round" />
            </g>
          </g>
        );
      } },
  ],
};

// ---------- canonical category order ----------
const desiredOrder = [
  'normal',
  'greet',
  'happy', 'wink',
  'sad', 'crying',
  'angry',
  'surprised', 'scared',
  'love', 'shy', 'smug', 'proud',
  'mischievous',
  'sleepy', 'sleeping',
  'excited',
  'confused', 'bored',
  'hungry',
  'listening', 'thinking', 'focused',
  'loading', 'charging',
  'dizzy', 'dead', 'error', 'mute',
];
window.EMOTION_CATEGORY_KEYS = desiredOrder.filter((k) => k in cats);
