// SPDX-License-Identifier: MIT
/* Bespoke narrative scenes (pack 3).
   Adds: clock, celebrate, fitness, morning, calendar,
         reminder, video, lock, flashlight, podcast, stopwatch.
   Loaded AFTER pack-1 and pack-2; reassigns cats.<key> in place.

   Each scene follows the established narrative pattern:
     center-emotion → motivation beat → prop enters → eyes shrink
     → action plays out → prop exits → eyes return → closing beat.
*/

const {
  W, H, STATUS_H, CY, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, ease, pulse, blink,
  Eye, Eyes, heartPath, starPath, arcPath,
} = window.EmotionCore;

const { sceneArc, EmotionFace, TransformedFace } = window.SceneArc;
const cats = window.EMOTION_CATEGORIES;

/* ---- shared helpers (same shape as pack-1/pack-2) ---- */
function phases(t, list) {
  let acc = 0;
  for (const [name, len] of list) {
    if (t < acc + len || name === list[list.length - 1][0]) {
      return { name, p: clamp((t - acc) / len, 0, 1) };
    }
    acc += len;
  }
}
function PlacedFace({ cx, cy, scale, emotion, t }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-W / 2} ${-CY})`}>
      <EmotionFace emotion={emotion} t={t} />
    </g>
  );
}
function ActLabel({ text, op = 1 }) {
  return (
    <text x={W / 2} y={H - 12} textAnchor="middle"
          fontFamily="ui-monospace, Menlo, monospace"
          fontSize={11} fontWeight={700}
          fill="var(--eye)" letterSpacing={3}
          opacity={0.85 * op}>{text}</text>
  );
}

/* ============================================================
   CLOCK — bespoke (14s)
   blank wall → analog clock builds (rim, ticks, hands) →
   hands sweep through hours → tower bells ring → settle
============================================================ */
cats.clock = {
  label: 'Clock',
  desc: 'Clock face builds, hands sweep, bell chimes.',
  kind: 'scene',
  tone: 'cyan',
  variants: [
    { id: 'clock-tower', label: 'Hands & chime', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['idle',     0.06],
          ['rimIn',    0.07],
          ['ticks',    0.07],
          ['shrink',   0.05],
          ['handsIn',  0.08],
          ['sweep',    0.28],
          ['chime',    0.14],
          ['settle',   0.08],
          ['rimOut',   0.07],
          ['grow',     0.06],
          ['done',     0.04],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'idle')   eyeEmo = 'curious';
        else if (ph.name === 'rimIn') eyeEmo = 'eager';
        else if (ph.name === 'ticks') eyeEmo = 'thinking';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 36, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'thinking';
        }
        else if (ph.name === 'handsIn') { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'sweep')   { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'chime')   { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'surprised'; }
        else if (ph.name === 'settle')  { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'rimOut')  { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 36, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        } else eyeEmo = 'satisfied';

        const cx = W / 2 - 8, cy = CY + 6, R = 60;
        const rimOp = ph.name === 'idle' ? 0
                   : ph.name === 'rimIn' ? ease.out(ph.p)
                   : ph.name === 'rimOut' ? 1 - ease.in(ph.p)
                   : 1;
        const ticksShown = !['idle','rimIn','rimOut'].includes(ph.name)
                       ? (ph.name === 'ticks' ? Math.floor(ph.p * 12) + 1 : 12) : 0;
        const handsOp = ph.name === 'handsIn' ? ease.out(ph.p)
                     : ['sweep','chime','settle'].includes(ph.name) ? 1
                     : ph.name === 'rimOut' ? 1 - ease.in(ph.p)
                     : 0;

        // hour progression — sweep through ~7 hours during 'sweep'
        const hourPct = ph.name === 'sweep' ? ph.p
                     : ph.name === 'chime' ? 1
                     : ph.name === 'settle' ? 1
                     : ph.name === 'rimOut' ? 1 : 0;
        const minAngle = hourPct * 12 * TAU; // 12 full minute revolutions
        const hrAngle = hourPct * TAU;       // 1 hour-hand revolution

        const chimeShake = ph.name === 'chime'
          ? Math.sin(ph.p * TAU * 8) * (1 - ph.p) * 3 : 0;

        return (
          <g transform={`translate(${chimeShake} 0)`}>
            {/* rim */}
            {rimOp > 0 && (
              <g opacity={rimOp}>
                <circle cx={cx} cy={cy} r={R}
                        fill="none" stroke="var(--eye)" strokeWidth={4} />
                <circle cx={cx} cy={cy} r={R - 6}
                        fill="var(--bg)" stroke="var(--eye)" strokeWidth={1} opacity={0.4} />
              </g>
            )}
            {/* tick marks */}
            {Array.from({ length: ticksShown }).map((_, i) => {
              const a = (i / 12) * TAU - Math.PI / 2;
              const r1 = R - 10, r2 = R - 18;
              const major = i % 3 === 0;
              return (
                <line key={i}
                      x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
                      x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
                      stroke="var(--eye)" strokeWidth={major ? 3 : 1.5}
                      opacity={0.9} />
              );
            })}
            {/* hands */}
            {handsOp > 0 && (
              <g opacity={handsOp}>
                {/* minute */}
                <line x1={cx} y1={cy}
                      x2={cx + Math.cos(minAngle - Math.PI / 2) * (R - 22)}
                      y2={cy + Math.sin(minAngle - Math.PI / 2) * (R - 22)}
                      stroke="var(--accent)" strokeWidth={3.5} strokeLinecap="round" />
                {/* hour */}
                <line x1={cx} y1={cy}
                      x2={cx + Math.cos(hrAngle - Math.PI / 2) * (R - 36)}
                      y2={cy + Math.sin(hrAngle - Math.PI / 2) * (R - 36)}
                      stroke="var(--accent)" strokeWidth={5} strokeLinecap="round" />
                <circle cx={cx} cy={cy} r={4} fill="var(--accent)" />
              </g>
            )}
            {/* bell on top */}
            {ph.name === 'chime' && (
              <g transform={`translate(${cx} ${cy - R - 4})`}>
                <path d="M -10 0 Q -10 -14, 0 -14 Q 10 -14, 10 0 Z"
                      fill="var(--accent)" />
                <circle cx={0} cy={2} r={2} fill="var(--accent)" />
                {/* sound rings */}
                {[0,1,2].map(i => {
                  const rp = (ph.p * 1.5 + i * 0.33) % 1;
                  return (
                    <path key={i}
                          d={`M ${-20 - rp * 14} ${-6} Q ${-26 - rp * 16} ${-12 - rp * 8}, ${-20 - rp * 14} ${-18 - rp * 14}`}
                          stroke="var(--accent)" strokeWidth={2}
                          fill="none" opacity={1 - rp} />
                  );
                })}
                {[0,1,2].map(i => {
                  const rp = (ph.p * 1.5 + i * 0.33) % 1;
                  return (
                    <path key={'r'+i}
                          d={`M ${20 + rp * 14} ${-6} Q ${26 + rp * 16} ${-12 - rp * 8}, ${20 + rp * 14} ${-18 - rp * 14}`}
                          stroke="var(--accent)" strokeWidth={2}
                          fill="none" opacity={1 - rp} />
                  );
                })}
              </g>
            )}
            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
            <ActLabel text={
              ph.name === 'idle'    ? 'WHAT TIME IS IT?' :
              ph.name === 'rimIn'   ? 'A CLOCK' :
              ph.name === 'ticks'   ? 'TICK MARKS · 12' :
              ph.name === 'shrink'  ? 'LET\u2019S SEE' :
              ph.name === 'handsIn' ? 'HANDS SET' :
              ph.name === 'sweep'   ? 'TIME PASSES…' :
              ph.name === 'chime'   ? 'DING · DING · DING' :
              ph.name === 'settle'  ? 'ON THE HOUR' :
              ph.name === 'rimOut'  ? 'GOOD' :
                                      'NOW YOU KNOW'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   CELEBRATE — bespoke (14s)
   drumroll → trophy rises from below → sparks burst →
   confetti showers → firework crowns → bow + applause
============================================================ */
cats.celebrate = {
  label: 'Celebrate',
  desc: 'Drumroll → trophy → confetti & fireworks → bow.',
  kind: 'scene',
  tone: 'multi',
  variants: [
    { id: 'celebrate-grand', label: 'Grand finale', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['curious',  0.05],
          ['drumroll', 0.08],
          ['shrink',   0.05],
          ['trophyUp', 0.12],
          ['sparks',   0.10],
          ['confetti', 0.16],
          ['firework', 0.14],
          ['bow',      0.10],
          ['trophyDn', 0.08],
          ['grow',     0.07],
          ['done',     0.05],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'curious')  eyeEmo = 'curious';
        else if (ph.name === 'drumroll') eyeEmo = 'eager';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 38, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'excited';
        }
        else if (ph.name === 'trophyUp') { eyeCx = 38; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'surprised'; }
        else if (ph.name === 'sparks')   { eyeCx = 38; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'excited'; }
        else if (ph.name === 'confetti') { eyeCx = 38; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'firework') { eyeCx = 38; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'love'; }
        else if (ph.name === 'bow')      { eyeCx = 38; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'trophyDn') { eyeCx = 38; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(38, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'happy';
        } else eyeEmo = 'happy';

        const trophyRestY = CY + 14;
        const trophyY = ph.name === 'trophyUp' ? lerp(H + 60, trophyRestY, ease.out(ph.p))
                     : ph.name === 'trophyDn' ? lerp(trophyRestY, H + 60, ease.in(ph.p))
                     : ['sparks','confetti','firework','bow'].includes(ph.name) ? trophyRestY
                     : null;
        const bowDip = ph.name === 'bow' ? Math.sin(ph.p * TAU * 2) * 6 : 0;

        const TONES = ['var(--tone-warm)','var(--tone-rose)','var(--tone-green)','var(--tone-blue)','var(--tone-purple)','var(--tone-orange)'];

        return (
          <g>
            {/* drumroll dots */}
            {ph.name === 'drumroll' && [0,1,2].map(i => {
              const sp = (ph.p * 4 + i * 0.33) % 1;
              return (
                <circle key={i}
                        cx={W / 2 - 30 + i * 30} cy={CY + 50}
                        r={3 + Math.sin(sp * TAU) * 2}
                        fill="var(--accent)" opacity={0.8} />
              );
            })}
            {/* trophy */}
            {trophyY !== null && (
              <g transform={`translate(${W / 2} ${trophyY + bowDip})`}>
                {/* cup */}
                <path d="M -22 -36 L 22 -36 L 18 -2 Q 0 8, -18 -2 Z"
                      fill="var(--tone-warm)" />
                {/* handles */}
                <path d="M -22 -32 Q -32 -32, -32 -20 Q -32 -10, -22 -10"
                      fill="none" stroke="var(--tone-warm)" strokeWidth={3} />
                <path d="M 22 -32 Q 32 -32, 32 -20 Q 32 -10, 22 -10"
                      fill="none" stroke="var(--tone-warm)" strokeWidth={3} />
                {/* stem */}
                <rect x={-3} y={-2} width={6} height={12} fill="var(--tone-warm)" />
                {/* base */}
                <rect x={-14} y={10} width={28} height={6} rx={2}
                      fill="var(--tone-warm)" />
                {/* "1" engraving */}
                <text x={0} y={-16} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={16} fontWeight={800}
                      fill="var(--bg)">1</text>
              </g>
            )}
            {/* sparks burst */}
            {ph.name === 'sparks' && [0,1,2,3,4,5,6,7].map(i => {
              const a = (i / 8) * TAU + ph.p * 0.6;
              const r = lerp(20, 70, ease.out(ph.p));
              const x = W / 2 + Math.cos(a) * r;
              const y = trophyRestY - 16 + Math.sin(a) * r;
              return (
                <path key={i}
                      d={starPath(x, y, 4 * (1 - ph.p), 1)}
                      fill={TONES[i % TONES.length]}
                      opacity={1 - ph.p * 0.7} />
              );
            })}
            {/* confetti — keeps falling */}
            {(ph.name === 'confetti' || ph.name === 'firework') &&
              Array.from({ length: 28 }).map((_, i) => {
                const baseT = ph.name === 'confetti' ? ph.p : 1 + ph.p;
                const seed = (i * 73 % 100) / 100;
                const p = (baseT * 0.6 + seed) % 1;
                const x = (i * 23) % W;
                const y = STATUS_H + 4 + p * (H - STATUS_H - 4);
                const rot = (i * 47 + p * 720);
                const sway = Math.sin(p * TAU * 2 + i) * 12;
                return (
                  <rect key={i}
                        x={x + sway - 3} y={y - 1.5}
                        width={6} height={3}
                        transform={`rotate(${rot} ${x + sway} ${y})`}
                        fill={TONES[i % TONES.length]}
                        opacity={ph.name === 'firework' ? 1 - ph.p : 1} />
                );
              })
            }
            {/* fireworks — 3 bursts */}
            {ph.name === 'firework' && [
              { cx: W * 0.30, cy: STATUS_H + 50, delay: 0.0, tone: 'var(--tone-warm)' },
              { cx: W * 0.65, cy: STATUS_H + 38, delay: 0.2, tone: 'var(--tone-rose)' },
              { cx: W * 0.48, cy: STATUS_H + 70, delay: 0.5, tone: 'var(--tone-blue)' },
            ].map((f, fi) => {
              const lp = clamp((ph.p - f.delay) / 0.35, 0, 1);
              if (lp <= 0) return null;
              const r = lerp(0, 40, ease.out(lp));
              return (
                <g key={fi} opacity={1 - lp * 0.4}>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const a = (i / 12) * TAU;
                    return (
                      <line key={i}
                            x1={f.cx + Math.cos(a) * (r * 0.6)}
                            y1={f.cy + Math.sin(a) * (r * 0.6)}
                            x2={f.cx + Math.cos(a) * r}
                            y2={f.cy + Math.sin(a) * r}
                            stroke={f.tone}
                            strokeWidth={2.5}
                            strokeLinecap="round" />
                    );
                  })}
                  <circle cx={f.cx} cy={f.cy} r={3 * (1 - lp)} fill={f.tone} />
                </g>
              );
            })}
            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
            <ActLabel text={
              ph.name === 'curious'  ? 'AND THE WINNER…' :
              ph.name === 'drumroll' ? 'DRUMROLL…' :
              ph.name === 'shrink'   ? 'WAITING…' :
              ph.name === 'trophyUp' ? 'A TROPHY!' :
              ph.name === 'sparks'   ? 'WOW · SPARKS' :
              ph.name === 'confetti' ? 'CONFETTI!' :
              ph.name === 'firework' ? 'FIREWORKS!' :
              ph.name === 'bow'      ? 'THANK YOU' :
              ph.name === 'trophyDn' ? 'CURTAIN' :
                                       'CONGRATS'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   FITNESS — bespoke (14s)
   tired → put on headband → treadmill rises → run →
   HR climbs → cooldown → fist pump
============================================================ */
cats.fitness = {
  label: 'Fitness',
  desc: 'Suit up → run → HR climbs → cooldown → done.',
  kind: 'scene',
  tone: 'red',
  variants: [
    { id: 'fitness-run', label: 'On the treadmill', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['lazy',     0.06],
          ['suitUp',   0.08],
          ['millIn',   0.07],
          ['shrink',   0.05],
          ['warmup',   0.10],
          ['run',      0.20],
          ['sprint',   0.14],
          ['cooldown', 0.10],
          ['fist',     0.08],
          ['millOut',  0.06],
          ['grow',     0.04],
          ['done',     0.02],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'sleepy';
        if (ph.name === 'lazy')   eyeEmo = 'sleepy';
        else if (ph.name === 'suitUp') eyeEmo = 'eager';
        else if (ph.name === 'millIn') eyeEmo = 'curious';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 36, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'eager';
        }
        else if (ph.name === 'warmup')   { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'run')      { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'sprint')   { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'eager'; }
        else if (ph.name === 'cooldown') { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'fist')     { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'excited'; }
        else if (ph.name === 'millOut')  { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 36, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        } else eyeEmo = 'satisfied';

        const millRestY = H - 38;
        const millY = ph.name === 'millIn' ? lerp(H + 60, millRestY, ease.out(ph.p))
                   : ph.name === 'millOut' ? lerp(millRestY, H + 60, ease.in(ph.p))
                   : ['shrink','warmup','run','sprint','cooldown','fist'].includes(ph.name) ? millRestY
                   : null;

        const running = ['warmup','run','sprint','cooldown'].includes(ph.name);
        const beat = ph.name === 'warmup' ? 2 :
                     ph.name === 'run' ? 3.5 :
                     ph.name === 'sprint' ? 6 :
                     ph.name === 'cooldown' ? 1.5 : 0;
        const bob = running ? Math.abs(Math.sin(t * TAU * beat)) * 5 : 0;

        // HR readout
        const hr = ph.name === 'warmup' ? Math.floor(80 + ph.p * 25)
                : ph.name === 'run' ? Math.floor(115 + ph.p * 25)
                : ph.name === 'sprint' ? Math.floor(150 + ph.p * 25)
                : ph.name === 'cooldown' ? Math.floor(170 - ph.p * 60)
                : ph.name === 'fist' ? 110
                : 78;

        // belt scroll speed
        const scrollSpeed = ph.name === 'warmup' ? 1
                         : ph.name === 'run' ? 2.2
                         : ph.name === 'sprint' ? 4
                         : ph.name === 'cooldown' ? 0.7 : 0;

        const runnerCx = W / 2 - 4;

        return (
          <g>
            {/* treadmill */}
            {millY !== null && (
              <g transform={`translate(${W / 2} ${millY})`}>
                {/* belt body */}
                <rect x={-72} y={-6} width={144} height={20} rx={4}
                      fill="var(--eye)" />
                {/* belt stripes */}
                <g clipPath="url(#fit-belt)">
                  <rect x={-72} y={-6} width={144} height={20} fill="var(--eye)" />
                </g>
                {Array.from({ length: 10 }).map((_, i) => {
                  const off = ((i * 18 - t * 1000 * scrollSpeed * 0.05) % 180 + 180) % 180 - 72;
                  return (
                    <rect key={i} x={off - 3} y={-4} width={6} height={16}
                          fill="var(--bg)" opacity={0.45} />
                  );
                })}
                {/* console */}
                <rect x={-30} y={-44} width={60} height={28} rx={4}
                      fill="var(--accent)" />
                <line x1={-30} y1={-16} x2={30} y2={-16}
                      stroke="var(--accent)" strokeWidth={3} />
                {/* mini HR readout on console */}
                <text x={0} y={-32} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={9} fontWeight={700}
                      fill="var(--bg)">HR</text>
                <text x={0} y={-21} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={13} fontWeight={800}
                      fill="var(--bg)">{hr}</text>
              </g>
            )}

            {/* runner stick figure */}
            {running && (() => {
              const headY = millRestY - 60 - bob;
              const armA = Math.sin(t * TAU * beat) * 26;
              const legA = Math.sin(t * TAU * beat) * 28;
              return (
                <g stroke="var(--eye)" strokeWidth={3.5} strokeLinecap="round" fill="none">
                  <circle cx={runnerCx} cy={headY} r={9}
                          fill="var(--eye)" stroke="none" />
                  <line x1={runnerCx} y1={headY + 8} x2={runnerCx + 2} y2={headY + 30} />
                  <line x1={runnerCx} y1={headY + 14}
                        x2={runnerCx - 14 + armA} y2={headY + 22 - armA / 2} />
                  <line x1={runnerCx} y1={headY + 14}
                        x2={runnerCx + 14 - armA} y2={headY + 22 + armA / 2} />
                  <line x1={runnerCx + 2} y1={headY + 30}
                        x2={runnerCx - 10 + legA} y2={millRestY - 8 - bob} />
                  <line x1={runnerCx + 2} y1={headY + 30}
                        x2={runnerCx + 12 - legA} y2={millRestY - 8 - bob} />
                  {/* sweat drops on sprint */}
                  {ph.name === 'sprint' && [0,1].map(i => {
                    const sp = ((t * 1.5) + i * 0.5) % 1;
                    return (
                      <circle key={i}
                              cx={runnerCx - 14 + i * 28}
                              cy={headY - 4 + sp * 20}
                              r={2} fill="var(--accent)" stroke="none"
                              opacity={1 - sp} />
                    );
                  })}
                  {/* headband */}
                  <line x1={runnerCx - 9} y1={headY - 3}
                        x2={runnerCx + 9} y2={headY - 3}
                        stroke="var(--accent)" strokeWidth={4} />
                </g>
              );
            })()}

            {/* fist pump */}
            {ph.name === 'fist' && (() => {
              const lift = Math.sin(ph.p * TAU * 2) * 12;
              const headY = millRestY - 60 + lift * -1;
              return (
                <g stroke="var(--eye)" strokeWidth={3.5} strokeLinecap="round" fill="none">
                  <circle cx={runnerCx} cy={headY} r={9}
                          fill="var(--eye)" stroke="none" />
                  <line x1={runnerCx} y1={headY + 8} x2={runnerCx + 2} y2={headY + 30} />
                  <line x1={runnerCx} y1={headY + 14}
                        x2={runnerCx - 16} y2={headY - 18 - lift} />
                  <line x1={runnerCx} y1={headY + 14}
                        x2={runnerCx + 16} y2={headY - 18 - lift} />
                  <circle cx={runnerCx - 16} cy={headY - 18 - lift} r={4}
                          fill="var(--accent)" stroke="none" />
                  <circle cx={runnerCx + 16} cy={headY - 18 - lift} r={4}
                          fill="var(--accent)" stroke="none" />
                  <line x1={runnerCx + 2} y1={headY + 30}
                        x2={runnerCx - 10} y2={millRestY - 8} />
                  <line x1={runnerCx + 2} y1={headY + 30}
                        x2={runnerCx + 12} y2={millRestY - 8} />
                </g>
              );
            })()}

            {/* HR widget (lower-left) */}
            {running && (
              <g transform={`translate(20 ${H - 50})`}>
                <path d={heartPath(0, 0, 8)} fill="var(--accent)"
                      transform={`scale(${1 + Math.sin(t * TAU * (beat / 1.5)) * 0.15})`} />
                <text x={18} y={4}
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={16} fontWeight={800}
                      fill="var(--accent)">{hr}</text>
                <text x={18} y={16}
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={8} fontWeight={700}
                      fill="var(--eye)" opacity={0.7} letterSpacing={1.5}>BPM</text>
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
            <ActLabel text={
              ph.name === 'lazy'     ? 'TIME TO MOVE…' :
              ph.name === 'suitUp'   ? 'HEADBAND ON' :
              ph.name === 'millIn'   ? 'TREADMILL HERE' :
              ph.name === 'shrink'   ? 'LET\u2019S GO' :
              ph.name === 'warmup'   ? `WARM-UP · ${hr}` :
              ph.name === 'run'      ? `RUNNING · ${hr}` :
              ph.name === 'sprint'   ? `SPRINT! · ${hr}` :
              ph.name === 'cooldown' ? `COOL DOWN · ${hr}` :
              ph.name === 'fist'     ? 'NICE WORK!' :
              ph.name === 'millOut'  ? 'GOOD SESSION' :
                                       'FITNESS COMPLETE'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   MORNING — bespoke (14s)
   asleep → alarm rings → sun peeks over horizon → climbs →
   stretch → coffee bubbles → ready & out the door
============================================================ */
cats.morning = {
  label: 'Morning',
  desc: 'Asleep → alarm → sunrise → stretch → coffee → ready.',
  kind: 'scene',
  tone: 'warm',
  variants: [
    { id: 'morning-rise', label: 'New day', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['asleep',  0.08],
          ['alarm',   0.08],
          ['shrink',  0.05],
          ['sunPeek', 0.10],
          ['sunUp',   0.14],
          ['stretch', 0.12],
          ['coffee',  0.14],
          ['ready',   0.10],
          ['sunOut',  0.06],
          ['grow',    0.07],
          ['done',    0.06],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'sleepy';
        if (ph.name === 'asleep')  eyeEmo = 'sleepy';
        else if (ph.name === 'alarm') eyeEmo = 'surprised';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 38, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'curious';
        }
        else if (ph.name === 'sunPeek') { eyeCx = 38; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'curious'; }
        else if (ph.name === 'sunUp')   { eyeCx = 38; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'stretch') { eyeCx = 38; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'coffee')  { eyeCx = 38; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'eager'; }
        else if (ph.name === 'ready')   { eyeCx = 38; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'excited'; }
        else if (ph.name === 'sunOut')  { eyeCx = 38; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(38, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'happy';
        } else eyeEmo = 'happy';

        const horizonY = H - 38;
        // sun position
        const sunProgress = ph.name === 'sunPeek' ? ph.p * 0.3
                         : ph.name === 'sunUp' ? 0.3 + ph.p * 0.55
                         : ph.name === 'stretch' ? 0.85
                         : ph.name === 'coffee' ? 0.9
                         : ph.name === 'ready' ? 0.95
                         : ph.name === 'sunOut' ? 1
                         : 0;
        const showSun = ph.name !== 'asleep' && ph.name !== 'alarm' && ph.name !== 'shrink';
        const sunY = horizonY - sunProgress * 80;
        const sunX = W / 2 + 30;

        // alarm clock prop in alarm phase
        const alarmRing = ph.name === 'alarm';
        const shake = alarmRing ? Math.sin(t * TAU * 18) * 3 : 0;

        return (
          <g>
            {/* horizon */}
            {(showSun || ph.name === 'sunOut') && (
              <g>
                <line x1={0} y1={horizonY} x2={W} y2={horizonY}
                      stroke="var(--eye)" strokeWidth={2} opacity={0.5} />
                <rect x={0} y={horizonY} width={W} height={H - horizonY}
                      fill="var(--accent)" opacity={0.15} />
              </g>
            )}
            {/* sun + rays */}
            {showSun && (
              <g transform={`translate(${sunX} ${sunY})`}>
                <circle cx={0} cy={0} r={18} fill="var(--accent)" />
                {[0,1,2,3,4,5,6,7].map(i => {
                  const a = (i / 8) * TAU + t * 0.3;
                  return (
                    <line key={i}
                          x1={Math.cos(a) * 24} y1={Math.sin(a) * 24}
                          x2={Math.cos(a) * 34} y2={Math.sin(a) * 34}
                          stroke="var(--accent)" strokeWidth={2.5}
                          strokeLinecap="round" opacity={0.6 + sunProgress * 0.4} />
                  );
                })}
              </g>
            )}
            {/* alarm clock during alarm */}
            {alarmRing && (
              <g transform={`translate(${W / 2 + shake} ${CY + 12 + shake / 2})`}>
                <circle cx={0} cy={0} r={28}
                        fill="none" stroke="var(--accent)" strokeWidth={4} />
                <circle cx={0} cy={0} r={22}
                        fill="var(--bg)" stroke="var(--accent)" strokeWidth={1} />
                <line x1={0} y1={0} x2={10} y2={-14}
                      stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />
                <line x1={0} y1={0} x2={0} y2={-18}
                      stroke="var(--accent)" strokeWidth={4} strokeLinecap="round" />
                <circle cx={0} cy={0} r={3} fill="var(--accent)" />
                <path d="M -28 -22 Q -34 -28, -28 -34"
                      stroke="var(--accent)" strokeWidth={4} fill="none" strokeLinecap="round" />
                <path d="M 28 -22 Q 34 -28, 28 -34"
                      stroke="var(--accent)" strokeWidth={4} fill="none" strokeLinecap="round" />
                {/* sound waves */}
                {[0,1,2].map(i => {
                  const sp = ((t * 3) + i * 0.33) % 1;
                  return (
                    <circle key={i} cx={0} cy={0} r={28 + sp * 18}
                            fill="none" stroke="var(--accent)" strokeWidth={2}
                            opacity={1 - sp} />
                  );
                })}
              </g>
            )}
            {/* stretch figure */}
            {ph.name === 'stretch' && (() => {
              const reach = Math.sin(ph.p * TAU) * 0.4 + 0.6;
              const cx = W / 2 - 4, headY = CY + 6;
              return (
                <g stroke="var(--eye)" strokeWidth={3.5} strokeLinecap="round" fill="none">
                  <circle cx={cx} cy={headY - 18} r={9}
                          fill="var(--eye)" stroke="none" />
                  <line x1={cx} y1={headY - 10} x2={cx + 1} y2={headY + 22} />
                  <line x1={cx} y1={headY - 6}
                        x2={cx - 18 - reach * 8} y2={headY - 30 - reach * 12} />
                  <line x1={cx} y1={headY - 6}
                        x2={cx + 18 + reach * 8} y2={headY - 30 - reach * 12} />
                  <line x1={cx + 1} y1={headY + 22}
                        x2={cx - 10} y2={headY + 44} />
                  <line x1={cx + 1} y1={headY + 22}
                        x2={cx + 12} y2={headY + 44} />
                </g>
              );
            })()}
            {/* coffee cup */}
            {ph.name === 'coffee' && (
              <g transform={`translate(${W / 2 - 4} ${CY + 18})`}>
                <path d="M -20 -10 L -16 18 Q -16 22, -12 22 L 12 22 Q 16 22, 16 18 L 20 -10 Z"
                      fill="var(--accent)" />
                <ellipse cx={0} cy={-10} rx={20} ry={4} fill="var(--bg)" opacity={0.6} />
                <ellipse cx={0} cy={-10} rx={20} ry={4}
                         fill="none" stroke="var(--accent)" strokeWidth={2} />
                <path d="M 20 -4 Q 30 -4, 30 6 Q 30 14, 20 14" fill="none"
                      stroke="var(--accent)" strokeWidth={3} />
                {/* steam */}
                {[0,1,2].map(i => {
                  const sp = ((t * 0.8) + i * 0.33) % 1;
                  return (
                    <path key={i}
                          d={`M ${-6 + i * 6} ${-12 - sp * 26}
                              Q ${-3 + i * 6 + Math.sin(sp * TAU + i) * 4} ${-20 - sp * 26},
                                ${-6 + i * 6} ${-28 - sp * 26}`}
                          stroke="var(--eye)" strokeWidth={2} fill="none"
                          opacity={(1 - sp) * 0.7} />
                  );
                })}
              </g>
            )}
            {/* ready — door + briefcase silhouette */}
            {ph.name === 'ready' && (() => {
              const slideX = ease.out(ph.p) * 60;
              return (
                <g transform={`translate(${W / 2 - 30 + slideX} ${CY + 12})`}>
                  {/* door */}
                  <rect x={20} y={-50} width={36} height={70} rx={3}
                        fill="none" stroke="var(--eye)" strokeWidth={3} />
                  <circle cx={50} cy={-10} r={2} fill="var(--eye)" />
                  {/* figure with case */}
                  <circle cx={0} cy={-30} r={9} fill="var(--accent)" />
                  <rect x={-6} y={-22} width={12} height={28} rx={3}
                        fill="var(--accent)" />
                  <line x1={6} y1={-14} x2={16} y2={-6}
                        stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />
                  <rect x={14} y={-6} width={12} height={10} rx={2}
                        fill="var(--accent)" />
                </g>
              );
            })()}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
            <ActLabel text={
              ph.name === 'asleep'  ? 'STILL SNOOZING…' :
              ph.name === 'alarm'   ? 'BRRRING!' :
              ph.name === 'shrink'  ? 'WAKE UP' :
              ph.name === 'sunPeek' ? 'FIRST LIGHT' :
              ph.name === 'sunUp'   ? 'SUNRISE' :
              ph.name === 'stretch' ? 'BIG STRETCH' :
              ph.name === 'coffee'  ? 'COFFEE TIME' :
              ph.name === 'ready'   ? 'OUT THE DOOR' :
              ph.name === 'sunOut'  ? 'MORNING DONE' :
                                      'GOOD MORNING'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   CALENDAR — bespoke (14s)
   blank page → calendar flips in → pages flip through days →
   one cell highlights → reminder pings → page tears off
============================================================ */
cats.calendar = {
  label: 'Calendar',
  desc: 'Pages flip → date highlights → reminder pings.',
  kind: 'scene',
  tone: 'cyan',
  variants: [
    { id: 'calendar-mark', label: 'Save the date', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['idle',     0.06],
          ['pageIn',   0.07],
          ['shrink',   0.05],
          ['flip1',    0.10],
          ['flip2',    0.10],
          ['flip3',    0.10],
          ['land',     0.06],
          ['highlight',0.10],
          ['ping',     0.12],
          ['tear',     0.10],
          ['grow',     0.08],
          ['done',     0.06],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'idle')  eyeEmo = 'curious';
        else if (ph.name === 'pageIn') eyeEmo = 'eager';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 36, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'thinking';
        }
        else if (['flip1','flip2','flip3'].includes(ph.name)) { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'thinking'; }
        else if (ph.name === 'land')      { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'highlight') { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'surprised'; }
        else if (ph.name === 'ping')      { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'eager'; }
        else if (ph.name === 'tear')      { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 36, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        } else eyeEmo = 'satisfied';

        const pageCx = W / 2 - 8, pageCy = CY + 8;
        const pageW = 130, pageH = 110;
        const pageRestY = pageCy;
        const pageY = ph.name === 'pageIn' ? lerp(H + 60, pageRestY, ease.out(ph.p))
                   : pageRestY;
        const pageOp = ph.name === 'idle' ? 0
                    : ph.name === 'tear' ? Math.max(0, 1 - ph.p * 1.3)
                    : 1;

        // current month index
        const monthList = ['MAR','APR','MAY','JUN'];
        const monthIdx = ph.name === 'flip1' ? Math.floor(ph.p * 1.5)
                      : ph.name === 'flip2' ? 1 + Math.floor(ph.p * 1.5)
                      : ph.name === 'flip3' ? 2 + Math.floor(ph.p * 1.5)
                      : ['land','highlight','ping','tear'].includes(ph.name) ? 3
                      : 0;
        const month = monthList[Math.min(monthIdx, 3)];

        // page flip rotation
        const flipPhases = ['flip1','flip2','flip3'];
        const flipping = flipPhases.indexOf(ph.name);
        const flipRot = flipping >= 0 ? Math.sin(ph.p * Math.PI) * 70 : 0;
        const flipSkew = flipping >= 0 ? flipRot * 0.6 : 0;

        // highlighted cell — day 22
        const cellSize = 14;
        const highlightCol = 2, highlightRow = 3;
        const hiX = pageCx - pageW / 2 + 12 + highlightCol * cellSize + cellSize / 2;
        const hiY = pageY - pageH / 2 + 38 + highlightRow * cellSize + cellSize / 2;
        const hiActive = ['highlight','ping','tear'].includes(ph.name);
        const hiScale = ph.name === 'highlight' ? lerp(0.5, 1.2, ease.out(ph.p))
                     : ph.name === 'ping' ? 1 + Math.sin(ph.p * TAU * 4) * 0.1
                     : 1;

        const tearOffY = ph.name === 'tear' ? ph.p * 40 : 0;
        const tearRot = ph.name === 'tear' ? ph.p * -15 : 0;

        return (
          <g opacity={pageOp}>
            {/* binder rings */}
            <circle cx={pageCx - pageW / 2 + 30} cy={pageY - pageH / 2 - 4} r={4}
                    fill="none" stroke="var(--eye)" strokeWidth={2} />
            <circle cx={pageCx + pageW / 2 - 30} cy={pageY - pageH / 2 - 4} r={4}
                    fill="none" stroke="var(--eye)" strokeWidth={2} />
            <line x1={pageCx - pageW / 2 + 30} y1={pageY - pageH / 2 - 4}
                  x2={pageCx + pageW / 2 - 30} y2={pageY - pageH / 2 - 4}
                  stroke="var(--eye)" strokeWidth={2} opacity={0.4} />

            <g transform={`translate(0 ${tearOffY}) rotate(${tearRot} ${pageCx} ${pageY})`}>
              {/* page */}
              <rect x={pageCx - pageW / 2} y={pageY - pageH / 2}
                    width={pageW} height={pageH} rx={4}
                    fill="var(--bg)" stroke="var(--eye)" strokeWidth={2.5} />
              {/* month header */}
              <rect x={pageCx - pageW / 2} y={pageY - pageH / 2}
                    width={pageW} height={20}
                    fill="var(--accent)" />
              <text x={pageCx} y={pageY - pageH / 2 + 14} textAnchor="middle"
                    fontFamily="ui-monospace, Menlo, monospace"
                    fontSize={12} fontWeight={800}
                    fill="var(--bg)" letterSpacing={3}>{month}</text>
              {/* day headers */}
              <g>
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <text key={i}
                        x={pageCx - pageW / 2 + 12 + i * cellSize + cellSize / 2}
                        y={pageY - pageH / 2 + 32}
                        textAnchor="middle"
                        fontFamily="ui-monospace, Menlo, monospace"
                        fontSize={8} fontWeight={700}
                        fill="var(--eye)" opacity={0.7}>{d}</text>
                ))}
              </g>
              {/* day cells */}
              {Array.from({ length: 35 }).map((_, i) => {
                const row = Math.floor(i / 7), col = i % 7;
                const day = i - 2;
                if (day < 1 || day > 30) return null;
                const dx = pageCx - pageW / 2 + 12 + col * cellSize + cellSize / 2;
                const dy = pageY - pageH / 2 + 42 + row * cellSize;
                const isHi = (col === highlightCol && row === highlightRow) && hiActive;
                return (
                  <text key={i}
                        x={dx} y={dy}
                        textAnchor="middle"
                        fontFamily="ui-monospace, Menlo, monospace"
                        fontSize={7.5} fontWeight={isHi ? 800 : 600}
                        fill={isHi ? 'var(--bg)' : 'var(--eye)'}
                        opacity={isHi ? 1 : 0.85}>{day}</text>
                );
              })}
              {/* highlight ring */}
              {hiActive && (
                <g transform={`translate(${hiX} ${hiY - 4}) scale(${hiScale})`}>
                  <circle cx={0} cy={0} r={7} fill="var(--accent)" />
                  <text x={0} y={3} textAnchor="middle"
                        fontFamily="ui-monospace, Menlo, monospace"
                        fontSize={8} fontWeight={800}
                        fill="var(--bg)">22</text>
                </g>
              )}
              {/* flipping page overlay */}
              {flipping >= 0 && (
                <g transform={`translate(${pageCx} ${pageY}) skewX(${flipSkew})`}
                   opacity={Math.sin(ph.p * Math.PI) * 0.7}>
                  <rect x={-pageW / 2} y={-pageH / 2}
                        width={pageW / 2} height={pageH}
                        fill="var(--eye)" opacity={0.6} />
                </g>
              )}
            </g>

            {/* ping rings + bell on top */}
            {ph.name === 'ping' && (
              <g>
                <g transform={`translate(${hiX} ${hiY - 6})`}>
                  {[0,1,2].map(i => {
                    const rp = (ph.p * 1.5 + i * 0.33) % 1;
                    return (
                      <circle key={i} cx={0} cy={0} r={10 + rp * 18}
                              fill="none" stroke="var(--accent)" strokeWidth={2}
                              opacity={1 - rp} />
                    );
                  })}
                </g>
                <g transform={`translate(${pageCx + pageW / 2 - 12} ${pageY - pageH / 2 - 10})`}>
                  <path d="M -8 0 Q -8 -10, 0 -10 Q 8 -10, 8 0 Z"
                        fill="var(--accent)" />
                  <circle cx={0} cy={2} r={1.5} fill="var(--accent)" />
                </g>
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
            <ActLabel text={
              ph.name === 'idle'      ? 'WHAT DAY IS IT?' :
              ph.name === 'pageIn'    ? 'CALENDAR HERE' :
              ph.name === 'shrink'    ? 'LOOKING UP…' :
              ph.name === 'flip1'     ? 'FLIPPING…' :
              ph.name === 'flip2'     ? 'FLIPPING…' :
              ph.name === 'flip3'     ? 'FLIPPING…' :
              ph.name === 'land'      ? `IT\u2019S ${month}` :
              ph.name === 'highlight' ? 'JUN 22' :
              ph.name === 'ping'      ? 'REMINDER!' :
              ph.name === 'tear'      ? 'NOTED' :
                                        'SAVE THE DATE'
            } />
          </g>
        );
      } },
  ],
};
