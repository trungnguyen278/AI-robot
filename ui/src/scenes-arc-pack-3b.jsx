// SPDX-License-Identifier: MIT
/* Bespoke narrative scenes (pack 3b).
   Continuation of pack-3 (file split to keep each manageable).
   Adds: reminder, video, lock, flashlight, podcast, stopwatch.
   Loaded AFTER scenes-arc-pack-3.jsx.
*/

const {
  W, H, STATUS_H, CY, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, ease, pulse, blink,
  Eye, Eyes, heartPath, starPath, arcPath,
} = window.EmotionCore;

const { sceneArc, EmotionFace, TransformedFace } = window.SceneArc;
const cats = window.EMOTION_CATEGORIES;

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
   REMINDER — bespoke (14s) — THREE VIGNETTES
   bored → water glass slides in, drinks, slides out →
   pill bottle slides in, takes meds, slides out →
   stretch pose hold → satisfied
============================================================ */
cats.reminder = {
  label: 'Reminder',
  desc: 'Water → meds → stretch — three quick vignettes.',
  kind: 'scene',
  tone: 'red',
  variants: [
    { id: 'reminder-triple', label: 'Water · meds · stretch', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['idle',      0.05],
          ['ding',      0.06],
          ['shrink',    0.05],
          ['glassIn',   0.06],
          ['drink',     0.10],
          ['glassOut',  0.05],
          ['pillIn',    0.06],
          ['take',      0.10],
          ['pillOut',   0.05],
          ['stretchIn', 0.06],
          ['hold',      0.12],
          ['stretchOut',0.06],
          ['grow',      0.07],
          ['done',      0.11],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'sleepy';
        if (ph.name === 'idle') eyeEmo = 'sleepy';
        else if (ph.name === 'ding') eyeEmo = 'surprised';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 36, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'eager';
        }
        else if (['glassIn','pillIn','stretchIn'].includes(ph.name)) { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'curious'; }
        else if (ph.name === 'drink') { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'take')  { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'thinking'; }
        else if (ph.name === 'hold')  { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (['glassOut','pillOut','stretchOut'].includes(ph.name)) { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 36, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'happy';
        } else eyeEmo = 'happy';

        const cx = W / 2 - 4, cy = CY + 8;
        const dingShake = ph.name === 'ding' ? Math.sin(ph.p * TAU * 8) * 4 : 0;

        const showGlass = ['glassIn','drink','glassOut'].includes(ph.name);
        const glassX = ph.name === 'glassIn' ? lerp(-60, cx, ease.out(ph.p))
                    : ph.name === 'glassOut' ? lerp(cx, -60, ease.in(ph.p))
                    : cx;
        const waterLevel = ph.name === 'drink' ? 1 - ph.p : 1;

        const showPill = ['pillIn','take','pillOut'].includes(ph.name);
        const pillX = ph.name === 'pillIn' ? lerp(W + 60, cx, ease.out(ph.p))
                   : ph.name === 'pillOut' ? lerp(cx, W + 60, ease.in(ph.p))
                   : cx;
        const pillsOut = ph.name === 'take' ? Math.floor(ph.p * 3) : 0;

        const showStretch = ['stretchIn','hold','stretchOut'].includes(ph.name);
        const stretchOp = ph.name === 'stretchIn' ? ease.out(ph.p)
                       : ph.name === 'stretchOut' ? 1 - ease.in(ph.p)
                       : 1;
        const stretchReach = ph.name === 'hold' ? 1 : 0.5;

        return (
          <g>
            {ph.name === 'ding' && (
              <g transform={`translate(${W / 2 + dingShake} ${CY})`}>
                <path d="M -16 -4 Q -16 -22, 0 -22 Q 16 -22, 16 -4 L 18 0 L -18 0 Z"
                      fill="var(--accent)" />
                <circle cx={0} cy={6} r={3} fill="var(--accent)" />
                {[0,1,2].map(i => {
                  const sp = ((t * 3) + i * 0.33) % 1;
                  return (
                    <circle key={i} cx={0} cy={-8} r={26 + sp * 16}
                            fill="none" stroke="var(--accent)" strokeWidth={2}
                            opacity={1 - sp} />
                  );
                })}
              </g>
            )}
            {showGlass && (
              <g transform={`translate(${glassX} ${cy})`}>
                <path d="M -18 -28 L 18 -28 L 14 26 L -14 26 Z"
                      fill="none" stroke="var(--eye)" strokeWidth={3} />
                <rect x={-16} y={-28 + (1 - waterLevel) * 50}
                      width={32} height={waterLevel * 50}
                      fill="var(--accent)" opacity={0.75} />
                <ellipse cx={0} cy={-28 + (1 - waterLevel) * 50}
                         rx={16} ry={2.5} fill="var(--accent)" opacity={0.9} />
              </g>
            )}
            {showPill && (
              <g transform={`translate(${pillX} ${cy})`}>
                <rect x={-18} y={-26} width={36} height={50} rx={3}
                      fill="var(--eye)" />
                <rect x={-20} y={-32} width={40} height={10} rx={2}
                      fill="var(--accent)" />
                <rect x={-12} y={-12} width={24} height={20} rx={2}
                      fill="var(--bg)" opacity={0.6} />
                <text x={0} y={4} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={9} fontWeight={800}
                      fill="var(--accent)">RX</text>
                {ph.name === 'take' && Array.from({ length: pillsOut + 1 }).map((_, i) => {
                  const drop = Math.min(1, ph.p * 3 - i);
                  if (drop < 0) return null;
                  const yOff = drop * 50;
                  return (
                    <g key={i} transform={`translate(${(i - 1) * 12} ${30 + yOff})`}>
                      <ellipse cx={0} cy={0} rx={5} ry={3} fill="var(--accent)" />
                      <line x1={-5} y1={0} x2={5} y2={0}
                            stroke="var(--bg)" strokeWidth={1} />
                    </g>
                  );
                })}
              </g>
            )}
            {showStretch && (() => {
              const sx = cx, headY = cy - 16;
              const reach = stretchReach * 14;
              return (
                <g stroke="var(--eye)" strokeWidth={3.5} strokeLinecap="round" fill="none"
                   opacity={stretchOp}>
                  <circle cx={sx} cy={headY} r={9}
                          fill="var(--eye)" stroke="none" />
                  <line x1={sx} y1={headY + 8} x2={sx + 1} y2={headY + 30} />
                  <line x1={sx} y1={headY + 14}
                        x2={sx - 22 - reach} y2={headY - 12 - reach * 0.4}
                        stroke="var(--accent)" />
                  <line x1={sx} y1={headY + 14}
                        x2={sx + 22 + reach} y2={headY - 12 - reach * 0.4}
                        stroke="var(--accent)" />
                  <line x1={sx + 1} y1={headY + 30}
                        x2={sx - 12 - reach * 0.4} y2={headY + 52} />
                  <line x1={sx + 1} y1={headY + 30}
                        x2={sx + 14 + reach * 0.4} y2={headY + 52} />
                </g>
              );
            })()}

            <g transform={`translate(${W / 2} ${STATUS_H + 8})`}>
              {[0,1,2].map(i => {
                const phaseIdx = ['glassIn','drink','glassOut'].includes(ph.name) ? 0
                              : ['pillIn','take','pillOut'].includes(ph.name) ? 1
                              : ['stretchIn','hold','stretchOut'].includes(ph.name) ? 2
                              : -1;
                const done = phaseIdx > i;
                const active = phaseIdx === i;
                return (
                  <circle key={i} cx={(i - 1) * 12} cy={0} r={3}
                          fill={done || active ? 'var(--accent)' : 'var(--eye)'}
                          opacity={done || active ? 1 : 0.35} />
                );
              })}
            </g>

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
            <ActLabel text={
              ph.name === 'idle'       ? 'TAKING IT EASY' :
              ph.name === 'ding'       ? 'REMINDER!' :
              ph.name === 'shrink'     ? 'LET\u2019S SEE' :
              ph.name === 'glassIn'    ? 'WATER · GLASS UP' :
              ph.name === 'drink'      ? 'SIPPING…' :
              ph.name === 'glassOut'   ? 'HYDRATED ✓' :
              ph.name === 'pillIn'     ? 'MEDS · BOTTLE UP' :
              ph.name === 'take'       ? 'TAKING…' :
              ph.name === 'pillOut'    ? 'DONE ✓' :
              ph.name === 'stretchIn'  ? 'STRETCH · NOW' :
              ph.name === 'hold'       ? 'HOLD IT' :
              ph.name === 'stretchOut' ? 'ALL THREE ✓' :
                                         'WELL CARED FOR'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   VIDEO — bespoke (14s)
   bored → screen slides in → play button glows → frame plays
   (mini scenes) → buffer hiccup → resume → end card
============================================================ */
cats.video = {
  label: 'Video',
  desc: 'Player loads → frames play → buffer → resume → end.',
  kind: 'scene',
  tone: 'rose',
  variants: [
    { id: 'video-watch', label: 'Watch a clip', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['bored',    0.05],
          ['screenIn', 0.07],
          ['shrink',   0.05],
          ['playBtn',  0.07],
          ['frame1',   0.12],
          ['frame2',   0.12],
          ['buffer',   0.09],
          ['frame3',   0.12],
          ['endcard',  0.10],
          ['screenOut',0.07],
          ['grow',     0.07],
          ['done',     0.07],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'sleepy';
        if (ph.name === 'bored') eyeEmo = 'sleepy';
        else if (ph.name === 'screenIn') eyeEmo = 'curious';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 36, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'eager';
        }
        else if (ph.name === 'playBtn') { eyeCx = 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'eager'; }
        else if (['frame1','frame2','frame3'].includes(ph.name)) { eyeCx = 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'buffer')  { eyeCx = 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'thinking'; }
        else if (ph.name === 'endcard') { eyeCx = 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'love'; }
        else if (ph.name === 'screenOut') { eyeCx = 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(36, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        } else eyeEmo = 'satisfied';

        const screenCx = W / 2 - 8, screenCy = CY + 4;
        const sW = 160, sH = 100;
        const showScreen = !['bored'].includes(ph.name);
        const screenScale = ph.name === 'screenIn' ? ease.out(ph.p)
                         : ph.name === 'screenOut' ? 1 - ease.in(ph.p)
                         : 1;

        const videoPhases = ['playBtn','frame1','frame2','buffer','frame3','endcard'];
        const vIdx = videoPhases.indexOf(ph.name);
        const vPct = vIdx >= 0 ? (vIdx + ph.p) / videoPhases.length : 0;

        return (
          <g>
            {showScreen && (
              <g transform={`translate(${screenCx} ${screenCy}) scale(${screenScale})`}>
                <rect x={-sW / 2 - 6} y={-sH / 2 - 6}
                      width={sW + 12} height={sH + 12} rx={6}
                      fill="var(--eye)" />
                <rect x={-sW / 2} y={-sH / 2}
                      width={sW} height={sH} rx={2}
                      fill="var(--bg)" />
                <rect x={-14} y={sH / 2 + 6}
                      width={28} height={8} rx={2}
                      fill="var(--eye)" />

                {ph.name === 'playBtn' && (() => {
                  const glow = 0.7 + Math.sin(ph.p * TAU * 2) * 0.3;
                  return (
                    <g opacity={glow}>
                      <circle cx={0} cy={0} r={22}
                              fill="none" stroke="var(--accent)" strokeWidth={2.5} />
                      <path d="M -8 -10 L 12 0 L -8 10 Z" fill="var(--accent)" />
                    </g>
                  );
                })()}
                {ph.name === 'frame1' && (
                  <g>
                    <rect x={-sW / 2} y={-sH / 2} width={sW} height={sH / 2}
                          fill="var(--accent)" opacity={0.35} />
                    <rect x={-sW / 2} y={0} width={sW} height={sH / 2}
                          fill="var(--accent)" opacity={0.18} />
                    <circle cx={-40} cy={-20} r={14} fill="var(--accent)" />
                    <polygon points="0,0 20,-30 40,0" fill="var(--accent)" opacity={0.6} />
                    <polygon points="-30,0 -10,-20 10,0" fill="var(--accent)" opacity={0.6} />
                  </g>
                )}
                {ph.name === 'frame2' && (
                  <g>
                    {[-3,-2,-1,0,1,2,3].map(i => {
                      const h = 24 + ((i * 17 + 51) % 24);
                      return (
                        <rect key={i} x={i * 20 - 8} y={sH / 2 - h}
                              width={16} height={h}
                              fill="var(--accent)" opacity={0.7} />
                      );
                    })}
                    <circle cx={30} cy={-20} r={8} fill="var(--accent)" />
                  </g>
                )}
                {ph.name === 'buffer' && (
                  <g>
                    <circle cx={0} cy={0} r={18}
                            fill="none" stroke="var(--accent)" strokeWidth={3}
                            strokeDasharray="60 60"
                            transform={`rotate(${ph.p * 1080})`} opacity={0.85} />
                    <text x={0} y={28} textAnchor="middle"
                          fontFamily="ui-monospace, Menlo, monospace"
                          fontSize={9} fontWeight={700}
                          fill="var(--accent)" letterSpacing={2}>BUFFERING</text>
                  </g>
                )}
                {ph.name === 'frame3' && (() => {
                  const wave = Math.sin(t * TAU * 3) * 10;
                  return (
                    <g stroke="var(--accent)" strokeWidth={3} fill="none" strokeLinecap="round">
                      <circle cx={-30} cy={-10} r={8} fill="var(--accent)" stroke="none" />
                      <line x1={-30} y1={-2} x2={-30} y2={20} />
                      <line x1={-30} y1={4} x2={-44} y2={-2 + wave} />
                      <line x1={-30} y1={4} x2={-16} y2={-2 - wave} />
                      <circle cx={20} cy={-6} r={8} fill="var(--accent)" stroke="none" />
                      <line x1={20} y1={2} x2={20} y2={22} />
                      <line x1={20} y1={8} x2={6} y2={2 - wave} />
                      <line x1={20} y1={8} x2={34} y2={2 + wave} />
                    </g>
                  );
                })()}
                {ph.name === 'endcard' && (
                  <g>
                    <text x={0} y={-6} textAnchor="middle"
                          fontFamily="ui-monospace, Menlo, monospace"
                          fontSize={14} fontWeight={800}
                          fill="var(--accent)" letterSpacing={3}>THE END</text>
                    <text x={0} y={14} textAnchor="middle"
                          fontFamily="ui-monospace, Menlo, monospace"
                          fontSize={8} fontWeight={700}
                          fill="var(--accent)" opacity={0.7} letterSpacing={2}>♥ THANKS ♥</text>
                  </g>
                )}

                {!['playBtn','endcard'].includes(ph.name) && (
                  <g transform={`translate(0 ${sH / 2 - 8})`}>
                    <rect x={-sW / 2 + 8} y={-2} width={sW - 16} height={3}
                          rx={1.5} fill="var(--eye)" opacity={0.3} />
                    <rect x={-sW / 2 + 8} y={-2} width={(sW - 16) * vPct} height={3}
                          rx={1.5} fill="var(--accent)" />
                    <circle cx={-sW / 2 + 8 + (sW - 16) * vPct} cy={-0.5}
                            r={3} fill="var(--accent)" />
                  </g>
                )}
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
            <ActLabel text={
              ph.name === 'bored'     ? 'NOTHING TO DO' :
              ph.name === 'screenIn'  ? 'A VIDEO!' :
              ph.name === 'shrink'    ? 'WATCHING…' :
              ph.name === 'playBtn'   ? 'PLAY ▶' :
              ph.name === 'frame1'    ? 'SCENE 1 · LANDSCAPE' :
              ph.name === 'frame2'    ? 'SCENE 2 · CITY' :
              ph.name === 'buffer'    ? 'BUFFERING…' :
              ph.name === 'frame3'    ? 'SCENE 3 · FRIENDS' :
              ph.name === 'endcard'   ? 'THE END' :
              ph.name === 'screenOut' ? 'NICE CLIP' :
                                        'WHAT NEXT?'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   LOCK — bespoke (14s)
   curious → padlock drops in → fingerprint scan →
   FAIL (red shake) → retry → SUCCESS → shackle pops → unlock
============================================================ */
cats.lock = {
  label: 'Lock',
  desc: 'Padlock drops → scan → fail → retry → unlock.',
  kind: 'scene',
  tone: 'green',
  variants: [
    { id: 'lock-bio', label: 'Fingerprint unlock', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['ask',       0.06],
          ['lockIn',    0.07],
          ['shrink',    0.05],
          ['scan1',     0.10],
          ['fail',      0.08],
          ['retry',     0.04],
          ['scan2',     0.12],
          ['success',   0.07],
          ['shackleUp', 0.08],
          ['open',      0.10],
          ['lockOut',   0.07],
          ['grow',      0.06],
          ['done',      0.10],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'ask') eyeEmo = 'curious';
        else if (ph.name === 'lockIn') eyeEmo = 'eager';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 36, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'thinking';
        }
        else if (ph.name === 'scan1')     { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'thinking'; }
        else if (ph.name === 'fail')      { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'sad'; }
        else if (ph.name === 'retry')     { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'eager'; }
        else if (ph.name === 'scan2')     { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'thinking'; }
        else if (ph.name === 'success')   { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'shackleUp') { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'surprised'; }
        else if (ph.name === 'open')      { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'excited'; }
        else if (ph.name === 'lockOut')   { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 36, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        } else eyeEmo = 'satisfied';

        const cx = W / 2 - 8, cy = CY + 12;
        const lockRestY = cy;
        const lockY = ph.name === 'lockIn' ? lerp(-80, lockRestY, ease.out(ph.p))
                   : ph.name === 'lockOut' ? lerp(lockRestY, -80, ease.in(ph.p))
                   : !['ask'].includes(ph.name) ? lockRestY
                   : null;
        const showLock = lockY !== null;
        const shakeX = ph.name === 'fail' ? Math.sin(ph.p * TAU * 10) * 4 : 0;
        const failTint = ph.name === 'fail';
        const successTint = ['success','shackleUp','open','lockOut'].includes(ph.name);

        const shackleLift = ph.name === 'shackleUp' ? lerp(0, 16, ease.out(ph.p))
                         : ['open','lockOut'].includes(ph.name) ? 16 : 0;
        const shackleTilt = ph.name === 'open' ? lerp(0, 25, ease.out(ph.p))
                         : ph.name === 'lockOut' ? 25 : 0;

        const fillColor = failTint ? 'var(--tone-red)'
                       : successTint ? 'var(--accent)'
                       : 'var(--eye)';

        return (
          <g>
            {showLock && (
              <g transform={`translate(${cx + shakeX} ${lockY})`}>
                <g transform={`translate(0 ${-shackleLift}) rotate(${shackleTilt} -16 -20)`}>
                  <path d="M -22 -2 L -22 -28 Q -22 -44, 0 -44 Q 22 -44, 22 -28 L 22 -2"
                        fill="none" stroke={fillColor} strokeWidth={6}
                        strokeLinecap="round" />
                </g>
                <rect x={-28} y={-4} width={56} height={48} rx={6}
                      fill={fillColor} />
                {!['shackleUp','open','lockOut'].includes(ph.name) && (
                  <g transform="translate(0 20)">
                    {[14, 10, 6].map((r, i) => {
                      const scanProg = ph.name === 'scan1' ? ph.p
                                    : ph.name === 'scan2' ? ph.p
                                    : ph.name === 'fail' ? 1 - ph.p
                                    : 0;
                      const lit = scanProg >= (i + 1) / 3.5;
                      return (
                        <path key={i}
                              d={`M ${-r} 0 Q ${-r} ${-r * 0.6}, 0 ${-r * 0.6} Q ${r} ${-r * 0.6}, ${r} 0`}
                              fill="none"
                              stroke={lit ? 'var(--bg)' : 'rgba(0,0,0,0.4)'}
                              strokeWidth={2}
                              strokeLinecap="round" />
                      );
                    })}
                  </g>
                )}
                {ph.name === 'success' && (
                  <g transform="translate(0 20)" opacity={ease.out(ph.p)}>
                    <path d="M -8 0 L -2 6 L 10 -8"
                          stroke="var(--bg)" strokeWidth={3.5}
                          fill="none" strokeLinecap="round" />
                  </g>
                )}
                {ph.name === 'fail' && (
                  <g transform="translate(0 20)">
                    <line x1={-7} y1={-7} x2={7} y2={7}
                          stroke="var(--bg)" strokeWidth={3.5} strokeLinecap="round" />
                    <line x1={7} y1={-7} x2={-7} y2={7}
                          stroke="var(--bg)" strokeWidth={3.5} strokeLinecap="round" />
                  </g>
                )}
              </g>
            )}
            {(ph.name === 'scan1' || ph.name === 'scan2') && (
              <g transform={`translate(${cx} ${cy})`}>
                <line x1={-30} y1={20 + Math.sin(ph.p * TAU * 2) * 12}
                      x2={30} y2={20 + Math.sin(ph.p * TAU * 2) * 12}
                      stroke="var(--accent)" strokeWidth={1.5}
                      opacity={0.6} />
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
            <ActLabel text={
              ph.name === 'ask'       ? 'LOCKED?' :
              ph.name === 'lockIn'    ? 'A PADLOCK' :
              ph.name === 'shrink'    ? 'WHO GOES THERE' :
              ph.name === 'scan1'     ? 'SCANNING…' :
              ph.name === 'fail'      ? 'NOT RECOGNIZED ✕' :
              ph.name === 'retry'     ? 'TRY AGAIN' :
              ph.name === 'scan2'     ? 'SCANNING…' :
              ph.name === 'success'   ? 'MATCH ✓' :
              ph.name === 'shackleUp' ? 'SHACKLE UP' :
              ph.name === 'open'      ? 'UNLOCKED' :
              ph.name === 'lockOut'   ? 'ACCESS GRANTED' :
                                        'WELCOME IN'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   FLASHLIGHT — bespoke (14s)
   dark → torch click on → beam sweeps → reveals 3 finds
   (gem, key, star) → torch click off
============================================================ */
cats.flashlight = {
  label: 'Flashlight',
  desc: 'Dark → click on → beam sweeps → reveal 3 finds → off.',
  kind: 'scene',
  tone: 'warm',
  variants: [
    { id: 'flashlight-sweep', label: 'Sweep & reveal', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['dark',     0.07],
          ['torchIn',  0.07],
          ['shrink',   0.05],
          ['click',    0.05],
          ['sweep1',   0.12],
          ['reveal1',  0.07],
          ['sweep2',   0.12],
          ['reveal2',  0.07],
          ['sweep3',   0.12],
          ['reveal3',  0.07],
          ['click2',   0.05],
          ['torchOut', 0.05],
          ['grow',     0.05],
          ['done',     0.04],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'dark') eyeEmo = 'curious';
        else if (ph.name === 'torchIn') eyeEmo = 'eager';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 34, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'thinking';
        }
        else if (ph.name === 'click') { eyeCx = 34; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (['sweep1','sweep2','sweep3'].includes(ph.name)) { eyeCx = 34; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'thinking'; }
        else if (['reveal1','reveal2','reveal3'].includes(ph.name)) { eyeCx = 34; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'surprised'; }
        else if (ph.name === 'click2')   { eyeCx = 34; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'torchOut') { eyeCx = 34; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(34, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        } else eyeEmo = 'satisfied';

        const torchX = ph.name === 'torchIn' ? lerp(-40, 50, ease.out(ph.p))
                    : ph.name === 'torchOut' ? lerp(50, -40, ease.in(ph.p))
                    : 50;
        const torchY = 70;
        const torchOn = ['click','sweep1','reveal1','sweep2','reveal2','sweep3','reveal3'].includes(ph.name);

        const ITEMS = [
          { x: W * 0.45, y: H - 60, kind: 'gem' },
          { x: W * 0.70, y: 90,     kind: 'key' },
          { x: W * 0.55, y: H - 40, kind: 'star' },
        ];

        let beamX, beamY;
        if (ph.name === 'click') { beamX = ITEMS[0].x - 50; beamY = ITEMS[0].y; }
        else if (ph.name === 'sweep1') {
          beamX = lerp(W * 0.2, ITEMS[0].x, ease.inOut(ph.p));
          beamY = lerp(CY, ITEMS[0].y, ease.inOut(ph.p));
        } else if (ph.name === 'reveal1') { beamX = ITEMS[0].x; beamY = ITEMS[0].y; }
        else if (ph.name === 'sweep2') {
          beamX = lerp(ITEMS[0].x, ITEMS[1].x, ease.inOut(ph.p));
          beamY = lerp(ITEMS[0].y, ITEMS[1].y, ease.inOut(ph.p));
        } else if (ph.name === 'reveal2') { beamX = ITEMS[1].x; beamY = ITEMS[1].y; }
        else if (ph.name === 'sweep3') {
          beamX = lerp(ITEMS[1].x, ITEMS[2].x, ease.inOut(ph.p));
          beamY = lerp(ITEMS[1].y, ITEMS[2].y, ease.inOut(ph.p));
        } else if (ph.name === 'reveal3' || ph.name === 'click2') { beamX = ITEMS[2].x; beamY = ITEMS[2].y; }

        const r1on = ['reveal1','sweep2','reveal2','sweep3','reveal3','click2','torchOut'].includes(ph.name);
        const r2on = ['reveal2','sweep3','reveal3','click2','torchOut'].includes(ph.name);
        const r3on = ['reveal3','click2','torchOut'].includes(ph.name);

        const tX = torchX + 12, tY = torchY + 2;
        const ang = (beamX !== undefined) ? Math.atan2(beamY - tY, beamX - tX) : 0;

        return (
          <g>
            {ITEMS.map((it, i) => {
              const isRevealed = (i === 0 && r1on) || (i === 1 && r2on) || (i === 2 && r3on);
              const opacity = isRevealed ? 1 : 0.07;
              return (
                <g key={i} transform={`translate(${it.x} ${it.y})`} opacity={opacity}>
                  {it.kind === 'gem' && (
                    <g>
                      <polygon points="-10,0 -6,-10 6,-10 10,0 0,12" fill="var(--accent)" />
                      <line x1={-6} y1={-10} x2={6} y2={-10}
                            stroke="var(--bg)" strokeWidth={1.5} />
                      <line x1={-10} y1={0} x2={10} y2={0}
                            stroke="var(--bg)" strokeWidth={1} opacity={0.5} />
                    </g>
                  )}
                  {it.kind === 'key' && (
                    <g>
                      <circle cx={-6} cy={0} r={7}
                              fill="none" stroke="var(--accent)" strokeWidth={2.5} />
                      <rect x={0} y={-2} width={16} height={4} fill="var(--accent)" />
                      <rect x={10} y={2} width={3} height={5} fill="var(--accent)" />
                      <rect x={14} y={2} width={3} height={5} fill="var(--accent)" />
                    </g>
                  )}
                  {it.kind === 'star' && (
                    <path d={starPath(0, 0, 10, 1)} fill="var(--accent)" />
                  )}
                </g>
              );
            })}

            {!['dark'].includes(ph.name) && (
              <g transform={`translate(${torchX} ${torchY})`}>
                <rect x={-14} y={-4} width={20} height={10} rx={2}
                      fill="var(--eye)" />
                <path d="M 6 -7 L 18 -10 L 18 12 L 6 9 Z"
                      fill="var(--eye)" />
                <circle cx={18} cy={1} r={2.5} fill="var(--accent)" opacity={torchOn ? 1 : 0.35} />
              </g>
            )}

            {torchOn && beamX !== undefined && (() => {
              const len = Math.hypot(beamX - tX, beamY - tY);
              const halfW = Math.max(20, len * 0.16);
              return (
                <g transform={`translate(${tX} ${tY}) rotate(${ang * 180 / Math.PI})`}>
                  <defs>
                    <radialGradient id="torchBeam" cx="0%" cy="50%" r="100%">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <path d={`M 0 0 L ${len} ${-halfW} L ${len} ${halfW} Z`}
                        fill="url(#torchBeam)" opacity={0.85} />
                  <circle cx={len} cy={0} r={halfW * 0.8}
                          fill="var(--accent)" opacity={0.2} />
                </g>
              );
            })()}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
            <ActLabel text={
              ph.name === 'dark'     ? 'IT\u2019S DARK…' :
              ph.name === 'torchIn'  ? 'GRAB A TORCH' :
              ph.name === 'shrink'   ? 'SEARCHING…' :
              ph.name === 'click'    ? 'CLICK · ON' :
              ph.name === 'sweep1'   ? 'SWEEP →' :
              ph.name === 'reveal1'  ? 'A GEM!' :
              ph.name === 'sweep2'   ? 'SWEEP →' :
              ph.name === 'reveal2'  ? 'A KEY!' :
              ph.name === 'sweep3'   ? 'SWEEP →' :
              ph.name === 'reveal3'  ? 'A STAR!' :
              ph.name === 'click2'   ? 'CLICK · OFF' :
              ph.name === 'torchOut' ? 'TREASURE FOUND' :
                                       '3 FINDS'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   PODCAST — bespoke (14s)
   curious → studio mic descends → ON-AIR sign lights →
   waveform talks → chapter markers tick → outro music → off-air
============================================================ */
cats.podcast = {
  label: 'Podcast',
  desc: 'Mic drops → ON AIR → waveform → chapters → off-air.',
  kind: 'scene',
  tone: 'purple',
  variants: [
    { id: 'podcast-onair', label: 'Live on air', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['idle',     0.06],
          ['micIn',    0.07],
          ['shrink',   0.05],
          ['onair',    0.07],
          ['talk1',    0.14],
          ['chapter',  0.04],
          ['talk2',    0.14],
          ['chapter2', 0.04],
          ['outro',    0.10],
          ['offair',   0.07],
          ['micOut',   0.07],
          ['grow',     0.07],
          ['done',     0.08],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'idle') eyeEmo = 'curious';
        else if (ph.name === 'micIn') eyeEmo = 'eager';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 36, ease.inOut(ph.p));
          eyeCy = lerp(CY, H - 30, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else if (ph.name === 'onair')   { eyeCx = 36; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'eager'; }
        else if (['talk1','talk2'].includes(ph.name)) { eyeCx = 36; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (['chapter','chapter2'].includes(ph.name)) { eyeCx = 36; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'surprised'; }
        else if (['outro','offair','micOut'].includes(ph.name)) { eyeCx = 36; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(36, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(H - 30, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        } else eyeEmo = 'satisfied';

        const micRestY = 60;
        const micY = ph.name === 'micIn' ? lerp(-60, micRestY, ease.out(ph.p))
                  : ph.name === 'micOut' ? lerp(micRestY, -60, ease.in(ph.p))
                  : !['idle'].includes(ph.name) ? micRestY
                  : null;
        const micCx = W / 2 + 30;

        const onairActive = ['onair','talk1','chapter','talk2','chapter2','outro'].includes(ph.name);
        const onairBlink = onairActive ? (Math.sin(t * TAU * 3) > 0 ? 1 : 0.3) : 0;

        const chapterNum = ['idle','micIn','shrink','onair','talk1'].includes(ph.name) ? 1
                       : ['chapter','talk2'].includes(ph.name) ? 2
                       : 3;

        const talking = ['talk1','talk2'].includes(ph.name);
        const NBARS = 18;

        return (
          <g>
            {micY !== null && [-1, 1].map(s => (
              <g key={s} transform={`translate(${W / 2 + s * 120} ${CY - 6})`}
                 opacity={0.35}>
                {[0,1,2,3].map(i => (
                  <rect key={i} x={-12} y={-28 + i * 18}
                        width={24} height={14} rx={2}
                        fill="none" stroke="var(--eye)" strokeWidth={1.5} />
                ))}
              </g>
            ))}

            {micY !== null && (
              <g transform={`translate(${micCx} ${micY})`}>
                <line x1={0} y1={-80} x2={0} y2={-4}
                      stroke="var(--eye)" strokeWidth={3} />
                <ellipse cx={0} cy={0} rx={20} ry={4}
                         fill="none" stroke="var(--eye)" strokeWidth={2} />
                <rect x={-10} y={-2} width={20} height={28} rx={10}
                      fill="var(--accent)" />
                {[0,1,2].map(i => (
                  <line key={i} x1={-7} y1={3 + i * 5} x2={7} y2={3 + i * 5}
                        stroke="var(--bg)" strokeWidth={1} opacity={0.6} />
                ))}
                <circle cx={0} cy={-4} r={3} fill="var(--eye)" />
              </g>
            )}

            {onairActive && (
              <g transform={`translate(${W / 2} ${STATUS_H + 32})`}>
                <rect x={-50} y={-14} width={100} height={28} rx={4}
                      fill="var(--accent)" opacity={0.25 + onairBlink * 0.5} />
                <rect x={-50} y={-14} width={100} height={28} rx={4}
                      fill="none" stroke="var(--accent)" strokeWidth={2}
                      opacity={onairBlink} />
                <circle cx={-36} cy={0} r={4} fill="var(--accent)"
                        opacity={onairBlink} />
                <text x={6} y={5} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={11} fontWeight={800}
                      fill="var(--accent)" letterSpacing={3}
                      opacity={onairBlink}>ON AIR</text>
              </g>
            )}

            {talking && (
              <g transform={`translate(${W / 2} ${CY + 60})`}>
                {Array.from({ length: NBARS }).map((_, i) => {
                  const x = (i - (NBARS - 1) / 2) * 9;
                  const seed = i * 13;
                  const speak = 0.4 + Math.abs(Math.sin(t * TAU * 3 + seed)) * 0.6;
                  const h = lerp(4, 30, speak);
                  return (
                    <rect key={i} x={x - 3} y={-h / 2}
                          width={6} height={h} rx={2}
                          fill="var(--accent)" opacity={0.85} />
                  );
                })}
              </g>
            )}

            {(ph.name === 'chapter' || ph.name === 'chapter2') && (
              <g transform={`translate(${W / 2} ${CY - 18})`}>
                <rect x={-44} y={-14} width={88} height={28} rx={4}
                      fill="var(--bg)" stroke="var(--accent)" strokeWidth={2}
                      opacity={1 - ph.p * 0.3} />
                <text x={0} y={4} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={10} fontWeight={800}
                      fill="var(--accent)" letterSpacing={2}>
                  CHAPTER {chapterNum}
                </text>
              </g>
            )}

            {ph.name === 'outro' && (
              <g transform={`translate(${W / 2} ${CY + 60})`}>
                {Array.from({ length: NBARS }).map((_, i) => {
                  const x = (i - (NBARS - 1) / 2) * 9;
                  const h = lerp(20, 2, ease.out(ph.p)) * (0.7 + (i % 3) * 0.15);
                  return (
                    <rect key={i} x={x - 3} y={-h / 2}
                          width={6} height={h} rx={2}
                          fill="var(--accent)" opacity={0.85 * (1 - ph.p)} />
                  );
                })}
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
            <ActLabel text={
              ph.name === 'idle'     ? 'TODAY\u2019S EPISODE?' :
              ph.name === 'micIn'    ? 'MIC LOWERED' :
              ph.name === 'shrink'   ? 'WE\u2019RE LIVE' :
              ph.name === 'onair'    ? 'ON AIR' :
              ph.name === 'talk1'    ? 'CHAPTER 1 · INTRO' :
              ph.name === 'chapter'  ? 'NEW CHAPTER' :
              ph.name === 'talk2'    ? 'CHAPTER 2 · TALK' :
              ph.name === 'chapter2' ? 'NEW CHAPTER' :
              ph.name === 'outro'    ? 'OUTRO MUSIC' :
              ph.name === 'offair'   ? 'OFF AIR' :
              ph.name === 'micOut'   ? 'EP. 247 DONE' :
                                       'THANKS FOR LISTENING'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   STOPWATCH — bespoke (14s)
   ready → stopwatch drops in → START → ticking up →
   LAP markers → ticking up → STOP → result
============================================================ */
cats.stopwatch = {
  label: 'Stopwatch',
  desc: 'Drop in → start → tick → lap → stop → result.',
  kind: 'scene',
  tone: 'orange',
  variants: [
    { id: 'stopwatch-lap', label: 'Lap timer', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['ready',    0.05],
          ['watchIn',  0.07],
          ['shrink',   0.05],
          ['start',    0.06],
          ['run1',     0.18],
          ['lap1',     0.04],
          ['run2',     0.18],
          ['lap2',     0.04],
          ['run3',     0.14],
          ['stop',     0.07],
          ['result',   0.08],
          ['watchOut', 0.05],
          ['grow',     0.05],
          ['done',     0.04],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'eager';
        if (ph.name === 'ready') eyeEmo = 'eager';
        else if (ph.name === 'watchIn') eyeEmo = 'curious';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 36, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else if (ph.name === 'start')    { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'surprised'; }
        else if (['run1','run2','run3'].includes(ph.name)) { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'thinking'; }
        else if (['lap1','lap2'].includes(ph.name)) { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'surprised'; }
        else if (ph.name === 'stop')     { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'result')   { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'excited'; }
        else if (ph.name === 'watchOut') { eyeCx = W - 36; eyeCy = STATUS_H + 24; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 36, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        } else eyeEmo = 'satisfied';

        const cx = W / 2 - 8, cy = CY + 8, R = 56;
        const watchRestY = cy;
        const watchY = ph.name === 'watchIn' ? lerp(H + 80, watchRestY, ease.out(ph.p))
                    : ph.name === 'watchOut' ? lerp(watchRestY, H + 80, ease.in(ph.p))
                    : !['ready'].includes(ph.name) ? watchRestY
                    : null;

        let elapsed = 0;
        if (ph.name === 'run1') elapsed = ph.p * 23;
        else if (ph.name === 'lap1') elapsed = 23;
        else if (ph.name === 'run2') elapsed = 23 + ph.p * 28;
        else if (ph.name === 'lap2') elapsed = 51;
        else if (ph.name === 'run3') elapsed = 51 + ph.p * 22;
        else if (['stop','result','watchOut','grow','done'].includes(ph.name)) elapsed = 73.4;

        const minutes = Math.floor(elapsed / 60);
        const seconds = (elapsed % 60).toFixed(1);
        const secStr = String(seconds).padStart(4, '0');
        const timeStr = `${String(minutes).padStart(2,'0')}:${secStr}`;

        const sweepAng = (elapsed % 60) / 60 * TAU;

        const laps = [];
        if (['lap1','run2','lap2','run3','stop','result','watchOut','grow','done'].includes(ph.name)) laps.push({ n: 1, time: '00:23.0' });
        if (['lap2','run3','stop','result','watchOut','grow','done'].includes(ph.name)) laps.push({ n: 2, time: '00:28.0' });
        if (['stop','result','watchOut','grow','done'].includes(ph.name)) laps.push({ n: 3, time: '00:22.4' });

        const lapFlash = ph.name === 'lap1' || ph.name === 'lap2'
          ? (Math.sin(ph.p * TAU * 6) > 0 ? 1 : 0.3) : 1;

        const showWatch = watchY !== null;
        const running = ['run1','run2','run3'].includes(ph.name);

        return (
          <g>
            {showWatch && (
              <g transform={`translate(${cx} ${watchY})`}>
                <rect x={-4} y={-R - 8} width={8} height={6} fill="var(--accent)" />
                <rect x={-R - 4} y={-12} width={5} height={8} fill="var(--accent)" />
                <rect x={R - 1} y={-12} width={5} height={8} fill="var(--accent)" />
                <circle cx={0} cy={0} r={R}
                        fill="var(--bg)" stroke="var(--accent)" strokeWidth={4} />
                <circle cx={0} cy={0} r={R - 8}
                        fill="none" stroke="var(--eye)" strokeWidth={1.5} opacity={0.5} />
                {Array.from({ length: 12 }).map((_, i) => {
                  const a = (i / 12) * TAU - Math.PI / 2;
                  return (
                    <line key={i}
                          x1={Math.cos(a) * (R - 4)} y1={Math.sin(a) * (R - 4)}
                          x2={Math.cos(a) * (R - 10)} y2={Math.sin(a) * (R - 10)}
                          stroke="var(--eye)" strokeWidth={i % 3 === 0 ? 2 : 1}
                          opacity={0.7} />
                  );
                })}
                <text x={0} y={-6} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={12} fontWeight={800}
                      fill="var(--accent)" letterSpacing={1.5}>{timeStr}</text>
                <line x1={0} y1={0}
                      x2={Math.cos(sweepAng - Math.PI / 2) * (R - 12)}
                      y2={Math.sin(sweepAng - Math.PI / 2) * (R - 12)}
                      stroke="var(--accent)" strokeWidth={2.5}
                      strokeLinecap="round" />
                <circle cx={0} cy={0} r={3} fill="var(--accent)" />
                <text x={0} y={26} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={8} fontWeight={700}
                      fill="var(--eye)" letterSpacing={2}>
                  {running ? 'RUNNING' : (['stop','result','watchOut'].includes(ph.name) ? 'STOPPED' : 'READY')}
                </text>
              </g>
            )}

            {(ph.name === 'lap1' || ph.name === 'lap2') && (
              <g transform={`translate(${W / 2} ${STATUS_H + 30})`} opacity={lapFlash}>
                <rect x={-48} y={-12} width={96} height={24} rx={4}
                      fill="var(--accent)" />
                <text x={0} y={4} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={11} fontWeight={800}
                      fill="var(--bg)" letterSpacing={3}>
                  LAP {ph.name === 'lap1' ? 1 : 2}
                </text>
              </g>
            )}

            {laps.length > 0 && !['ready','watchIn','shrink','watchOut'].includes(ph.name) && (
              <g transform={`translate(20 ${H - 70})`}>
                {laps.map((lp, i) => (
                  <g key={i} transform={`translate(0 ${i * 14})`}>
                    <text x={0} y={0}
                          fontFamily="ui-monospace, Menlo, monospace"
                          fontSize={9} fontWeight={700}
                          fill="var(--eye)" opacity={0.65}
                          letterSpacing={1}>L{lp.n}</text>
                    <text x={26} y={0}
                          fontFamily="ui-monospace, Menlo, monospace"
                          fontSize={10} fontWeight={800}
                          fill="var(--accent)">{lp.time}</text>
                  </g>
                ))}
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
            <ActLabel text={
              ph.name === 'ready'    ? 'ON YOUR MARKS' :
              ph.name === 'watchIn'  ? 'STOPWATCH READY' :
              ph.name === 'shrink'   ? 'GET SET…' :
              ph.name === 'start'    ? 'GO!' :
              ph.name === 'run1'     ? 'RUNNING…' :
              ph.name === 'lap1'     ? 'LAP 1' :
              ph.name === 'run2'     ? 'RUNNING…' :
              ph.name === 'lap2'     ? 'LAP 2' :
              ph.name === 'run3'     ? 'RUNNING…' :
              ph.name === 'stop'     ? 'STOP!' :
              ph.name === 'result'   ? `TOTAL · ${timeStr}` :
              ph.name === 'watchOut' ? '3 LAPS DONE' :
                                       'NICE PACE'
            } />
          </g>
        );
      } },
  ],
};

// =============================================================
// Authoritative category order — single source of truth for the viewer.
// Every category is created by an earlier file (emotions + status) or by
// the scene-arc packs (scenes); this block only fixes the FINAL order.
// It is filtered to categories that actually exist, and appends any
// unlisted category at the end, so adding/removing a pack degrades
// gracefully. This runs last (just before app.jsx).
// =============================================================
(() => {
  const ORDER = [
    // emotions
    'normal', 'greet', 'happy', 'wink', 'sad', 'crying', 'angry', 'annoyed',
    'disgusted', 'surprised', 'scared', 'nervous', 'love', 'shy', 'embarrassed',
    'smug', 'proud', 'cool', 'mischievous', 'suspicious', 'sleepy', 'sleeping',
    'excited', 'confused', 'curious', 'bored', 'hungry', 'listening', 'thinking',
    'focused', 'determined', 'loading', 'charging', 'dizzy', 'dead', 'error', 'mute',
    // status flows
    'boot', 'network',
    // emotions added by emotion-pack-1..3
    'sick', 'cold', 'calm', 'playful', 'hot', 'lonely', 'grateful',
    'brave', 'dreamy', 'awe',
    // scenes — one cinematic arc each
    'weather', 'clock', 'music', 'timer', 'cooking', 'walking', 'celebrate', 'night',
    'fitness', 'call', 'message', 'camera', 'navigation', 'gift', 'coffee', 'plant',
    'morning', 'gaming', 'calendar', 'alarm', 'notification', 'birthday', 'reminder',
    'video', 'reading', 'smarthome', 'shopping', 'lock', 'delivery', 'flashlight',
    'podcast', 'stopwatch',
  ];
  const known = ORDER.filter((k) => k in cats);
  const extra = Object.keys(cats).filter((k) => !ORDER.includes(k));
  window.EMOTION_CATEGORY_KEYS = [...known, ...extra];
})();
