// SPDX-License-Identifier: MIT
/* Bespoke narrative scenes (pack 2).
   Adds: cooking, plant, night, walking, message, navigation.
   Loaded AFTER scenes-arc-pack-1.jsx; reassigns cats.<key> in place.
*/

const {
  W, H, STATUS_H, CY, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, ease, pulse, blink,
  Eye, Eyes, heartPath, starPath, arcPath,
} = window.EmotionCore;

const { sceneArc, EmotionFace, TransformedFace } = window.SceneArc;
const cats = window.EMOTION_CATEGORIES;

// ---- helpers (same shape as pack-1) ----
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
   COOKING — pot + flame + ingredient toss + stir + plate
============================================================ */
cats.cooking = {
  label: 'Cooking',
  desc: 'Pot → toss ingredients → stir → plate up.',
  kind: 'scene',
  tone: 'warm',
  variants: [
    { id: 'cooking-pot', label: 'Toss & stir', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['hungry',   0.08],
          ['potIn',    0.08],
          ['shrink',   0.05],
          ['toss1',    0.08],
          ['toss2',    0.08],
          ['toss3',    0.08],
          ['stir',     0.20],
          ['steam',    0.10],
          ['plate',    0.10],
          ['potOut',   0.05],
          ['grow',     0.06],
          ['done',     0.04],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'eager';
        if (ph.name === 'hungry') eyeEmo = 'eager';
        else if (ph.name === 'potIn') eyeEmo = 'curious';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 40, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.32, ease.inOut(ph.p));
          eyeEmo = 'eager';
        }
        else if (['toss1','toss2','toss3'].includes(ph.name)) {
          eyeCx = 40; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'happy';
        }
        else if (ph.name === 'stir')  { eyeCx = 40; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'thinking'; }
        else if (ph.name === 'steam') { eyeCx = 40; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'satisfied'; }
        else if (ph.name === 'plate') { eyeCx = 40; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'excited'; }
        else if (ph.name === 'potOut') { eyeCx = 40; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'happy'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(40, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.32, 1, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else eyeEmo = 'happy';

        const potRestY = CY + 14;
        let potY = potRestY;
        if (ph.name === 'hungry') potY = null;
        else if (ph.name === 'potIn') potY = lerp(H + 60, potRestY, ease.out(ph.p));
        else if (ph.name === 'potOut') potY = lerp(potRestY, H + 60, ease.in(ph.p));

        const tossing = ph.name === 'toss1' ? 0 : ph.name === 'toss2' ? 1 : ph.name === 'toss3' ? 2 : -1;
        const tossP = tossing >= 0 ? ph.p : 0;
        const TOSS_KINDS = ['carrot', 'leek', 'fish'];
        const TOSS_COLORS = ['#ff9d5b', '#9be58a', '#76b8ff'];

        return (
          <g>
            {/* flame */}
            {potY !== null && (
              <g transform={`translate(${W / 2} ${potY + 30})`}>
                {[0, 1, 2].map((i) => {
                  const flick = 0.7 + Math.sin(t * TAU * 6 + i) * 0.3;
                  return (
                    <ellipse key={i}
                             cx={(i - 1) * 12} cy={0}
                             rx={6 * flick} ry={10 * flick}
                             fill="var(--accent)" opacity={0.7 + i * 0.05} />
                  );
                })}
                <line x1={-30} y1={6} x2={30} y2={6}
                      stroke="var(--eye)" strokeWidth={3} opacity={0.6} />
              </g>
            )}

            {/* pot */}
            {potY !== null && (
              <g transform={`translate(${W / 2} ${potY})`}>
                <path d="M -38 -16 L -38 16 Q -38 22, -32 22 L 32 22 Q 38 22, 38 16 L 38 -16 Z"
                      fill="var(--eye)" />
                <ellipse cx={0} cy={-16} rx={38} ry={6} fill="var(--bg)" opacity={0.3} />
                <path d="M -38 -4 Q -50 -4, -50 4" fill="none"
                      stroke="var(--eye)" strokeWidth={3} />
                <path d="M 38 -4 Q 50 -4, 50 4" fill="none"
                      stroke="var(--eye)" strokeWidth={3} />
                {(tossing >= 0 || ['stir','steam','plate','potOut'].includes(ph.name)) && (
                  <ellipse cx={0} cy={-12} rx={32} ry={5}
                           fill="var(--accent)" opacity={0.85} />
                )}
              </g>
            )}

            {/* tossing ingredient — arcs from upper-right */}
            {tossing >= 0 && (() => {
              const startX = W - 30, startY = STATUS_H + 30;
              const endX = W / 2, endY = potY - 16;
              const peakX = (startX + endX) / 2;
              const peakY = STATUS_H + 8;
              const u = ease.out(tossP);
              const x = (1 - u) * (1 - u) * startX + 2 * (1 - u) * u * peakX + u * u * endX;
              const y = (1 - u) * (1 - u) * startY + 2 * (1 - u) * u * peakY + u * u * endY;
              const rot = u * 720;
              const kind = TOSS_KINDS[tossing];
              const color = TOSS_COLORS[tossing];
              return (
                <g transform={`translate(${x} ${y}) rotate(${rot})`}>
                  {kind === 'carrot' && (
                    <g>
                      <path d="M -3 -10 L 3 -10 L 4 8 L -4 8 Z" fill={color} />
                      <path d="M -2 -10 L -4 -16 M 2 -10 L 4 -16 M 0 -10 L 0 -16"
                            stroke={color} strokeWidth={1.5} />
                    </g>
                  )}
                  {kind === 'leek' && (
                    <g>
                      <rect x={-2} y={-12} width={4} height={20} fill={color} />
                      <ellipse cx={0} cy={-14} rx={5} ry={3} fill={color} />
                    </g>
                  )}
                  {kind === 'fish' && (
                    <g>
                      <ellipse cx={0} cy={0} rx={10} ry={4} fill={color} />
                      <path d="M -10 0 L -15 -4 L -15 4 Z" fill={color} />
                      <circle cx={5} cy={-1} r={1} fill="var(--eye)" />
                    </g>
                  )}
                </g>
              );
            })()}

            {/* spoon stir */}
            {ph.name === 'stir' && (
              <g transform={`translate(${W / 2} ${potY - 12})`}>
                <g transform={`rotate(${ph.p * 720})`}>
                  <line x1={0} y1={0} x2={26} y2={-26}
                        stroke="var(--eye)" strokeWidth={3.5} strokeLinecap="round" />
                  <ellipse cx={26} cy={-26} rx={6} ry={4}
                           transform="rotate(-45 26 -26)" fill="var(--eye)" />
                </g>
                {[0, 1, 2].map((i) => {
                  const a = ph.p * TAU * 2 + i * (TAU / 3);
                  return (
                    <circle key={i}
                            cx={Math.cos(a) * 14} cy={Math.sin(a) * 3}
                            r={2} fill="var(--bg)" opacity={0.6} />
                  );
                })}
              </g>
            )}

            {/* steam */}
            {(ph.name === 'steam' || ph.name === 'plate') && potY !== null &&
              [0, 1, 2].map((i) => {
                const p = ((t * 0.8) + i * 0.33) % 1;
                const x = W / 2 + (i - 1) * 8 + Math.sin(p * TAU + i) * 4;
                const y = potY - 24 - p * 50;
                return (
                  <circle key={i} cx={x} cy={y} r={4 + p * 3}
                          fill="var(--eye)" opacity={(1 - p) * 0.55} />
                );
              })
            }

            {/* plate slides in */}
            {ph.name === 'plate' && (() => {
              const px = lerp(W + 40, W - 50, ease.out(ph.p));
              return (
                <g transform={`translate(${px} ${H - 30})`}>
                  <ellipse cx={0} cy={0} rx={26} ry={6} fill="var(--eye)" />
                  <ellipse cx={0} cy={-4} rx={20} ry={4} fill="var(--accent)" />
                </g>
              );
            })()}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'hungry' ? 'HUNGRY…' :
              ph.name === 'potIn'  ? 'POT READY' :
              ph.name === 'shrink' ? 'COOK IT UP' :
              ph.name === 'toss1'  ? 'CARROTS' :
              ph.name === 'toss2'  ? 'LEEKS' :
              ph.name === 'toss3'  ? 'FISH' :
              ph.name === 'stir'   ? 'STIRRING…' :
              ph.name === 'steam'  ? 'SIMMERING' :
              ph.name === 'plate'  ? 'PLATING UP' :
              ph.name === 'potOut' ? 'DINNER READY' :
                                     'BON APPÉTIT'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   PLANT — seed → water → sprout → leaves → bud → bloom
============================================================ */
cats.plant = {
  label: 'Plant',
  desc: 'Pot → seed → water → sprout → bloom.',
  kind: 'scene',
  tone: 'green',
  variants: [
    { id: 'plant-grow', label: 'Seed to bloom', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['waiting',  0.06],
          ['potIn',    0.06],
          ['shrink',   0.05],
          ['seed',     0.07],
          ['water',    0.10],
          ['sprout',   0.13],
          ['leaves',   0.14],
          ['bud',      0.10],
          ['bloom',    0.13],
          ['admire',   0.06],
          ['grow',     0.06],
          ['done',     0.04],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'waiting') eyeEmo = 'curious';
        else if (ph.name === 'potIn') eyeEmo = 'eager';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 36, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.32, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else if (['seed','water','sprout','leaves','bud'].includes(ph.name)) {
          eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'happy';
        }
        else if (ph.name === 'bloom') { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'love'; }
        else if (ph.name === 'admire') { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 36, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.32, 1, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else eyeEmo = 'happy';

        const potCx = W / 2 - 8;
        const potTop = H - 50;
        const potShown = ph.name !== 'waiting';
        const potY = ph.name === 'potIn' ? lerp(H + 60, 0, ease.out(ph.p)) : 0;

        const stemH = ph.name === 'seed' ? 0
                   : ph.name === 'water' ? 0
                   : ph.name === 'sprout' ? lerp(4, 32, ease.out(ph.p))
                   : ph.name === 'leaves' ? lerp(32, 56, ease.out(ph.p))
                   : ph.name === 'bud'    ? 70
                   : ['bloom','admire','grow','done'].includes(ph.name) ? 78
                   : 0;

        const seedY = ph.name === 'seed' ? lerp(STATUS_H + 30, potTop - 4, ease.in(ph.p))
                   : ph.name === 'water' ? potTop - 4
                   : null;

        const showLeaves = ['leaves','bud','bloom','admire','grow','done'].includes(ph.name);
        const showBud    = ['bud','bloom','admire','grow','done'].includes(ph.name);
        const bloomOpen  = ph.name === 'bloom' ? ease.out(ph.p)
                       : ['admire','grow','done'].includes(ph.name) ? 1
                       : 0;
        const showWater = ph.name === 'water';

        return (
          <g>
            {/* pot */}
            {potShown && (
              <g transform={`translate(${potCx} ${potTop + 20 + potY})`}>
                <path d="M -22 -12 L 22 -12 L 18 18 L -18 18 Z" fill="var(--eye)" />
                <rect x={-26} y={-16} width={52} height={6} fill="var(--accent)" />
              </g>
            )}

            {/* seed dropping */}
            {seedY !== null && (
              <circle cx={potCx} cy={seedY} r={3} fill="var(--accent)" />
            )}

            {/* watering can pouring */}
            {showWater && (
              <g>
                <g transform={`translate(${potCx - 50} ${STATUS_H + 30}) rotate(-20)`}>
                  <rect x={-14} y={-8} width={22} height={20} rx={2} fill="var(--eye)" />
                  <path d="M 8 -4 L 18 -8 L 18 -2 L 8 0 Z" fill="var(--eye)" />
                  <path d="M -14 -4 Q -22 -2, -22 4" fill="none"
                        stroke="var(--eye)" strokeWidth={3} />
                </g>
                {Array.from({ length: 3 }).map((_, i) => {
                  const p = ((ph.p * 2) + i * 0.33) % 1;
                  return (
                    <path key={i}
                          d={`M ${potCx - 30 + p * 30} ${STATUS_H + 50 + p * (potTop - STATUS_H - 50)}
                              q -3 -5, 0 -9 q 3 4, 0 9 Z`}
                          fill="var(--accent)" opacity={1 - p * 0.5} />
                  );
                })}
              </g>
            )}

            {/* stem */}
            {stemH > 0 && (
              <line x1={potCx} y1={potTop - 4}
                    x2={potCx} y2={potTop - 4 - stemH}
                    stroke="var(--accent)" strokeWidth={3.5}
                    strokeLinecap="round" />
            )}

            {/* leaves */}
            {showLeaves && (
              <g fill="var(--accent)">
                <ellipse cx={potCx - 12} cy={potTop - 26}
                         rx={9} ry={5}
                         transform={`rotate(-25 ${potCx - 12} ${potTop - 26})`} />
                <ellipse cx={potCx + 12} cy={potTop - 42}
                         rx={9} ry={5}
                         transform={`rotate(25 ${potCx + 12} ${potTop - 42})`} />
              </g>
            )}

            {/* bud */}
            {showBud && !bloomOpen && (
              <ellipse cx={potCx} cy={potTop - 4 - stemH}
                       rx={5} ry={8} fill="var(--accent)" />
            )}

            {/* bloom */}
            {bloomOpen > 0 && (
              <g transform={`translate(${potCx} ${potTop - 4 - stemH}) scale(${bloomOpen})`}>
                {[0, 1, 2, 3, 4].map((i) => {
                  const a = (i / 5) * TAU - Math.PI / 2;
                  return (
                    <ellipse key={i}
                             cx={Math.cos(a) * 8}
                             cy={Math.sin(a) * 8}
                             rx={6} ry={9}
                             transform={`rotate(${(i / 5) * 360} ${Math.cos(a) * 8} ${Math.sin(a) * 8})`}
                             fill="var(--eye)" />
                  );
                })}
                <circle cx={0} cy={0} r={5} fill="var(--accent)" />
              </g>
            )}

            {/* sparkles */}
            {(ph.name === 'bloom' || ph.name === 'admire') && [0, 1, 2].map((i) => {
              const p = ((t * 0.8) + i * 0.33) % 1;
              const a = i * (TAU / 3);
              const r = 22 + p * 18;
              return (
                <path key={i}
                      d={starPath(potCx + Math.cos(a) * r,
                                  potTop - 4 - stemH + Math.sin(a) * r,
                                  3 * (1 - p), 1)}
                      fill="var(--accent)" opacity={1 - p} />
              );
            })}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'waiting' ? 'A NEW PLANT' :
              ph.name === 'potIn'   ? 'POT READY' :
              ph.name === 'shrink'  ? 'PLANT IT' :
              ph.name === 'seed'    ? 'PLANTING SEED' :
              ph.name === 'water'   ? 'WATERING' :
              ph.name === 'sprout'  ? 'GROWING' :
              ph.name === 'leaves'  ? 'LEAVES OPEN' :
              ph.name === 'bud'     ? 'BUD APPEARS' :
              ph.name === 'bloom'   ? 'BLOOM ♥' :
              ph.name === 'admire'  ? 'BEAUTIFUL' :
                                      'GREEN THUMB'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   NIGHT — sun sets → moon rises → stars → owl
============================================================ */
cats.night = {
  label: 'Night',
  desc: 'Sun sets → moon rises → starry sky.',
  kind: 'scene',
  tone: 'purple',
  variants: [
    { id: 'night-fall', label: 'Sundown', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['day',       0.08],
          ['skyDim',    0.08],
          ['shrink',    0.05],
          ['sunset',    0.20],
          ['moon',      0.20],
          ['stars',     0.20],
          ['hoot',      0.06],
          ['grow',      0.06],
          ['done',      0.07],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'day') eyeEmo = 'happy';
        else if (ph.name === 'skyDim') eyeEmo = 'curious';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 40, ease.inOut(ph.p));
          eyeCy = lerp(CY, H - 30, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        }
        else if (ph.name === 'sunset') { eyeCx = 40; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'moon')   { eyeCx = 40; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'love'; }
        else if (ph.name === 'stars')  { eyeCx = 40; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'sleepy'; }
        else if (ph.name === 'hoot')   { eyeCx = 40; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'sleepy'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(40, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(H - 30, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'sleepy';
        }
        else eyeEmo = 'sleepy';

        const horizonY = H - 40;
        const sunP = ph.name === 'day' ? 0
                  : ph.name === 'skyDim' ? lerp(0, 0.2, ph.p)
                  : ph.name === 'shrink' ? 0.2
                  : ph.name === 'sunset' ? lerp(0.2, 1, ease.in(ph.p))
                  : 1;
        const sunY = lerp(STATUS_H + 40, horizonY + 24, sunP);
        const sunX = lerp(W / 2 - 60, W / 2, sunP);
        const sunOp = 1 - clamp((sunP - 0.85) * 6, 0, 1);

        const moonP = ph.name === 'moon' ? ease.out(ph.p)
                   : ['stars','hoot','grow','done'].includes(ph.name) ? 1
                   : 0;
        const moonY = lerp(STATUS_H - 10, STATUS_H + 30, moonP);
        const moonX = W / 2 + 50;

        const starsOp = ph.name === 'stars' ? ease.out(ph.p)
                     : ['hoot','grow','done'].includes(ph.name) ? 1
                     : 0;

        const showOwl = ph.name === 'hoot' || ph.name === 'grow';

        return (
          <g>
            <line x1={0} y1={horizonY} x2={W} y2={horizonY}
                  stroke="var(--eye)" strokeWidth={2} opacity={0.4} />
            <rect x={0} y={horizonY} width={W} height={H - horizonY}
                  fill="var(--eye)" opacity={0.18} />

            {sunOp > 0 && (
              <g opacity={sunOp}>
                <circle cx={sunX} cy={sunY} r={16} fill="var(--accent)" />
                <g opacity={1 - sunP * 0.5}>
                  {[0, 1, 2, 3, 4, 5].map((i) => {
                    const a = (i / 6) * TAU + t * 0.3;
                    return (
                      <line key={i}
                            x1={sunX + Math.cos(a) * 20} y1={sunY + Math.sin(a) * 20}
                            x2={sunX + Math.cos(a) * 28} y2={sunY + Math.sin(a) * 28}
                            stroke="var(--accent)" strokeWidth={2}
                            strokeLinecap="round" opacity={0.7} />
                    );
                  })}
                </g>
              </g>
            )}

            {moonP > 0 && (
              <g opacity={moonP} transform={`translate(${moonX} ${moonY})`}>
                <circle cx={0} cy={0} r={14} fill="var(--accent)" />
                <circle cx={5} cy={-3} r={12} fill="var(--bg)" opacity={0.85} />
              </g>
            )}

            {starsOp > 0 && Array.from({ length: 9 }).map((_, i) => {
              const x = (i * 37) % (W - 20) + 10;
              const y = STATUS_H + 14 + ((i * 19) % 70);
              const twinkle = 0.5 + Math.abs(Math.sin(t * TAU + i)) * 0.5;
              return (
                <path key={i}
                      d={starPath(x, y, 3 + (i % 2) * 1.5, 1)}
                      fill="var(--accent)" opacity={starsOp * twinkle} />
              );
            })}

            {showOwl && (
              <g transform={`translate(${W - 60} ${horizonY - 8})`}>
                <ellipse cx={0} cy={0} rx={10} ry={12} fill="var(--eye)" />
                <circle cx={-4} cy={-3} r={3} fill="var(--bg)" />
                <circle cx={4}  cy={-3} r={3} fill="var(--bg)" />
                <circle cx={-4} cy={-3} r={1.5} fill="var(--eye)" />
                <circle cx={4}  cy={-3} r={1.5} fill="var(--eye)" />
                <path d="M 0 1 L -2 3 L 0 5 L 2 3 Z" fill="var(--accent)" />
                <text x={-22} y={-14}
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={10} fontWeight={700}
                      fill="var(--accent)"
                      opacity={Math.sin(ph.name === 'hoot' ? ph.p * TAU * 4 : t * TAU * 2)
                                > 0 ? 0.9 : 0.2}>hoo</text>
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'day'     ? 'AFTERNOON' :
              ph.name === 'skyDim'  ? 'GROWING DARK' :
              ph.name === 'shrink'  ? 'WATCHING…' :
              ph.name === 'sunset'  ? 'SUN SETTING' :
              ph.name === 'moon'    ? 'MOONRISE' :
              ph.name === 'stars'   ? 'STARS OUT' :
              ph.name === 'hoot'    ? 'OWL · HOO' :
                                      'GOOD NIGHT'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   WALKING — stick figure + scrolling scenery + step counter
============================================================ */
cats.walking = {
  label: 'Walking',
  desc: 'Walk in place, scenery scrolls, reach the goal.',
  kind: 'scene',
  tone: 'green',
  variants: [
    { id: 'walking-scroll', label: 'Out for a walk', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['eager',    0.06],
          ['suitUp',   0.08],
          ['shrink',   0.05],
          ['walk',     0.50],
          ['goal',     0.10],
          ['cheer',    0.08],
          ['exit',     0.06],
          ['grow',     0.05],
          ['done',     0.02],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'eager';
        if (ph.name === 'eager') eyeEmo = 'eager';
        else if (ph.name === 'suitUp') eyeEmo = 'happy';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 36, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 26, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else if (ph.name === 'walk') { eyeCx = W - 36; eyeCy = STATUS_H + 26; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'goal')  { eyeCx = W - 36; eyeCy = STATUS_H + 26; eyeScale = 0.30; eyeEmo = 'surprised'; }
        else if (ph.name === 'cheer') { eyeCx = W - 36; eyeCy = STATUS_H + 26; eyeScale = 0.30; eyeEmo = 'excited'; }
        else if (ph.name === 'exit')  { eyeCx = W - 36; eyeCy = STATUS_H + 26; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 36, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 26, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        }
        else eyeEmo = 'satisfied';

        const walkerCx = W / 2;
        const groundY = H - 24;
        const walking = ['shrink','walk','goal'].includes(ph.name);
        const bob = walking ? Math.abs(Math.sin(t * TAU * 4)) * 4 : 0;
        const walkerY = groundY - 36 - bob;
        const armA = Math.sin(t * TAU * 4) * 20;
        const legA = Math.sin(t * TAU * 4) * 20;

        const scrollP = ph.name === 'walk' ? ph.p : 0;
        const sceneryItems = ['walk','goal','cheer','exit'].includes(ph.name);

        const dist = ph.name === 'walk' ? Math.floor(ph.p * 1000)
                  : ['goal','cheer','exit','grow','done'].includes(ph.name) ? 1000
                  : 0;

        return (
          <g>
            <line x1={0} y1={groundY} x2={W} y2={groundY}
                  stroke="var(--eye)" strokeWidth={2} opacity={0.5} />

            {sceneryItems && Array.from({ length: 6 }).map((_, i) => {
              const x = ((i * 50) - scrollP * 200) % (W + 50) - 20;
              if (x < -20 || x > W + 20) return null;
              return (
                <line key={i} x1={x} y1={groundY + 4} x2={x + 20} y2={groundY + 4}
                      stroke="var(--eye)" strokeWidth={2} opacity={0.4} />
              );
            })}

            {sceneryItems && [0, 1, 2, 3].map((i) => {
              const baseX = i * 80;
              const x = ((baseX - scrollP * 320) % (W + 60)) - 30;
              const treeH = 24 + (i % 2) * 8;
              return (
                <g key={i} transform={`translate(${x} ${groundY})`}>
                  <line x1={0} y1={0} x2={0} y2={-treeH * 0.4}
                        stroke="var(--accent)" strokeWidth={3} opacity={0.7} />
                  <circle cx={0} cy={-treeH * 0.6} r={treeH * 0.4}
                          fill="var(--accent)" opacity={0.55} />
                </g>
              );
            })}

            {walking && (
              <g stroke="var(--eye)" strokeWidth={3.5} strokeLinecap="round" fill="none">
                <circle cx={walkerCx} cy={walkerY - 22} r={9}
                        fill="var(--eye)" stroke="none" />
                <line x1={walkerCx} y1={walkerY - 14} x2={walkerCx + 1} y2={walkerY + 12} />
                <line x1={walkerCx} y1={walkerY - 8}
                      x2={walkerCx - 12 + armA} y2={walkerY + 2 - armA / 2} />
                <line x1={walkerCx} y1={walkerY - 8}
                      x2={walkerCx + 12 - armA} y2={walkerY + 2 + armA / 2} />
                <line x1={walkerCx + 1} y1={walkerY + 12}
                      x2={walkerCx - 9 + legA} y2={groundY - bob} />
                <line x1={walkerCx + 1} y1={walkerY + 12}
                      x2={walkerCx + 11 - legA} y2={groundY - bob} />
              </g>
            )}

            {walking && (
              <g transform={`translate(20 ${STATUS_H + 28})`}>
                <text x={0} y={0}
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={9} fontWeight={700}
                      fill="var(--eye)" letterSpacing={2} opacity={0.7}>STEPS</text>
                <text x={0} y={16}
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={18} fontWeight={800}
                      fill="var(--accent)">{dist}</text>
              </g>
            )}

            {(ph.name === 'goal' || ph.name === 'cheer' || ph.name === 'exit') && (() => {
              const ux = ph.name === 'goal' ? lerp(W + 20, W / 2 + 60, ease.out(ph.p))
                       : W / 2 + 60;
              return (
                <g transform={`translate(${ux} ${groundY})`}>
                  <line x1={0} y1={0} x2={0} y2={-40}
                        stroke="var(--eye)" strokeWidth={3} />
                  <path d="M 0 -40 L 22 -34 L 22 -22 L 0 -28 Z"
                        fill="var(--accent)" />
                </g>
              );
            })()}

            {ph.name === 'cheer' && Array.from({ length: 12 }).map((_, i) => {
              const seed = (i * 137) % 100 / 100;
              const p = ((ph.p * 1.3) + seed) % 1;
              const x = walkerCx - 50 + (i * 8) % 100;
              const y = lerp(groundY - 40, groundY - 80, p);
              const rot = p * 360;
              return (
                <rect key={i} x={x - 3} y={y - 1.5} width={6} height={3}
                      transform={`rotate(${rot} ${x} ${y})`}
                      fill="var(--accent)" opacity={1 - p * 0.3} />
              );
            })}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'eager'  ? 'NICE WEATHER' :
              ph.name === 'suitUp' ? 'LACE UP' :
              ph.name === 'shrink' ? 'OFF WE GO' :
              ph.name === 'walk'   ? `${dist} STEPS` :
              ph.name === 'goal'   ? 'THE FINISH!' :
              ph.name === 'cheer'  ? 'MADE IT!' :
              ph.name === 'exit'   ? 'WELL DONE' :
                                     '1000 STEPS DONE'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   MESSAGE — chat bubbles, typing dots, back-and-forth
============================================================ */
cats.message = {
  label: 'Message',
  desc: 'Chat back and forth → send → done.',
  kind: 'scene',
  tone: 'cyan',
  variants: [
    { id: 'message-chat', label: 'Chat', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['curious',  0.06],
          ['theirIn1', 0.08],
          ['shrink',   0.05],
          ['typing1',  0.10],
          ['myIn1',    0.08],
          ['theirIn2', 0.10],
          ['typing2',  0.10],
          ['myIn2',    0.08],
          ['send',     0.10],
          ['delivered',0.10],
          ['exit',     0.05],
          ['grow',     0.05],
          ['done',     0.05],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'curious') eyeEmo = 'curious';
        else if (ph.name === 'theirIn1') eyeEmo = 'curious';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 32, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 26, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.28, ease.inOut(ph.p));
          eyeEmo = 'thinking';
        }
        else if (ph.name === 'typing1' || ph.name === 'typing2') {
          eyeCx = W - 32; eyeCy = STATUS_H + 26; eyeScale = 0.28; eyeEmo = 'thinking';
        }
        else if (ph.name === 'myIn1' || ph.name === 'myIn2') {
          eyeCx = W - 32; eyeCy = STATUS_H + 26; eyeScale = 0.28; eyeEmo = 'happy';
        }
        else if (ph.name === 'theirIn2') { eyeCx = W - 32; eyeCy = STATUS_H + 26; eyeScale = 0.28; eyeEmo = 'curious'; }
        else if (ph.name === 'send' || ph.name === 'delivered') {
          eyeCx = W - 32; eyeCy = STATUS_H + 26; eyeScale = 0.28; eyeEmo = 'satisfied';
        }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 32, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 26, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.28, 1, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else eyeEmo = 'happy';

        const ROW_Y = [STATUS_H + 28, STATUS_H + 58, STATUS_H + 88, STATUS_H + 118];

        const visibleSet = new Set();
        const entered = ['theirIn1','shrink','typing1','myIn1','theirIn2','typing2','myIn2','send','delivered','exit'];
        const cur = entered.indexOf(ph.name);
        if (cur >= 0) {
          if (cur >= 0)  visibleSet.add('them1');
          if (cur >= 3)  visibleSet.add('me1');
          if (cur >= 4)  visibleSet.add('them2');
          if (cur >= 6)  visibleSet.add('me2');
        }

        const isTyping1 = ph.name === 'typing1';
        const isTyping2 = ph.name === 'typing2';

        const bubble = (which, row, anim) => {
          const isMine = which.startsWith('me');
          const x = isMine ? W - 110 : 20;
          const w = 100;
          return (
            <g transform={`translate(${x + (anim || 0)} ${ROW_Y[row]})`}>
              <rect x={0} y={-12} width={w} height={20} rx={10}
                    fill={isMine ? 'var(--accent)' : 'var(--eye)'} />
              <rect x={6} y={-6} width={w - 24} height={3} rx={1.5}
                    fill="var(--bg)" opacity={0.8} />
              <rect x={6} y={1} width={w - 36} height={3} rx={1.5}
                    fill="var(--bg)" opacity={0.55} />
            </g>
          );
        };

        const typingBubble = (which, row) => {
          const isMine = which.startsWith('me');
          const x = isMine ? W - 110 : 20;
          return (
            <g transform={`translate(${x} ${ROW_Y[row]})`}>
              <rect x={0} y={-10} width={50} height={20} rx={10}
                    fill={isMine ? 'var(--accent)' : 'var(--eye)'} />
              {[0, 1, 2].map((i) => {
                const dotP = ((t * 2) + i * 0.3) % 1;
                return (
                  <circle key={i} cx={12 + i * 14} cy={0}
                          r={3} fill="var(--bg)"
                          opacity={0.5 + Math.sin(dotP * TAU) * 0.4} />
                );
              })}
            </g>
          );
        };

        const animX = (which) => {
          if (which === 'them1' && ph.name === 'theirIn1') return lerp(-120, 0, ease.out(ph.p));
          if (which === 'me1' && ph.name === 'myIn1') return lerp(120, 0, ease.out(ph.p));
          if (which === 'them2' && ph.name === 'theirIn2') return lerp(-120, 0, ease.out(ph.p));
          if (which === 'me2' && ph.name === 'myIn2') return lerp(120, 0, ease.out(ph.p));
          return 0;
        };

        return (
          <g>
            {visibleSet.has('them1') && !isTyping1 && bubble('them1', 0, animX('them1'))}
            {isTyping1 && typingBubble('me1', 1)}
            {visibleSet.has('me1') && !isTyping1 && bubble('me1', 1, animX('me1'))}
            {visibleSet.has('them2') && !isTyping2 && bubble('them2', 2, animX('them2'))}
            {isTyping2 && typingBubble('me2', 3)}
            {visibleSet.has('me2') && !isTyping2 && bubble('me2', 3, animX('me2'))}

            {(ph.name === 'delivered' || ph.name === 'exit') && (
              <g transform={`translate(${W - 22} ${ROW_Y[3] + 14})`}>
                <text x={0} y={0} textAnchor="end"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={8} fontWeight={700}
                      fill="var(--accent)" letterSpacing={1}>✓✓</text>
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'curious'  ? "WHO'S THIS?" :
              ph.name === 'theirIn1' ? 'NEW MESSAGE' :
              ph.name === 'shrink'   ? 'LET ME REPLY' :
              ph.name === 'typing1'  ? 'TYPING…' :
              ph.name === 'myIn1'    ? 'SENT' :
              ph.name === 'theirIn2' ? 'THEY REPLIED' :
              ph.name === 'typing2'  ? 'TYPING…' :
              ph.name === 'myIn2'    ? 'SENT' :
              ph.name === 'send'     ? 'CHATTING' :
              ph.name === 'delivered'? 'DELIVERED ✓✓' :
                                       'NICE CHAT'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   NAVIGATION — turn-by-turn HUD arrow
============================================================ */
cats.navigation = {
  label: 'Navigation',
  desc: 'Turn-by-turn directions → arrive.',
  kind: 'scene',
  tone: 'cyan',
  variants: [
    { id: 'nav-turn', label: 'Turn by turn', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['plan',     0.08],
          ['start',    0.08],
          ['shrink',   0.05],
          ['straight', 0.13],
          ['left',     0.13],
          ['straight2',0.13],
          ['right',    0.13],
          ['arrive',   0.10],
          ['exit',     0.06],
          ['grow',     0.06],
          ['done',     0.07],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'thinking';
        if (ph.name === 'plan')  eyeEmo = 'thinking';
        else if (ph.name === 'start') eyeEmo = 'eager';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 32, ease.inOut(ph.p));
          eyeCy = lerp(CY, H - 30, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else if (['straight','left','straight2','right'].includes(ph.name)) {
          eyeCx = W - 32; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'happy';
        }
        else if (ph.name === 'arrive') { eyeCx = W - 32; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'excited'; }
        else if (ph.name === 'exit')   { eyeCx = W - 32; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 32, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(H - 30, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        }
        else eyeEmo = 'satisfied';

        const arrowDeg = ph.name === 'straight' ? 0
                      : ph.name === 'left' ? -90
                      : ph.name === 'straight2' ? 0
                      : ph.name === 'right' ? 90
                      : 0;

        const drivePhases = ['straight','left','straight2','right'];
        const driveIdx = drivePhases.indexOf(ph.name);
        const totalDrive = drivePhases.length;
        const drivePct = driveIdx >= 0 ? (driveIdx + ph.p) / totalDrive
                       : (ph.name === 'arrive' ? 1 : 0);
        const distLeft = Math.max(0, Math.round((2.0 - drivePct * 2.0) * 10)) / 10;
        const etaLeft = Math.max(0, Math.round(8 - drivePct * 8));

        const inst = ph.name === 'plan'     ? 'PLANNING ROUTE' :
                     ph.name === 'start'    ? 'STARTING' :
                     ph.name === 'shrink'   ? 'GO STRAIGHT' :
                     ph.name === 'straight' ? `${distLeft} KM · GO STRAIGHT` :
                     ph.name === 'left'     ? `${distLeft} KM · TURN LEFT` :
                     ph.name === 'straight2'? `${distLeft} KM · CONTINUE` :
                     ph.name === 'right'    ? `${distLeft} KM · TURN RIGHT` :
                     ph.name === 'arrive'   ? 'YOU HAVE ARRIVED' :
                     ph.name === 'exit'     ? 'DESTINATION' :
                                              'TRIP COMPLETE';

        const showHUD = ph.name !== 'plan';

        return (
          <g>
            {showHUD && (
              <g>
                {ph.name !== 'arrive' ? (
                  <g transform={`translate(${W / 2} ${CY - 8}) rotate(${arrowDeg})`}>
                    <path d="M 0 -36 L 24 -8 L 10 -8 L 10 30
                             L -10 30 L -10 -8 L -24 -8 Z"
                          fill="var(--accent)" />
                  </g>
                ) : (
                  <g transform={`translate(${W / 2} ${CY + 4})`}>
                    <path d="M 0 30 L -18 0 L -18 -22 L 18 -22 L 18 0 Z"
                          fill="var(--accent)" />
                    <circle cx={0} cy={-12} r={6} fill="var(--bg)" />
                  </g>
                )}
                <g transform={`translate(${W / 2} ${STATUS_H + 30})`}>
                  <rect x={-72} y={-12} width={144} height={22} rx={11}
                        fill="var(--eye)" opacity={0.85} />
                  <text x={0} y={3} textAnchor="middle"
                        fontFamily="ui-monospace, Menlo, monospace"
                        fontSize={10} fontWeight={800}
                        fill="var(--bg)" letterSpacing={2}>{inst}</text>
                </g>
                <g transform={`translate(20 ${H - 26})`}>
                  <text x={0} y={0}
                        fontFamily="ui-monospace, Menlo, monospace"
                        fontSize={9} fontWeight={700}
                        fill="var(--eye)" letterSpacing={2} opacity={0.7}>ETA</text>
                  <text x={0} y={14}
                        fontFamily="ui-monospace, Menlo, monospace"
                        fontSize={14} fontWeight={800}
                        fill="var(--accent)">{etaLeft} MIN</text>
                </g>
              </g>
            )}

            {ph.name === 'plan' && (
              <g transform={`translate(${W / 2} ${CY})`}>
                <circle cx={0} cy={0} r={28}
                        fill="none" stroke="var(--eye)" strokeWidth={3}
                        strokeDasharray="44 44"
                        transform={`rotate(${ph.p * 720})`} />
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={inst} />
          </g>
        );
      } },
  ],
};
