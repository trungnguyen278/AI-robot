// SPDX-License-Identifier: MIT
/* Bespoke narrative scenes (pack 1, v3).

   Each scene is now a *specific* mini-video with its own props, timing,
   and behavior — not just a generic "blink in, blink out" wrapper.

   Pattern per scene:
     1. Eyes (opening emotion) at center, full size
     2. A motivation beat — eyes look around / get curious
     3. Prop enters (from below / side) — eyes track it
     4. Eyes shrink to top-corner; prop owns the center
     5. The actual action plays out (≥5s)
     6. Prop exits the way it came
     7. Eyes grow back to center, closing emotion

   Overrides: alarm, birthday, gaming, reading (bespoke narratives).
   Plus shorter arc-style overrides for: notification, reminder, video.

   Loaded AFTER all pack files; reassigns cats.<key> in place.
*/

const {
  W, H, STATUS_H, CY, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, ease, pulse, blink,
  Eye, Eyes, heartPath, starPath, arcPath,
} = window.EmotionCore;

const { sceneArc, EmotionFace, TransformedFace, EMOTION_COLOR } = window.SceneArc;
const cats = window.EMOTION_CATEGORIES;

/* ============================================================
   Helpers
============================================================ */

// Smooth phase finder — returns { name, p } where name is the phase id
// and p is 0..1 progress within that phase. Phases is an array of
// [name, lengthNormalized] sums to 1.
function phases(t, list) {
  let acc = 0;
  for (const [name, len] of list) {
    if (t < acc + len || name === list[list.length - 1][0]) {
      return { name, p: clamp((t - acc) / len, 0, 1) };
    }
    acc += len;
  }
}

// Place + scale the robot's face at any spot. cx/cy = where the *center of
// the face* goes. scale = relative to native 320×240.
function PlacedFace({ cx, cy, scale, emotion, t }) {
  return (
    <g transform={`translate(${cx} ${cy})
                   scale(${scale})
                   translate(${-W / 2} ${-CY})`}>
      <EmotionFace emotion={emotion} t={t} />
    </g>
  );
}

// Bottom-of-screen status label (drawn on top of scene, faded by op).
function ActLabel({ text, op = 1 }) {
  return (
    <text x={W / 2} y={H - 12} textAnchor="middle"
          fontFamily="ui-monospace, Menlo, monospace"
          fontSize={11} fontWeight={700}
          fill="var(--eye)" letterSpacing={3}
          opacity={0.85 * op}>{text}</text>
  );
}

// Tiny floating Z's for sleeping scenes
function FloatingZs({ x, y, t, count = 3 }) {
  return [...Array(count)].map((_, i) => {
    const p = ((t * 0.5) + i * 0.33) % 1;
    return (
      <text key={i}
            x={x + i * 6 + p * 18}
            y={y - p * 22}
            fontFamily="ui-monospace, Menlo, monospace"
            fontSize={lerp(10, 18, p)} fontWeight={700}
            fill="var(--accent)" opacity={1 - p}>z</text>
    );
  });
}

/* ============================================================
   ALARM — bespoke narrative (12s)
   sleep → bell drops in → ring violently → bell exits → wake happy
============================================================ */
cats.alarm = {
  label: 'Alarm',
  desc: 'Wake / alert.',
  kind: 'scene',
  tone: 'red',
  variants: [
    { id: 'alarm-bell', label: 'Ringing bell', duration: 12000,
      render: (t) => {
        const ph = phases(t, [
          ['sleep',      0.13],
          ['bellEnter',  0.10],
          ['shrink',     0.07],
          ['ring',       0.40],
          ['bellExit',   0.10],
          ['grow',       0.07],
          ['wake',       0.13],
        ]);

        // Eye placement
        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'sleepy';
        if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 42, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.32, ease.inOut(ph.p));
          eyeEmo = 'surprised';
        } else if (ph.name === 'ring') {
          eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32;
          eyeEmo = 'surprised';
        } else if (ph.name === 'bellExit') {
          eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32;
          eyeEmo = 'satisfied';
        } else if (ph.name === 'grow') {
          eyeCx = lerp(W - 42, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.32, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        } else if (ph.name === 'wake') {
          eyeEmo = 'happy';
        } else if (ph.name === 'bellEnter') {
          eyeEmo = 'surprised';
        }

        // Bell position (drops from above)
        let bellY = null;
        if (ph.name === 'bellEnter')  bellY = lerp(-80, CY, ease.out(ph.p));
        else if (ph.name === 'shrink' || ph.name === 'ring') bellY = CY;
        else if (ph.name === 'bellExit') bellY = lerp(CY, H + 60, ease.in(ph.p));

        // Ring shake (only during ring)
        const ringT = ph.name === 'ring' ? ph.p : 0;
        const tilt = ph.name === 'ring' ? Math.sin(ringT * TAU * 12) * 18 : 0;
        const clapper = ph.name === 'ring' ? Math.sin(ringT * TAU * 12) * 3 : 0;

        return (
          <g>
            {/* Sleep state: Z's floating */}
            {ph.name === 'sleep' && (
              <FloatingZs x={W - 80} y={CY - 20} t={t} />
            )}

            {/* Bell */}
            {bellY !== null && (
              <g>
                <g transform={`translate(${W / 2} ${bellY}) rotate(${tilt})`}>
                  <path d="M -30 0 Q -30 -38, 0 -42 Q 30 -38, 30 0 L 36 6 L -36 6 Z"
                        fill="var(--eye)" />
                  <circle cx={clapper * 1.5} cy={14} r={5} fill="var(--eye)" />
                  <circle cx={0} cy={-44} r={5} fill="var(--eye)" />
                </g>
                {/* Sound waves only during ring */}
                {ph.name === 'ring' && [0, 1].map((i) => {
                  const p = ((ringT * 4) + i * 0.5) % 1;
                  return (
                    <g key={i} opacity={1 - p}>
                      <path d={`M ${W / 2 - 60 - p * 14} ${bellY - 6}
                                Q ${W / 2 - 70 - p * 14} ${bellY + 2},
                                ${W / 2 - 60 - p * 14} ${bellY + 10}`}
                            fill="none" stroke="var(--accent)" strokeWidth={3}
                            strokeLinecap="round" />
                      <path d={`M ${W / 2 + 60 + p * 14} ${bellY - 6}
                                Q ${W / 2 + 70 + p * 14} ${bellY + 2},
                                ${W / 2 + 60 + p * 14} ${bellY + 10}`}
                            fill="none" stroke="var(--accent)" strokeWidth={3}
                            strokeLinecap="round" />
                    </g>
                  );
                })}
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'sleep'      ? '06:29 · Zzz' :
              ph.name === 'bellEnter'  ? 'WAKE UP CALL' :
              ph.name === 'shrink'     ? 'WAKE UP CALL' :
              ph.name === 'ring'       ? 'RING RING!' :
              ph.name === 'bellExit'   ? '06:30 · OK!' :
              ph.name === 'grow'       ? 'I\'M UP' :
                                         'GOOD MORNING'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   BIRTHDAY — bespoke narrative (14s)
   eager eyes → notice something → cake rolls in →
   shrink to corner → candle lit → blow → flame out →
   cake exits → happy eyes
============================================================ */
cats.birthday = {
  label: 'Birthday',
  desc: 'Cake / candle / wish.',
  kind: 'scene',
  tone: 'rose',
  variants: [
    { id: 'birthday-cake', label: 'Cake + blow', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['eager',     0.10],
          ['notice',    0.07],
          ['cakeIn',    0.13],
          ['shrink',    0.06],
          ['light',     0.10],
          ['flicker',   0.18],
          ['blowO',     0.06],
          ['extinguish',0.06],
          ['cakeOut',   0.12],
          ['grow',      0.06],
          ['happy',     0.06],
        ]);

        // Eye state
        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'eager';
        if (ph.name === 'notice') {
          // look down towards where cake will appear
          eyeCx = W / 2; eyeCy = CY + ph.p * 8;
          eyeEmo = 'curious';
        } else if (ph.name === 'cakeIn') {
          eyeCy = CY + 8;
          eyeEmo = 'curious';
        } else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 50, ease.inOut(ph.p));
          eyeCy = lerp(CY + 8, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.32, ease.inOut(ph.p));
          eyeEmo = 'excited';
        } else if (ph.name === 'light' || ph.name === 'flicker') {
          eyeCx = 50; eyeCy = STATUS_H + 24; eyeScale = 0.32;
          eyeEmo = 'excited';
        } else if (ph.name === 'blowO') {
          eyeCx = 50; eyeCy = STATUS_H + 24; eyeScale = 0.32;
          eyeEmo = 'surprised';
        } else if (ph.name === 'extinguish') {
          eyeCx = 50; eyeCy = STATUS_H + 24; eyeScale = 0.32;
          eyeEmo = 'satisfied';
        } else if (ph.name === 'cakeOut') {
          eyeCx = 50; eyeCy = STATUS_H + 24; eyeScale = 0.32;
          eyeEmo = 'satisfied';
        } else if (ph.name === 'grow') {
          eyeCx = lerp(50, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.32, 1, ease.inOut(ph.p));
          eyeEmo = 'happy';
        } else if (ph.name === 'happy') {
          eyeEmo = 'happy';
        }

        // Cake Y position
        const cakeBaseY = H + 80; // off-screen
        const cakeRestY = 0;       // settled
        let cakeY = null;
        if (ph.name === 'cakeIn') {
          cakeY = lerp(cakeBaseY, cakeRestY, ease.out(ph.p));
        } else if (['shrink','light','flicker','blowO','extinguish'].includes(ph.name)) {
          cakeY = cakeRestY;
        } else if (ph.name === 'cakeOut') {
          cakeY = lerp(cakeRestY, cakeBaseY, ease.in(ph.p));
        }

        // Candle state
        const candleLit = ph.name === 'light' ? ph.p > 0.3
                       : ph.name === 'flicker' ? true
                       : ph.name === 'blowO' ? true
                       : ph.name === 'extinguish' ? ph.p < 0.4
                       : false;
        const flick = 0.7 + Math.sin(t * TAU * 8) * 0.3;
        const candleScale = ph.name === 'light'
          ? clamp((ph.p - 0.3) / 0.7, 0, 1) : 1;
        const smokeOp = ph.name === 'extinguish' ? clamp(ph.p / 0.4, 0, 1) : 0;

        return (
          <g>
            {cakeY !== null && (
              <g transform={`translate(0 ${cakeY})`}>
                {/* plate */}
                <ellipse cx={W / 2} cy={H - 20} rx={88} ry={6}
                         fill="var(--eye)" opacity={0.5} />
                {/* bottom tier */}
                <rect x={W / 2 - 76} y={H - 70} width={152} height={42} rx={4}
                      fill="var(--eye)" />
                <path d={`M ${W / 2 - 76} ${H - 60}
                          Q ${W / 2 - 60} ${H - 50}, ${W / 2 - 44} ${H - 60}
                          T ${W / 2 - 12} ${H - 60}
                          T ${W / 2 + 20} ${H - 60}
                          T ${W / 2 + 52} ${H - 60}
                          T ${W / 2 + 76} ${H - 60}`}
                      fill="none" stroke="var(--accent)" strokeWidth={4} />
                {/* top tier */}
                <rect x={W / 2 - 50} y={H - 110} width={100} height={36} rx={4}
                      fill="var(--eye)" />
                {/* candle */}
                <rect x={W / 2 - 3} y={H - 138} width={6} height={28} rx={1}
                      fill="var(--accent)" />
                {/* flame */}
                {candleLit && (
                  <g transform={`scale(${candleScale})`}
                     style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                    <ellipse cx={W / 2} cy={H - 144}
                             rx={5 * flick} ry={9 * flick}
                             fill="var(--accent)" />
                    <ellipse cx={W / 2} cy={H - 144}
                             rx={2.5 * flick} ry={5 * flick}
                             fill="var(--eye)" opacity={0.6} />
                  </g>
                )}
                {/* smoke puff */}
                {smokeOp > 0 && (
                  <g opacity={smokeOp * (1 - smokeOp * 0.5)}>
                    {[0, 1, 2].map((i) => (
                      <circle key={i}
                              cx={W / 2 + (i - 1) * 6}
                              cy={H - 148 - smokeOp * 30 - i * 4}
                              r={4 + smokeOp * 6}
                              fill="var(--eye)" opacity={0.4} />
                    ))}
                  </g>
                )}
              </g>
            )}

            {/* HBD text floats in during flicker */}
            {(ph.name === 'flicker' || ph.name === 'blowO') && (
              <text x={W - 40} y={CY + 4} textAnchor="middle"
                    fontFamily="ui-monospace, Menlo, monospace"
                    fontSize={22} fontWeight={800}
                    fill="var(--accent)" letterSpacing={2}
                    opacity={0.8 + Math.sin(t * TAU * 2) * 0.2}>
                HBD!
              </text>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'eager'      ? 'TODAY IS…' :
              ph.name === 'notice'     ? 'WAIT — A CAKE!' :
              ph.name === 'cakeIn'     ? 'A CAKE!' :
              ph.name === 'shrink'     ? 'MAKE A WISH' :
              ph.name === 'light'      ? 'CANDLE LIT' :
              ph.name === 'flicker'    ? 'WISHING…' :
              ph.name === 'blowO'      ? 'BLOW!' :
              ph.name === 'extinguish' ? 'WISH SENT ♥' :
              ph.name === 'cakeOut'    ? 'PUT IT AWAY' :
              ph.name === 'grow'       ? 'BEST BIRTHDAY' :
                                         'BEST BIRTHDAY'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   GAMING — bespoke (14s)
   bored → look around for fun → find gamepad → pick it up →
   play (button presses + reactions) → tired → put away → satisfied
============================================================ */
cats.gaming = {
  label: 'Gaming',
  desc: 'Bored → find gamepad → play → rest.',
  kind: 'scene',
  tone: 'purple',
  variants: [
    { id: 'gaming-play', label: 'Find & play', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['bored',    0.10],
          ['lookL',    0.06],
          ['lookR',    0.06],
          ['lookD',    0.06],
          ['padIn',    0.12],
          ['shrink',   0.06],
          ['play',     0.32],
          ['rest',     0.06],
          ['padOut',   0.10],
          ['grow',     0.06],
          ['satisfied',0.10],
        ]);

        // Eye state — eyes look around during search phases
        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'sleepy';
        let pupilDx = 0, pupilDy = 0;
        if (ph.name === 'bored')      { eyeEmo = 'sleepy'; }
        else if (ph.name === 'lookL') { eyeEmo = 'curious'; pupilDx = -14; }
        else if (ph.name === 'lookR') { eyeEmo = 'curious'; pupilDx = 14;  }
        else if (ph.name === 'lookD') { eyeEmo = 'curious'; pupilDy = 12;  }
        else if (ph.name === 'padIn') { eyeEmo = 'eager'; pupilDy = 14; }
        else if (ph.name === 'shrink'){
          eyeCx = lerp(W / 2, W - 42, ease.inOut(ph.p));
          eyeCy = lerp(CY,    STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.32, ease.inOut(ph.p));
          eyeEmo = 'excited';
        }
        else if (ph.name === 'play')  {
          eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32;
          eyeEmo = 'excited';
        }
        else if (ph.name === 'rest')  {
          eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32;
          eyeEmo = 'satisfied';
        }
        else if (ph.name === 'padOut'){
          eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32;
          eyeEmo = 'satisfied';
        }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 42, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.32, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        }
        else { eyeEmo = 'satisfied'; }

        // Gamepad Y position
        let padY = null;
        if (ph.name === 'padIn')   padY = lerp(H + 80, CY + 16, ease.out(ph.p));
        else if (['shrink','play','rest'].includes(ph.name)) padY = CY + 16;
        else if (ph.name === 'padOut') padY = lerp(CY + 16, H + 80, ease.in(ph.p));

        // Button press blinks (during play)
        const buttonPress = ph.name === 'play'
          ? (Math.floor(ph.p * 14) % 2) : -1;
        const dpadDir = ph.name === 'play'
          ? (Math.floor(ph.p * 12) % 4) : -1;

        return (
          <g>
            {/* gamepad */}
            {padY !== null && (
              <g transform={`translate(${W / 2} ${padY})`}>
                {/* body */}
                <path d="M -70 -14
                         Q -70 -28, -50 -28
                         L -16 -28 Q -8 -28, -4 -22 L 0 -16 L 4 -22
                         Q 8 -28, 16 -28 L 50 -28 Q 70 -28, 70 -14
                         L 70 12 Q 70 24, 56 24 L 26 24 L 18 16 L -18 16
                         L -26 24 L -56 24 Q -70 24, -70 12 Z"
                      fill="var(--eye)" />
                {/* d-pad */}
                <g transform="translate(-44 -4)" fill="var(--accent)">
                  <rect x={-12} y={-3} width={24} height={6} rx={1}
                        opacity={dpadDir === 1 || dpadDir === 3 ? 1 : 0.5} />
                  <rect x={-3} y={-12} width={6} height={24} rx={1}
                        opacity={dpadDir === 0 || dpadDir === 2 ? 1 : 0.5} />
                </g>
                {/* A button */}
                <circle cx={48} cy={-2} r={8}
                        fill="var(--accent)"
                        opacity={buttonPress === 0 ? 1 : 0.6} />
                <text x={48} y={2} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={9} fontWeight={800}
                      fill="var(--bg)">A</text>
                {/* B button */}
                <circle cx={32} cy={-12} r={7}
                        fill="var(--accent)"
                        opacity={buttonPress === 1 ? 1 : 0.4} />
                <text x={32} y={-9} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={8} fontWeight={800}
                      fill="var(--bg)">B</text>
                {/* start/select pills */}
                <rect x={-8} y={6} width={6} height={3} rx={1}
                      fill="var(--bg)" opacity={0.6} />
                <rect x={2} y={6} width={6} height={3} rx={1}
                      fill="var(--bg)" opacity={0.6} />
              </g>
            )}

            {/* search-glyph during lookL/R/D — a small "?" */}
            {(ph.name === 'lookL' || ph.name === 'lookR' || ph.name === 'lookD') && (
              <text x={W / 2 + (ph.name === 'lookL' ? -100
                                 : ph.name === 'lookR' ? 100 : 0)}
                    y={ph.name === 'lookD' ? H - 40 : CY - 40}
                    textAnchor="middle"
                    fontFamily="ui-monospace, Menlo, monospace"
                    fontSize={28} fontWeight={800}
                    fill="var(--accent)" opacity={0.7}>?</text>
            )}

            {/* "+1 SCORE" pops during play */}
            {ph.name === 'play' && (Math.floor(ph.p * 8) % 2 === 0) && (
              <text x={W - 80} y={CY - 30}
                    fontFamily="ui-monospace, Menlo, monospace"
                    fontSize={14} fontWeight={800}
                    fill="var(--accent)"
                    opacity={0.5 + Math.sin(ph.p * TAU * 6) * 0.5}>+1</text>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />
            {/* "look" indicator: small pupil cover offset */}
            {(ph.name === 'lookL' || ph.name === 'lookR' || ph.name === 'lookD') &&
              eyeScale > 0.9 && (
              <g>
                <circle cx={LX + pupilDx} cy={CY + pupilDy} r={12} fill="var(--bg)" />
                <circle cx={RX + pupilDx} cy={CY + pupilDy} r={12} fill="var(--bg)" />
              </g>
            )}

            <ActLabel text={
              ph.name === 'bored'    ? 'BORED…' :
              ph.name.startsWith('look') ? 'WHERE\'S THE FUN?' :
              ph.name === 'padIn'    ? 'A GAMEPAD!' :
              ph.name === 'shrink'   ? 'LET\'S PLAY' :
              ph.name === 'play'     ? 'GG · COMBO!' :
              ph.name === 'rest'     ? 'WHEW…' :
              ph.name === 'padOut'   ? 'PAUSE' :
              ph.name === 'grow'     ? 'THAT WAS FUN' :
                                       'THAT WAS FUN'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   READING — bespoke (14s)
   curious → notice book on the shelf → book slides in →
   shrink to corner → page-turns + ABC drift → close book →
   book exits → satisfied
============================================================ */
cats.reading = {
  label: 'Reading',
  desc: 'Curious → find book → read → close.',
  kind: 'scene',
  tone: 'warm',
  variants: [
    { id: 'reading-book', label: 'Story time', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['curious',  0.10],
          ['lookR',    0.07],
          ['bookIn',   0.12],
          ['shrink',   0.07],
          ['open',     0.06],
          ['read',     0.30],
          ['close',    0.06],
          ['bookOut',  0.10],
          ['grow',     0.06],
          ['satisfied',0.06],
        ]);

        // Eye state
        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        let pupilDx = 0;
        if (ph.name === 'lookR')   { pupilDx = 14; }
        else if (ph.name === 'bookIn') { eyeEmo = 'eager'; pupilDx = 12; }
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 42, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.32, ease.inOut(ph.p));
          eyeEmo = 'eager';
        }
        else if (ph.name === 'open' || ph.name === 'read') {
          eyeCx = 42; eyeCy = STATUS_H + 24; eyeScale = 0.32;
          eyeEmo = 'happy';
        }
        else if (ph.name === 'close') {
          eyeCx = 42; eyeCy = STATUS_H + 24; eyeScale = 0.32;
          eyeEmo = 'satisfied';
        }
        else if (ph.name === 'bookOut') {
          eyeCx = 42; eyeCy = STATUS_H + 24; eyeScale = 0.32;
          eyeEmo = 'satisfied';
        }
        else if (ph.name === 'grow') {
          eyeCx = lerp(42, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.32, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        }
        else if (ph.name === 'satisfied') { eyeEmo = 'satisfied'; }

        // Book position — slides in from the right
        let bookX = null;
        if (ph.name === 'bookIn') bookX = lerp(W + 100, W / 2, ease.out(ph.p));
        else if (['shrink','open','read','close'].includes(ph.name)) bookX = W / 2;
        else if (ph.name === 'bookOut') bookX = lerp(W / 2, -100, ease.in(ph.p));

        // Open factor (closed=0, open=1)
        const open = ph.name === 'open' ? ease.out(ph.p)
                  : ph.name === 'read'  ? 1
                  : ph.name === 'close' ? 1 - ease.in(ph.p)
                  : (ph.name === 'shrink' ? 0 : 0);

        return (
          <g>
            {bookX !== null && (
              <g transform={`translate(${bookX} ${CY + 12})`}>
                {open < 0.05 ? (
                  // closed book
                  <g>
                    <rect x={-30} y={-38} width={60} height={76} rx={3}
                          fill="var(--eye)" />
                    {/* title */}
                    <rect x={-22} y={-26} width={44} height={4} rx={2}
                          fill="var(--bg)" opacity={0.85} />
                    <rect x={-14} y={-14} width={28} height={3} rx={1.5}
                          fill="var(--bg)" opacity={0.55} />
                    {/* star */}
                    <path d={starPath(0, 12, 12, 5)} fill="var(--bg)" opacity={0.9} />
                  </g>
                ) : (
                  // open book — width grows with open factor
                  <g transform={`scale(${open} 1)`}>
                    {/* spine */}
                    <line x1={0} y1={-44} x2={0} y2={44}
                          stroke="var(--eye)" strokeWidth={2} opacity={0.7} />
                    {/* left page */}
                    <rect x={-78} y={-44} width={76} height={88} rx={2}
                          fill="none" stroke="var(--eye)" strokeWidth={2} />
                    {/* right page */}
                    <rect x={2} y={-44} width={76} height={88} rx={2}
                          fill="none" stroke="var(--eye)" strokeWidth={2} />
                    {/* text lines */}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <g key={i}>
                        <rect x={-70} y={-32 + i * 14}
                              width={i === 4 ? 38 : 62} height={3} rx={1}
                              fill="var(--eye)" opacity={0.55} />
                        <rect x={10} y={-32 + i * 14}
                              width={i === 4 ? 30 : 62} height={3} rx={1}
                              fill="var(--eye)" opacity={0.55} />
                      </g>
                    ))}
                    {/* a page flutter — only visible during read */}
                    {ph.name === 'read' && (
                      <path d={`M 2 -44
                                L ${2 + 78 * (1 - (ph.p * 2 % 1))} -44
                                L ${2 + 78 * (1 - (ph.p * 2 % 1)) - 10} 44
                                L 2 44 Z`}
                            fill="var(--bg)" stroke="var(--eye)" strokeWidth={1.5}
                            opacity={0.6} />
                    )}
                  </g>
                )}
              </g>
            )}

            {/* ABC sparkles drift up during read */}
            {ph.name === 'read' && [0, 1, 2, 3].map((i) => {
              const seed = i * 0.25;
              const p = ((ph.p * 1.2) + seed) % 1;
              const x = W / 2 + 60 + i * 4 + Math.sin(p * TAU + i) * 8;
              const y = lerp(CY - 10, STATUS_H + 14, p);
              const letters = ['A', 'b', 'c', '!'];
              return (
                <text key={i}
                      x={x} y={y}
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={lerp(14, 6, p)} fontWeight={700}
                      fill="var(--accent)" opacity={1 - p}>
                  {letters[i]}
                </text>
              );
            })}

            {/* search "?" during lookR */}
            {ph.name === 'lookR' && (
              <text x={W - 30} y={CY - 24}
                    textAnchor="middle"
                    fontFamily="ui-monospace, Menlo, monospace"
                    fontSize={26} fontWeight={800}
                    fill="var(--accent)" opacity={0.7}>?</text>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />
            {ph.name === 'lookR' && eyeScale > 0.9 && (
              <g>
                <circle cx={LX + pupilDx} cy={CY} r={12} fill="var(--bg)" />
                <circle cx={RX + pupilDx} cy={CY} r={12} fill="var(--bg)" />
              </g>
            )}

            <ActLabel text={
              ph.name === 'curious'   ? 'WHAT TO DO…' :
              ph.name === 'lookR'     ? 'A BOOK?' :
              ph.name === 'bookIn'    ? 'GIMME GIMME' :
              ph.name === 'shrink'    ? 'STORY TIME' :
              ph.name === 'open'      ? 'OPENING…' :
              ph.name === 'read'      ? 'READING' :
              ph.name === 'close'     ? 'THE END' :
              ph.name === 'bookOut'   ? 'PUT IT BACK' :
                                        'NICE STORY'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   NOTIFICATION — bespoke (12s) — STACK variant
   Eyes stay centered; notifications STACK in one by one from
   different directions, then SWIPE away. No "look-around" beat
   so the structure feels different from the search-find scenes.
============================================================ */
cats.notification = {
  label: 'Notification',
  desc: 'Cards stack in, get dismissed one by one.',
  kind: 'scene',
  tone: 'warm',
  variants: [
    { id: 'notif-cards', label: 'Card stack', duration: 12000,
      render: (t) => {
        const ph = phases(t, [
          ['idle',     0.08],
          ['card1',    0.07],
          ['card2',    0.07],
          ['card3',    0.07],
          ['shrink',   0.05],
          ['hold',     0.30],
          ['dismiss1', 0.06],
          ['dismiss2', 0.06],
          ['dismiss3', 0.06],
          ['grow',     0.06],
          ['done',     0.12],
        ]);

        // Card config (where each lives + which direction it slides in)
        const CARDS = [
          { fromX:  W + 80, fromY: STATUS_H + 30, restY: STATUS_H + 30 },
          { fromX: -160,    fromY: STATUS_H + 76, restY: STATUS_H + 76 },
          { fromX:  W + 80, fromY: STATUS_H + 122, restY: STATUS_H + 122 },
        ];

        // Compute each card's current x, y, opacity, and whether shown.
        const card = (i) => {
          let x = CARDS[i].fromX, y = CARDS[i].restY, show = false;
          // entering
          if (ph.name === `card${i + 1}`) {
            x = lerp(CARDS[i].fromX, W / 2 - 90, ease.out(ph.p));
            show = true;
          } else if (
            ['shrink','hold','dismiss1','dismiss2','dismiss3','grow','done']
              .includes(ph.name) &&
            // visible if entered already
            i + 1 <= (['card1','card2','card3','shrink','hold'].indexOf(ph.name) >= 0
                       ? Math.min(3, ['card1','card2','card3','shrink','hold']
                                   .indexOf(ph.name) + 1)
                       : 3)
          ) {
            x = W / 2 - 90;
            show = true;
          }
          // dismissing — swipe right
          if (ph.name === `dismiss${i + 1}`) {
            x = lerp(W / 2 - 90, W + 200, ease.in(ph.p));
            show = true;
          }
          // after this card dismissed, hide
          if (['dismiss1','dismiss2','dismiss3'].includes(ph.name)) {
            const dismissed = parseInt(ph.name.slice(-1), 10) - 1;
            if (i < dismissed) show = false;
          }
          if (ph.name === 'grow' || ph.name === 'done') show = false;
          return { x, y, show };
        };

        // Eye placement — stays mostly centered. Drifts slightly to
        // notice each card. Shrinks only briefly during shrink/hold.
        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'steady';
        if (ph.name === 'idle') { eyeEmo = 'steady'; }
        else if (ph.name === 'card1') { eyeEmo = 'curious'; eyeCx = W/2 + ph.p * 6; }
        else if (ph.name === 'card2') { eyeEmo = 'curious'; eyeCx = W/2 - ph.p * 6; }
        else if (ph.name === 'card3') { eyeEmo = 'eager';   eyeCx = W/2 + ph.p * 6; }
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W / 2, 1);
          eyeCy = lerp(CY, H - 36, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else if (ph.name === 'hold') { eyeCy = H - 36; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name.startsWith('dismiss')) {
          eyeCy = H - 36; eyeScale = 0.30; eyeEmo = 'satisfied';
        }
        else if (ph.name === 'grow') {
          eyeCy = lerp(H - 36, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        }
        else { eyeEmo = 'satisfied'; }

        // Pulsing bell+badge in upper-right
        const showBell = !['idle'].includes(ph.name);
        const visibleCount =
          ph.name === 'idle' ? 0 :
          ph.name === 'card1' ? 1 :
          ph.name === 'card2' ? 2 :
          ph.name === 'card3' ? 3 :
          ph.name.startsWith('dismiss')
            ? Math.max(0, 3 - parseInt(ph.name.slice(-1), 10))
            : ['shrink','hold'].includes(ph.name) ? 3 : 0;

        return (
          <g>
            {/* notification cards */}
            {[0, 1, 2].map((i) => {
              const c = card(i);
              if (!c.show) return null;
              return (
                <g key={i} transform={`translate(${c.x} ${c.y})`}>
                  <rect x={0} y={0} width={180} height={40} rx={8}
                        fill="var(--eye)" opacity={0.95} />
                  <circle cx={16} cy={20} r={8} fill="var(--bg)" />
                  <text x={16} y={24} textAnchor="middle"
                        fontFamily="ui-monospace, Menlo, monospace"
                        fontSize={10} fontWeight={700}
                        fill="var(--accent)">!</text>
                  <rect x={32} y={10} width={120} height={5} rx={2}
                        fill="var(--bg)" opacity={0.85} />
                  <rect x={32} y={22} width={140} height={3} rx={1.5}
                        fill="var(--bg)" opacity={0.55} />
                  <rect x={32} y={30} width={80} height={3} rx={1.5}
                        fill="var(--bg)" opacity={0.55} />
                </g>
              );
            })}

            {/* bell + badge counter, top-right */}
            {showBell && (
              <g transform={`translate(${W - 30} ${STATUS_H + 26})`}>
                <path d="M -10 0 Q -10 -12, 0 -14 Q 10 -12, 10 0 L 12 2 L -12 2 Z"
                      fill="var(--eye)" />
                {visibleCount > 0 && (
                  <g>
                    <circle cx={8} cy={-10} r={7} fill="var(--accent)" />
                    <text x={8} y={-7} textAnchor="middle"
                          fontFamily="ui-monospace, Menlo, monospace"
                          fontSize={9} fontWeight={800}
                          fill="var(--bg)">{visibleCount}</text>
                  </g>
                )}
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'idle'      ? '— — —' :
              ph.name === 'card1'     ? '1 NEW' :
              ph.name === 'card2'     ? '2 NEW' :
              ph.name === 'card3'     ? '3 NEW' :
              ph.name === 'shrink'    ? 'GOT THEM' :
              ph.name === 'hold'      ? 'READING…' :
              ph.name.startsWith('dismiss') ? 'OK · OK · OK' :
                                        'INBOX 0'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   TIMER — bespoke (14s) — ASSEMBLY variant
   Digits FLY IN from 4 corners and assemble. Distinct from
   "prop slides in from below". Then count down, DING, scatter.
============================================================ */
cats.timer = {
  label: 'Timer',
  desc: 'Digits assemble, count down, ding, scatter.',
  kind: 'scene',
  tone: 'orange',
  variants: [
    { id: 'timer-countdown', label: 'Assemble + ding', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['think',    0.10],
          ['assemble', 0.13],
          ['shrink',   0.06],
          ['count',    0.40],
          ['ding',     0.07],
          ['scatter',  0.10],
          ['grow',     0.06],
          ['done',     0.08],
        ]);

        // Eye state
        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'thinking';
        if (ph.name === 'think') { eyeEmo = 'thinking'; }
        else if (ph.name === 'assemble') { eyeEmo = 'eager'; }
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 42, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.32, ease.inOut(ph.p));
          eyeEmo = 'curious';
        }
        else if (ph.name === 'count') { eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'curious'; }
        else if (ph.name === 'ding')  { eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'surprised'; }
        else if (ph.name === 'scatter') { eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'happy'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 42, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.32, 1, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else { eyeEmo = 'happy'; }

        // Each character: "30" wait... let's pick "0:30" → 4 chars
        const TEXT = '0:30';
        // Each char starts from a corner; settles at a slot
        const slotX = (i) => W / 2 - 36 + i * 24;
        const slotY = CY;
        const corner = (i) => ({
          x: i % 2 === 0 ? -40 : W + 40,
          y: i < 2 ? -40 : H + 40,
        });

        // Display text changes during count phase
        let display = TEXT;
        if (ph.name === 'count') {
          const sec = Math.max(0, 30 - Math.floor(ph.p * 30));
          const mm = Math.floor(sec / 60);
          const ss = sec % 60;
          display = `${mm}:${String(ss).padStart(2, '0')}`;
        } else if (ph.name === 'ding' || ph.name === 'scatter') {
          display = '0:00';
        }

        // shake during ding
        const shake = ph.name === 'ding' ? Math.sin(ph.p * TAU * 10) * 4 : 0;

        // Char position during assemble/scatter
        const charXY = (i, char) => {
          const c = corner(i);
          if (ph.name === 'assemble') {
            return {
              x: lerp(c.x, slotX(i), ease.out(ph.p)),
              y: lerp(c.y, slotY, ease.out(ph.p)),
              op: ease.out(ph.p),
            };
          }
          if (ph.name === 'scatter') {
            return {
              x: lerp(slotX(i), c.x, ease.in(ph.p)),
              y: lerp(slotY, c.y, ease.in(ph.p)),
              op: 1 - ph.p,
            };
          }
          return { x: slotX(i) + shake, y: slotY, op: 1 };
        };

        return (
          <g>
            {/* digits */}
            {['think','grow','done'].includes(ph.name) ? null :
              display.split('').map((ch, i) => {
                const { x, y, op } = charXY(i, ch);
                return (
                  <text key={i} x={x} y={y + 12}
                        textAnchor="middle"
                        fontFamily="ui-monospace, Menlo, monospace"
                        fontSize={36} fontWeight={800}
                        fill="var(--eye)" opacity={op}>{ch}</text>
                );
              })
            }

            {/* progress arc during count (around upper-left) */}
            {ph.name === 'count' && (
              <g transform={`translate(${W / 2} ${CY + 36})`}
                 fill="none" stroke="var(--accent)" strokeLinecap="round">
                <circle cx={0} cy={0} r={14} strokeWidth={2} opacity={0.3} />
                <path d={(() => {
                  const a0 = -Math.PI / 2;
                  const a1 = a0 + (1 - ph.p) * TAU;
                  const large = ((1 - ph.p) > 0.5) ? 1 : 0;
                  return `M ${Math.cos(a0) * 14} ${Math.sin(a0) * 14}
                          A 14 14 0 ${large} 1 ${Math.cos(a1) * 14} ${Math.sin(a1) * 14}`;
                })()} strokeWidth={3} />
              </g>
            )}

            {/* DING sparkles */}
            {ph.name === 'ding' && [0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * TAU;
              const r = 30 + ph.p * 50;
              return (
                <path key={i}
                      d={starPath(W / 2 + Math.cos(a) * r,
                                  CY + Math.sin(a) * r,
                                  5 * (1 - ph.p), 2)}
                      fill="var(--accent)" opacity={1 - ph.p} />
              );
            })}

            {/* idle hint during think — a small hourglass icon */}
            {ph.name === 'think' && (
              <g transform={`translate(${W / 2} ${CY + 60})`}
                 fill="none" stroke="var(--accent)" strokeWidth={2}
                 opacity={0.5}>
                <path d="M -8 -8 L 8 -8 L -8 8 L 8 8 Z" />
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'think'    ? 'SET A TIMER' :
              ph.name === 'assemble' ? 'TIMER · 30S' :
              ph.name === 'shrink'   ? 'STARTING…' :
              ph.name === 'count'    ? 'COUNTING' :
              ph.name === 'ding'     ? 'TIME UP!' :
              ph.name === 'scatter'  ? 'DONE' :
                                       'NICELY DONE'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   COFFEE — bespoke (14s) — TWO-PROP CHOREOGRAPHY
   Cup rises from below; pot enters from upper-left tilted;
   pour, fill, pot exits; cup tilts up to drink; cup exits.
   Multi-prop sequencing distinguishes it from single-prop scenes.
============================================================ */
cats.coffee = {
  label: 'Coffee',
  desc: 'Cup arrives, pot pours, drink, exit.',
  kind: 'scene',
  tone: 'warm',
  variants: [
    { id: 'coffee-pour', label: 'Pour & sip', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['sleepy',  0.10],
          ['cupIn',   0.10],
          ['potIn',   0.08],
          ['shrink',  0.06],
          ['pour',    0.20],
          ['potOut',  0.07],
          ['steam',   0.10],
          ['sip',     0.10],
          ['cupOut',  0.08],
          ['grow',    0.06],
          ['done',    0.05],
        ]);

        // Eye state
        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'sleepy';
        if (ph.name === 'sleepy') eyeEmo = 'sleepy';
        else if (ph.name === 'cupIn') eyeEmo = 'eager';
        else if (ph.name === 'potIn') eyeEmo = 'eager';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 42, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.32, ease.inOut(ph.p));
          eyeEmo = 'eager';
        }
        else if (['pour','potOut','steam'].includes(ph.name)) {
          eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'happy';
        }
        else if (ph.name === 'sip') {
          eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'satisfied';
        }
        else if (ph.name === 'cupOut') {
          eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'excited';
        }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 42, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.32, 1, ease.inOut(ph.p));
          eyeEmo = 'excited';
        }
        else { eyeEmo = 'excited'; }

        // Cup Y position (settles around CY + 30)
        const cupRestY = CY + 30;
        let cupY = null, cupTilt = 0, cupFill = 0;
        if (ph.name === 'cupIn')  cupY = lerp(H + 60, cupRestY, ease.out(ph.p));
        else if (['potIn','shrink','pour','potOut','steam','sip','cupOut'].includes(ph.name)) cupY = cupRestY;
        if (ph.name === 'sip') cupTilt = ph.p < 0.5 ? lerp(0, -30, ph.p * 2) : lerp(-30, 0, (ph.p - 0.5) * 2);
        if (ph.name === 'cupOut') cupY = lerp(cupRestY, H + 60, ease.in(ph.p));
        // fill rises during pour, drains during sip
        if (ph.name === 'pour') cupFill = ease.out(ph.p);
        else if (['potOut','steam'].includes(ph.name)) cupFill = 1;
        else if (ph.name === 'sip') cupFill = lerp(1, 0, ph.p);
        else if (ph.name === 'cupOut') cupFill = 0;

        // Pot position (enters from upper-left, exits up-left)
        let potX = null, potY = null, potTilt = 0;
        if (ph.name === 'potIn')  {
          potX = lerp(-80, W / 2 - 60, ease.out(ph.p));
          potY = lerp(STATUS_H + 30, cupRestY - 60, ease.out(ph.p));
          potTilt = -25;
        } else if (['shrink','pour'].includes(ph.name)) {
          potX = W / 2 - 60; potY = cupRestY - 60;
          potTilt = ph.name === 'pour' ? -25 - Math.sin(ph.p * TAU * 2) * 3 : -25;
        } else if (ph.name === 'potOut') {
          potX = lerp(W / 2 - 60, -100, ease.in(ph.p));
          potY = lerp(cupRestY - 60, STATUS_H, ease.in(ph.p));
          potTilt = -25;
        }

        return (
          <g>
            {/* cup */}
            {cupY !== null && (
              <g transform={`translate(${W / 2} ${cupY}) rotate(${cupTilt})`}
                 fill="none" stroke="var(--eye)" strokeWidth={4} strokeLinecap="round">
                {/* cup body */}
                <path d={`M -28 -16 Q -28 18, 0 18 Q 28 18, 28 -16 Z`} />
                {/* handle */}
                <path d={`M 28 -8 Q 42 -4, 36 8`} />
                {/* coffee fill */}
                <path d={`M -26 ${-14 + (1 - cupFill) * 26}
                          Q 0 ${-12 + (1 - cupFill) * 26}, 26 ${-14 + (1 - cupFill) * 26}
                          L 26 14 Q 0 18, -26 14 Z`}
                      fill="var(--accent)" stroke="none" opacity={0.85} />
              </g>
            )}

            {/* pot */}
            {potX !== null && (
              <g transform={`translate(${potX} ${potY}) rotate(${potTilt})`}
                 fill="none" stroke="var(--eye)" strokeWidth={4} strokeLinecap="round"
                 strokeLinejoin="round">
                <path d="M -24 -10 L -24 14 L 24 14 L 24 -10 Z" />
                <line x1={-24} y1={-6} x2={-32} y2={-2} strokeWidth={5} />
                <path d="M 24 -4 L 38 0" />
                {/* handle */}
                <path d="M -24 -14 Q -36 -14, -36 -2" />
              </g>
            )}

            {/* stream (during pour) */}
            {ph.name === 'pour' && (
              <line x1={W / 2 - 22} y1={cupRestY - 56}
                    x2={W / 2 - 12} y2={cupRestY - 16}
                    stroke="var(--eye)" strokeWidth={4} strokeLinecap="round" />
            )}

            {/* steam (during steam phase) */}
            {ph.name === 'steam' && [0, 1, 2].map((i) => {
              const p = ((ph.p * 1.4) + i * 0.33) % 1;
              const x = W / 2 + (i - 1) * 6 + Math.sin(p * TAU + i) * 4;
              const y = cupRestY - 30 - p * 50;
              return (
                <circle key={i} cx={x} cy={y} r={4 + p * 3}
                        fill="var(--accent)" opacity={(1 - p) * 0.6} />
              );
            })}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'sleepy'  ? 'NEED · CAFFEINE' :
              ph.name === 'cupIn'   ? 'A CUP!' :
              ph.name === 'potIn'   ? 'AND COFFEE!' :
              ph.name === 'shrink'  ? 'READY TO POUR' :
              ph.name === 'pour'    ? 'POURING…' :
              ph.name === 'potOut'  ? 'ENOUGH' :
              ph.name === 'steam'   ? 'STILL HOT' :
              ph.name === 'sip'     ? 'AHHH ☕' :
              ph.name === 'cupOut'  ? 'WIDE AWAKE' :
                                      'POWERED UP'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   CALL — bespoke (14s) — TRANSFORM variant
   Phone slides in vibrating, EXPANDS to fill screen as call
   frame, talk happens, frame COLLAPSES back to phone, exits.
   The transformation distinguishes it from in/out scenes.
============================================================ */
cats.call = {
  label: 'Call',
  desc: 'Phone rings → expands to call → collapses back.',
  kind: 'scene',
  tone: 'green',
  variants: [
    { id: 'call-incoming', label: 'Ring → answer → end', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['idle',    0.06],
          ['phoneIn', 0.10],
          ['ring',    0.13],
          ['expand',  0.06],
          ['shrink',  0.04],
          ['talk',    0.32],
          ['hangup',  0.04],
          ['collapse',0.06],
          ['phoneOut',0.08],
          ['grow',    0.06],
          ['done',    0.05],
        ]);

        // Eye state
        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'steady';
        if (ph.name === 'idle')    eyeEmo = 'steady';
        else if (ph.name === 'phoneIn') eyeEmo = 'curious';
        else if (ph.name === 'ring')    eyeEmo = 'surprised';
        else if (ph.name === 'expand')  { eyeEmo = 'eager'; }
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 38, ease.inOut(ph.p));
          eyeCy = lerp(CY, H - 36, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else if (ph.name === 'talk' || ph.name === 'hangup') {
          eyeCx = 38; eyeCy = H - 36; eyeScale = 0.30;
          eyeEmo = ph.name === 'hangup' ? 'satisfied' : 'happy';
        }
        else if (ph.name === 'collapse' || ph.name === 'phoneOut') {
          eyeCx = 38; eyeCy = H - 36; eyeScale = 0.30; eyeEmo = 'satisfied';
        }
        else if (ph.name === 'grow') {
          eyeCx = lerp(38, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(H - 36, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else { eyeEmo = 'happy'; }

        // Phone shape: starts small phone-sized; expands to full frame
        let phoneCx = W / 2, phoneCy = CY;
        let phoneW = 56, phoneH = 92;
        let phoneRy = 8;
        if (ph.name === 'phoneIn') {
          phoneCy = lerp(H + 80, CY, ease.out(ph.p));
        }
        else if (ph.name === 'ring') {
          const sh = Math.sin(ph.p * TAU * 10) * 4;
          phoneCx = W / 2 + sh;
        }
        else if (ph.name === 'expand') {
          phoneW = lerp(56, 200, ease.inOut(ph.p));
          phoneH = lerp(92, H - STATUS_H - 30, ease.inOut(ph.p));
          phoneRy = lerp(8, 4, ph.p);
        }
        else if (['shrink','talk','hangup'].includes(ph.name)) {
          phoneW = 200; phoneH = H - STATUS_H - 30; phoneRy = 4;
        }
        else if (ph.name === 'collapse') {
          phoneW = lerp(200, 56, ease.inOut(ph.p));
          phoneH = lerp(H - STATUS_H - 30, 92, ease.inOut(ph.p));
          phoneRy = lerp(4, 8, ph.p);
        }
        else if (ph.name === 'phoneOut') {
          phoneCy = lerp(CY, H + 80, ease.in(ph.p));
        }
        else if (ph.name === 'idle' || ph.name === 'grow' || ph.name === 'done') {
          phoneCx = null; phoneCy = null;
        }

        const showPhone = phoneCx !== null;
        const expanded = ['shrink','talk','hangup'].includes(ph.name);

        // Talk time
        const timeStr = ph.name === 'talk'
          ? `00:${String(Math.floor(ph.p * 60)).padStart(2, '0')}`
          : '00:00';

        return (
          <g>
            {showPhone && (
              <g transform={`translate(${phoneCx} ${phoneCy})`}>
                <rect x={-phoneW / 2} y={-phoneH / 2}
                      width={phoneW} height={phoneH} rx={phoneRy}
                      fill="var(--eye)" />
                {expanded ? (
                  /* Call interior */
                  <g>
                    {/* avatar */}
                    <g transform={`translate(0 ${-20})`}>
                      <circle cx={0} cy={-10}
                              r={18 + Math.sin(t * TAU * 1.2) * 0.5}
                              fill="var(--bg)" />
                      <path d="M -30 24 Q -30 4, 0 4 Q 30 4, 30 24 Z"
                            fill="var(--bg)" />
                    </g>
                    {/* REC dot */}
                    <circle cx={-phoneW / 2 + 14} cy={-phoneH / 2 + 14}
                            r={3} fill="var(--accent)"
                            opacity={Math.sin(t * TAU * 2) > 0 ? 1 : 0.3} />
                    {/* time */}
                    <text x={0} y={phoneH / 2 - 28} textAnchor="middle"
                          fontFamily="ui-monospace, Menlo, monospace"
                          fontSize={14} fontWeight={700}
                          fill="var(--bg)">{timeStr}</text>
                    {/* hangup pill */}
                    <rect x={-18} y={phoneH / 2 - 20} width={36} height={12} rx={6}
                          fill="var(--accent)"
                          opacity={ph.name === 'hangup' ? 0.5 + Math.sin(t * TAU * 6) * 0.5 : 1} />
                  </g>
                ) : (
                  /* Phone glyph */
                  <g>
                    {/* small screen */}
                    <rect x={-phoneW / 2 + 6} y={-phoneH / 2 + 8}
                          width={phoneW - 12} height={phoneH - 24} rx={2}
                          fill="var(--bg)" opacity={0.45} />
                    {/* home dot */}
                    <circle cx={0} cy={phoneH / 2 - 8} r={2}
                            fill="var(--bg)" opacity={0.6} />
                    {/* incoming-call icon (handset) when ringing */}
                    {ph.name === 'ring' && (
                      <g transform="translate(0 0)">
                        <path d="M -8 -16 Q -8 -22, 0 -22 Q 8 -22, 8 -16
                                 Q 8 -10, 4 -8 L 4 4 Q 4 12, 0 12
                                 Q -4 12, -4 4 L -4 -8 Q -8 -10, -8 -16 Z"
                              fill="var(--accent)" />
                      </g>
                    )}
                  </g>
                )}
              </g>
            )}

            {/* Ringing arcs while phone is small + ringing */}
            {ph.name === 'ring' && [0, 1].map((i) => {
              const p = ((ph.p * 4) + i * 0.5) % 1;
              return (
                <g key={i} opacity={1 - p}>
                  <path d={`M ${W / 2 - 36 - p * 12} ${CY - 6}
                            Q ${W / 2 - 46 - p * 12} ${CY},
                            ${W / 2 - 36 - p * 12} ${CY + 6}`}
                        fill="none" stroke="var(--accent)" strokeWidth={3}
                        strokeLinecap="round" />
                  <path d={`M ${W / 2 + 36 + p * 12} ${CY - 6}
                            Q ${W / 2 + 46 + p * 12} ${CY},
                            ${W / 2 + 36 + p * 12} ${CY + 6}`}
                        fill="none" stroke="var(--accent)" strokeWidth={3}
                        strokeLinecap="round" />
                </g>
              );
            })}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'idle'     ? '— — —' :
              ph.name === 'phoneIn'  ? 'A PHONE…' :
              ph.name === 'ring'     ? 'INCOMING · MOM' :
              ph.name === 'expand'   ? 'ANSWERING' :
              ph.name === 'shrink'   ? '· LIVE ·' :
              ph.name === 'talk'     ? `· ${timeStr} ·` :
              ph.name === 'hangup'   ? 'BYE!' :
              ph.name === 'collapse' ? 'CALL ENDED' :
              ph.name === 'phoneOut' ? 'PUT IT DOWN' :
                                       'NICE CHAT'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   WEATHER — bespoke (12s) — WINDOW variant
   Curtains slide open revealing a window; time-lapse weather
   plays INSIDE the window frame; curtains close. The "window"
   framing is distinct from props arriving onto an open screen.
============================================================ */
cats.weather = {
  label: 'Weather',
  desc: 'Curtains open → time-lapse → curtains close.',
  kind: 'scene',
  tone: 'cyan',
  variants: [
    { id: 'weather-window', label: 'Look outside', duration: 12000,
      render: (t) => {
        const ph = phases(t, [
          ['curious',    0.10],
          ['curtainOpen',0.10],
          ['shrink',     0.06],
          ['watch',      0.48],
          ['curtainClose',0.10],
          ['grow',       0.06],
          ['done',       0.10],
        ]);

        // Eye state
        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'curious') eyeEmo = 'curious';
        else if (ph.name === 'curtainOpen') eyeEmo = 'eager';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 42, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.32, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else if (ph.name === 'watch') {
          eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'happy';
        }
        else if (ph.name === 'curtainClose') {
          eyeCx = W - 42; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'satisfied';
        }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 42, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.32, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        }
        else { eyeEmo = 'satisfied'; }

        // Window frame area
        const winX = W / 2 - 90, winY = STATUS_H + 18;
        const winW = 180, winH = H - STATUS_H - 50;

        // Curtain open factor (0 closed, 1 fully open)
        const curt = ph.name === 'curtainOpen' ? ease.out(ph.p)
                   : ph.name === 'curious'     ? 0
                   : ph.name === 'curtainClose'? 1 - ease.in(ph.p)
                   : 1;

        // Inside-window time-lapse (sun rises across)
        const skyT = ph.name === 'watch' ? ph.p : 0;
        const sunX = winX + 10 + skyT * (winW - 20);
        const sunY = winY + winH * 0.6 - Math.sin(skyT * Math.PI) * (winH * 0.45);

        return (
          <g>
            {/* window frame */}
            <rect x={winX} y={winY} width={winW} height={winH}
                  fill="none" stroke="var(--eye)" strokeWidth={3} />
            <line x1={winX} y1={winY + winH / 2}
                  x2={winX + winW} y2={winY + winH / 2}
                  stroke="var(--eye)" strokeWidth={2} opacity={0.7} />
            <line x1={winX + winW / 2} y1={winY}
                  x2={winX + winW / 2} y2={winY + winH}
                  stroke="var(--eye)" strokeWidth={2} opacity={0.7} />

            {/* sky inside window (when curtains open) */}
            {curt > 0.05 && (
              <g clipPath="url(#weatherClip)">
                <defs>
                  <clipPath id="weatherClip">
                    <rect x={winX + 2} y={winY + 2}
                          width={winW - 4} height={winH - 4} />
                  </clipPath>
                </defs>
                {/* sun */}
                {(ph.name === 'watch' || ph.name === 'curtainClose') && (
                  <g>
                    <circle cx={sunX} cy={sunY} r={14} fill="var(--accent)" />
                    {[0, 1, 2, 3, 4, 5].map((i) => {
                      const a = (i / 6) * TAU + t * 0.5;
                      const r1 = 16, r2 = 22;
                      return (
                        <line key={i}
                              x1={sunX + Math.cos(a) * r1} y1={sunY + Math.sin(a) * r1}
                              x2={sunX + Math.cos(a) * r2} y2={sunY + Math.sin(a) * r2}
                              stroke="var(--accent)" strokeWidth={2}
                              strokeLinecap="round" opacity={0.7} />
                      );
                    })}
                  </g>
                )}
                {/* clouds drifting */}
                {[0, 1, 2].map((i) => {
                  const seed = i * 0.33;
                  const p = ((skyT * 0.6) + seed) % 1;
                  const cx = winX - 20 + p * (winW + 40);
                  const cy = winY + 30 + (i % 2) * 10;
                  return (
                    <g key={i} fill="var(--eye)" opacity={0.55}>
                      <ellipse cx={cx} cy={cy} rx={12} ry={6} />
                      <ellipse cx={cx + 8} cy={cy - 4} rx={9} ry={5} />
                      <ellipse cx={cx - 8} cy={cy - 3} rx={8} ry={4} />
                    </g>
                  );
                })}
              </g>
            )}

            {/* curtains */}
            <g>
              <rect x={winX - 2} y={winY - 4}
                    width={(winW / 2 + 2) * (1 - curt)} height={winH + 8}
                    fill="var(--eye)" />
              <rect x={winX + winW / 2 + winW / 2 * curt} y={winY - 4}
                    width={(winW / 2 + 2) * (1 - curt)} height={winH + 8}
                    fill="var(--eye)" />
              {/* curtain rod */}
              <line x1={winX - 8} y1={winY - 6}
                    x2={winX + winW + 8} y2={winY - 6}
                    stroke="var(--accent)" strokeWidth={3} />
            </g>

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'curious'      ? 'WHAT\'S OUT THERE?' :
              ph.name === 'curtainOpen'  ? 'OPENING…' :
              ph.name === 'shrink'       ? 'LOOK OUTSIDE' :
              ph.name === 'watch'        ? 'SUNNY ALL DAY' :
              ph.name === 'curtainClose' ? 'NIGHT FALLS' :
                                           'NICE DAY'
            } />
          </g>
        );
      } },
  ],
};


/* ============================================================
   GIFT — bespoke (14s) — UNWRAPPING variant
   Box appears wrapped; the RIBBON UNTIES first; lid lifts off;
   contents pop out; then box folds away. Layered unwrap distinct
   from "prop slides in/out".
============================================================ */
cats.gift = {
  label: 'Gift',
  desc: 'Wrap → untie ribbon → lift lid → reveal.',
  kind: 'scene',
  tone: 'rose',
  variants: [
    { id: 'gift-unwrap', label: 'Unwrapping', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['curious',   0.08],
          ['boxIn',     0.10],
          ['shrink',    0.06],
          ['untie',     0.14],
          ['lift',      0.10],
          ['reveal',    0.20],
          ['fold',      0.10],
          ['boxOut',    0.08],
          ['grow',      0.06],
          ['done',      0.08],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'boxIn') eyeEmo = 'eager';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 40, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.32, ease.inOut(ph.p));
          eyeEmo = 'eager';
        }
        else if (ph.name === 'untie') { eyeCx = 40; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'curious'; }
        else if (ph.name === 'lift')  { eyeCx = 40; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'eager'; }
        else if (ph.name === 'reveal'){ eyeCx = 40; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'love'; }
        else if (ph.name === 'fold' || ph.name === 'boxOut') {
          eyeCx = 40; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'happy';
        }
        else if (ph.name === 'grow') {
          eyeCx = lerp(40, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.32, 1, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else eyeEmo = 'happy';

        // Box position
        const boxRestY = CY + 16;
        let boxY = boxRestY;
        if (ph.name === 'boxIn')   boxY = lerp(H + 80, boxRestY, ease.out(ph.p));
        else if (ph.name === 'boxOut') boxY = lerp(boxRestY, H + 80, ease.in(ph.p));

        // Ribbon untying — pulled apart sideways
        const ribbonPull = ph.name === 'untie' ? ease.out(ph.p) : (ph.name === 'curious' || ph.name === 'boxIn' || ph.name === 'shrink' ? 0 : 1);
        // Lid lifting — flies up & out
        const lidLift = ph.name === 'lift' ? ease.out(ph.p) : (ph.name === 'reveal' || ph.name === 'fold' || ph.name === 'boxOut' ? 1 : 0);
        // Box scale during fold (shrinks)
        const boxScale = ph.name === 'fold' ? lerp(1, 0.3, ease.inOut(ph.p)) : (ph.name === 'boxOut' ? 0.3 : 1);

        // Reveal content — heart rises
        const heartY = ph.name === 'reveal' ? lerp(boxRestY, CY - 20, ease.out(ph.p)) : null;
        const heartScale = ph.name === 'reveal' ? 1 + Math.sin(t * TAU * 2) * 0.08 : 1;

        return (
          <g>
            <g transform={`translate(${W / 2} ${boxY}) scale(${boxScale})`}>
              {/* box body — visible until fold completes */}
              {boxScale > 0.2 && (
                <g fill="var(--eye)">
                  <rect x={-50} y={-18} width={100} height={46} rx={3} />
                </g>
              )}
              {/* lid — flies up */}
              <g transform={`translate(${lidLift * 12} ${-lidLift * 60}) rotate(${lidLift * 18})`}>
                <rect x={-56} y={-30} width={112} height={16} rx={3}
                      fill="var(--eye)" opacity={1 - clamp((lidLift - 0.7) / 0.3, 0, 1)} />
                {/* bow on lid (visible only when ribbon not yet untied) */}
                {ribbonPull < 0.95 && (
                  <g fill="var(--accent)" opacity={1 - ribbonPull}>
                    <ellipse cx={-6} cy={-30} rx={6} ry={4} />
                    <ellipse cx={6}  cy={-30} rx={6} ry={4} />
                    <circle cx={0} cy={-30} r={2.5} />
                  </g>
                )}
              </g>
              {/* ribbon — vertical strip pulled apart */}
              {ribbonPull < 0.95 && (
                <g fill="var(--accent)">
                  <rect x={-4 - ribbonPull * 60} y={-18} width={4} height={46} />
                  <rect x={ribbonPull * 60} y={-18} width={4} height={46} />
                </g>
              )}
            </g>

            {/* heart rising out of box */}
            {heartY !== null && (
              <g transform={`translate(0 0) scale(${heartScale})`}>
                <path d={heartPath(W / 2, heartY, 28)} fill="var(--accent)" />
              </g>
            )}

            {/* sparkles around heart during reveal */}
            {ph.name === 'reveal' && ph.p > 0.3 && [0, 1, 2, 3].map((i) => {
              const a = (i / 4) * TAU + t * 0.5;
              const r = 30 + (ph.p - 0.3) * 24;
              return (
                <path key={i}
                      d={starPath(W / 2 + Math.cos(a) * r,
                                  CY - 20 + Math.sin(a) * r * 0.7,
                                  4, 1.6)}
                      fill="var(--eye)" opacity={1 - (ph.p - 0.3)} />
              );
            })}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'curious' ? 'A GIFT FOR ME?' :
              ph.name === 'boxIn'   ? 'OOH!' :
              ph.name === 'shrink'  ? 'LET\'S OPEN' :
              ph.name === 'untie'   ? 'UNTIE THE BOW' :
              ph.name === 'lift'    ? 'LIFT THE LID' :
              ph.name === 'reveal'  ? 'I LOVE IT! ♥' :
              ph.name === 'fold'    ? 'KEEP IT SAFE' :
                                      'BEST GIFT EVER'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   MUSIC — bespoke (12s) — SPEAKERS MATERIALIZE variant
   Two speaker boxes fade in from sides; bass pulse rings;
   bars dance; the robot's eyes bop with the beat. Speakers fade out.
============================================================ */
cats.music = {
  label: 'Music',
  desc: 'Speakers in → bars dance → fade out.',
  kind: 'scene',
  tone: 'rose',
  variants: [
    { id: 'music-jam', label: 'Speaker jam', duration: 12000,
      render: (t) => {
        const ph = phases(t, [
          ['neutral',   0.08],
          ['fadeIn',    0.10],
          ['shrink',    0.05],
          ['jam',       0.50],
          ['fadeOut',   0.10],
          ['grow',      0.05],
          ['done',      0.12],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'steady';
        // Eyes bop with the beat during jam — vertical bob
        const beat = ph.name === 'jam' ? Math.sin(ph.p * TAU * 16) : 0;
        if (ph.name === 'neutral') eyeEmo = 'steady';
        else if (ph.name === 'fadeIn') eyeEmo = 'curious';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W / 2, 1);
          eyeCy = lerp(CY, CY + 50, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.42, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else if (ph.name === 'jam') {
          eyeCx = W / 2; eyeCy = CY + 50 + Math.abs(beat) * 4;
          eyeScale = 0.42;
          eyeEmo = 'happy';
        }
        else if (ph.name === 'fadeOut') {
          eyeCx = W / 2; eyeCy = CY + 50; eyeScale = 0.42; eyeEmo = 'satisfied';
        }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W / 2, W / 2, 1);
          eyeCy = lerp(CY + 50, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.42, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        }
        else eyeEmo = 'satisfied';

        // Speaker opacity
        const spkOp = ph.name === 'fadeIn' ? ease.out(ph.p)
                    : ['shrink','jam'].includes(ph.name) ? 1
                    : ph.name === 'fadeOut' ? 1 - ease.in(ph.p)
                    : 0;

        // Bar heights (rhythmic, multi-frequency)
        const barH = (i) => {
          if (ph.name !== 'jam') return 6;
          const f1 = Math.sin(ph.p * TAU * 8 + i * 0.7);
          const f2 = Math.sin(ph.p * TAU * 16 + i * 0.3);
          return 6 + Math.abs(f1 * 14 + f2 * 8);
        };

        // Bass-pulse ring
        const ringR = ph.name === 'jam'
          ? 40 + Math.abs(Math.sin(ph.p * TAU * 4)) * 30
          : 0;

        return (
          <g>
            {/* left speaker */}
            <g transform={`translate(56 ${CY - 10})`} opacity={spkOp}>
              <rect x={-22} y={-40} width={44} height={88} rx={4}
                    fill="var(--eye)" />
              <circle cx={0} cy={-18} r={10} fill="var(--bg)" />
              <circle cx={0} cy={-18} r={5} fill="var(--eye)" />
              <circle cx={0} cy={18} r={16} fill="var(--bg)" />
              <circle cx={0} cy={18} r={9} fill="var(--eye)"
                      transform={`scale(${1 + (ph.name === 'jam' ? Math.abs(Math.sin(ph.p * TAU * 4)) * 0.2 : 0)})`}
                      style={{ transformOrigin: '0 18px' }} />
            </g>
            {/* right speaker — mirrored */}
            <g transform={`translate(${W - 56} ${CY - 10})`} opacity={spkOp}>
              <rect x={-22} y={-40} width={44} height={88} rx={4}
                    fill="var(--eye)" />
              <circle cx={0} cy={-18} r={10} fill="var(--bg)" />
              <circle cx={0} cy={-18} r={5} fill="var(--eye)" />
              <circle cx={0} cy={18} r={16} fill="var(--bg)" />
              <circle cx={0} cy={18} r={9} fill="var(--eye)" />
            </g>

            {/* equalizer bars across middle */}
            {ph.name === 'jam' && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const h = barH(i);
              const x = W / 2 - 56 + i * 16;
              return (
                <rect key={i} x={x - 5} y={CY - 30 - h / 2}
                      width={10} height={h} rx={3}
                      fill="var(--accent)" />
              );
            })}

            {/* center bass pulse */}
            {ph.name === 'jam' && (
              <circle cx={W / 2} cy={CY - 30} r={ringR}
                      fill="none" stroke="var(--accent)" strokeWidth={2}
                      opacity={1 - Math.abs(Math.sin(ph.p * TAU * 4)) * 0.7} />
            )}

            {/* floating notes */}
            {ph.name === 'jam' && [0, 1, 2].map((i) => {
              const p = ((ph.p * 1.2) + i * 0.33) % 1;
              const x = 80 + i * 80 + Math.sin(p * TAU + i) * 8;
              const y = lerp(H - 30, STATUS_H + 14, p);
              return (
                <text key={i} x={x} y={y}
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={lerp(18, 8, p)} fontWeight={700}
                      fill="var(--accent)" opacity={1 - p}>♪</text>
              );
            })}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'neutral' ? 'SILENCE…' :
              ph.name === 'fadeIn'  ? 'A SONG!' :
              ph.name === 'shrink'  ? 'TURN IT UP' :
              ph.name === 'jam'     ? 'JAMMING ♪♪' :
              ph.name === 'fadeOut' ? 'FADING…' :
                                      'GREAT TUNE'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   CAMERA — bespoke (14s) — VIEWFINDER + PHOTO PRINT variant
   Different from generic prop entry: viewfinder brackets pop in,
   countdown plays, flash, then a polaroid PRINTS DOWN from above
   and slides into a small "album" stub at the bottom.
============================================================ */
cats.camera = {
  label: 'Camera',
  desc: 'Pose → countdown → flash → print → save.',
  kind: 'scene',
  tone: 'white',
  variants: [
    { id: 'camera-snap', label: 'Snap & save', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['pose',     0.10],
          ['vfIn',     0.06],
          ['shrink',   0.05],
          ['count3',   0.07],
          ['count2',   0.07],
          ['count1',   0.07],
          ['flash',    0.04],
          ['print',    0.16],
          ['save',     0.10],
          ['grow',     0.06],
          ['done',     0.22],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'pose')   eyeEmo = 'eager';
        else if (ph.name === 'vfIn') eyeEmo = 'curious';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 40, ease.inOut(ph.p));
          eyeCy = lerp(CY, H - 36, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else if (ph.name.startsWith('count')) {
          eyeCx = 40; eyeCy = H - 36; eyeScale = 0.30; eyeEmo = 'eager';
        }
        else if (ph.name === 'flash') { eyeCx = 40; eyeCy = H - 36; eyeScale = 0.30; eyeEmo = 'surprised'; }
        else if (ph.name === 'print') { eyeCx = 40; eyeCy = H - 36; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'save')  { eyeCx = 40; eyeCy = H - 36; eyeScale = 0.30; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(40, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(H - 36, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        }
        else eyeEmo = 'satisfied';

        // Viewfinder brackets — fade in
        const vfOp = ph.name === 'pose' ? 0
                  : ph.name === 'vfIn' ? ease.out(ph.p)
                  : ['shrink','count3','count2','count1','flash'].includes(ph.name) ? 1
                  : ph.name === 'print' ? 1 - ease.in(ph.p)
                  : 0;

        const cx = W / 2, cy = CY - 10;

        // Polaroid — slides down from top during print, then over to album during save
        let polX = null, polY = null, polRot = 0;
        const albumX = W - 40, albumY = H - 50;
        if (ph.name === 'print') {
          polY = lerp(-100, cy, ease.out(ph.p));
          polX = cx;
        } else if (ph.name === 'save') {
          polX = lerp(cx, albumX, ease.inOut(ph.p));
          polY = lerp(cy, albumY, ease.inOut(ph.p));
          polRot = ph.p * 8;
        }

        return (
          <g>
            {/* viewfinder brackets */}
            <g opacity={vfOp} stroke="var(--eye)" strokeWidth={3} fill="none" strokeLinecap="round">
              <path d={`M ${cx - 70} ${cy - 40} L ${cx - 70} ${cy - 26}
                        M ${cx - 70} ${cy - 40} L ${cx - 56} ${cy - 40}`} />
              <path d={`M ${cx + 70} ${cy - 40} L ${cx + 70} ${cy - 26}
                        M ${cx + 70} ${cy - 40} L ${cx + 56} ${cy - 40}`} />
              <path d={`M ${cx - 70} ${cy + 40} L ${cx - 70} ${cy + 26}
                        M ${cx - 70} ${cy + 40} L ${cx - 56} ${cy + 40}`} />
              <path d={`M ${cx + 70} ${cy + 40} L ${cx + 70} ${cy + 26}
                        M ${cx + 70} ${cy + 40} L ${cx + 56} ${cy + 40}`} />
            </g>

            {/* countdown digit */}
            {ph.name.startsWith('count') && (
              <text x={cx} y={cy + 10} textAnchor="middle"
                    fontFamily="ui-monospace, Menlo, monospace"
                    fontSize={64} fontWeight={800}
                    fill="var(--accent)"
                    opacity={1 - ph.p * 0.4}>
                {ph.name === 'count3' ? '3' : ph.name === 'count2' ? '2' : '1'}
              </text>
            )}

            {/* flash */}
            {ph.name === 'flash' && (
              <rect x={0} y={0} width={W} height={H} fill="var(--eye)" opacity={0.95} />
            )}

            {/* polaroid */}
            {polX !== null && (
              <g transform={`translate(${polX} ${polY}) rotate(${polRot})`}>
                <rect x={-44} y={-50} width={88} height={100} rx={3}
                      fill="var(--eye)" />
                <rect x={-38} y={-44} width={76} height={70}
                      fill="var(--bg)" />
                {/* mini robot face on photo */}
                <g>
                  <rect x={-26} y={-26} width={20} height={26} rx={6}
                        fill="var(--accent)" />
                  <rect x={6}  y={-26} width={20} height={26} rx={6}
                        fill="var(--accent)" />
                  <path d="M -10 14 Q 0 22, 10 14"
                        fill="none" stroke="var(--accent)" strokeWidth={2}
                        strokeLinecap="round" />
                </g>
                <text x={0} y={42} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={8} fontWeight={700}
                      fill="var(--bg)" letterSpacing={1.5}>14:32</text>
              </g>
            )}

            {/* album stub at bottom-right (visible after save) */}
            {(ph.name === 'save' || ph.name === 'grow' || ph.name === 'done') && (
              <g transform={`translate(${albumX} ${albumY})`}>
                <rect x={-22} y={-26} width={44} height={50} rx={3}
                      fill="var(--eye)" opacity={0.5} />
                <rect x={-26} y={-22} width={44} height={50} rx={3}
                      fill="var(--eye)" opacity={0.7} />
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'pose'   ? 'POSE…' :
              ph.name === 'vfIn'   ? 'FRAMING' :
              ph.name === 'shrink' ? 'GET READY' :
              ph.name === 'count3' ? '3' :
              ph.name === 'count2' ? '2' :
              ph.name === 'count1' ? '1' :
              ph.name === 'flash'  ? 'SNAP!' :
              ph.name === 'print'  ? 'PRINTING' :
              ph.name === 'save'   ? 'INTO ALBUM' :
                                     'PHOTO SAVED'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   DELIVERY — bespoke (14s) — MAP-ROUTE variant
   A small map appears, a truck-dot moves along a path (waypoints),
   pings each waypoint, arrives at home pin, drops a box.
============================================================ */
cats.delivery = {
  label: 'Delivery',
  desc: 'Map → truck travels → arrives → box drops.',
  kind: 'scene',
  tone: 'orange',
  variants: [
    { id: 'delivery-route', label: 'On the way', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['waiting',  0.10],
          ['mapIn',    0.08],
          ['shrink',   0.05],
          ['route',    0.45],
          ['arrived',  0.06],
          ['boxDrop',  0.10],
          ['mapOut',   0.06],
          ['grow',     0.06],
          ['done',     0.04],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'waiting') eyeEmo = 'thinking';
        else if (ph.name === 'mapIn') eyeEmo = 'curious';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 42, ease.inOut(ph.p));
          eyeCy = lerp(CY, H - 30, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'eager';
        }
        else if (ph.name === 'route') { eyeCx = W - 42; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'eager'; }
        else if (ph.name === 'arrived') { eyeCx = W - 42; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'surprised'; }
        else if (ph.name === 'boxDrop') { eyeCx = W - 42; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'mapOut') { eyeCx = W - 42; eyeCy = H - 30; eyeScale = 0.30; eyeEmo = 'happy'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 42, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(H - 30, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else eyeEmo = 'happy';

        // Map opacity
        const mapOp = ph.name === 'waiting' ? 0
                    : ph.name === 'mapIn'  ? ease.out(ph.p)
                    : ['shrink','route','arrived','boxDrop'].includes(ph.name) ? 1
                    : ph.name === 'mapOut' ? 1 - ease.in(ph.p)
                    : 0;

        // Waypoints along an L-shape route
        const WP = [
          { x: 40, y: STATUS_H + 60 },
          { x: 140, y: STATUS_H + 60 },
          { x: 140, y: STATUS_H + 110 },
          { x: 230, y: STATUS_H + 110 },
          { x: 230, y: H - 50 }, // home
        ];
        const homeIdx = WP.length - 1;

        // truck position along route during 'route' phase
        let truck = WP[0];
        if (ph.name === 'route') {
          const totalSegs = WP.length - 1;
          const pos = ph.p * totalSegs;
          const i = Math.floor(pos);
          const f = pos - i;
          if (i >= totalSegs) truck = WP[homeIdx];
          else {
            truck = {
              x: lerp(WP[i].x, WP[i + 1].x, f),
              y: lerp(WP[i].y, WP[i + 1].y, f),
            };
          }
        } else if (['arrived','boxDrop','mapOut'].includes(ph.name)) {
          truck = WP[homeIdx];
        }

        // box drop animation at home
        const dropY = ph.name === 'boxDrop'
          ? lerp(-30, 0, ease.out(ph.p)) : 0;

        return (
          <g>
            <g opacity={mapOp}>
              {/* Route polyline */}
              <polyline
                points={WP.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none" stroke="var(--eye)" strokeWidth={2}
                strokeDasharray="4 4" opacity={0.5} />

              {/* Waypoint dots */}
              {WP.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.5}
                        fill={i === homeIdx ? 'var(--accent)' : 'var(--eye)'}
                        opacity={0.85} />
              ))}

              {/* Home pin */}
              <g transform={`translate(${WP[homeIdx].x} ${WP[homeIdx].y - 14})`}>
                <path d="M 0 8 L -6 0 L -6 -12 L 6 -12 L 6 0 Z"
                      fill="var(--accent)" />
                <rect x={-2} y={-8} width={4} height={6}
                      fill="var(--bg)" opacity={0.6} />
              </g>

              {/* Truck */}
              <g transform={`translate(${truck.x} ${truck.y})`}>
                <rect x={-10} y={-5} width={14} height={10} rx={1}
                      fill="var(--accent)" />
                <path d="M 4 -3 L 10 -3 L 10 5 L 4 5 Z"
                      fill="var(--accent)" />
                <circle cx={-6} cy={6} r={2} fill="var(--eye)" />
                <circle cx={2} cy={6} r={2} fill="var(--eye)" />
                <circle cx={9} cy={6} r={2} fill="var(--eye)" />
              </g>

              {/* Box dropping at home */}
              {(ph.name === 'boxDrop' || ph.name === 'mapOut') && (
                <g transform={`translate(${WP[homeIdx].x + 16} ${WP[homeIdx].y - 6 + dropY})`}>
                  <rect x={-7} y={-7} width={14} height={14} rx={1}
                        fill="var(--accent)" />
                  <line x1={0} y1={-7} x2={0} y2={7}
                        stroke="var(--bg)" strokeWidth={1.5} />
                </g>
              )}

              {/* Status text inside map */}
              <text x={40} y={H - 70}
                    fontFamily="ui-monospace, Menlo, monospace"
                    fontSize={9} fontWeight={700}
                    fill="var(--eye)" letterSpacing={2} opacity={0.7}>
                {ph.name === 'route' ? `ETA ${Math.max(1, 5 - Math.floor(ph.p * 5))} MIN` :
                 ph.name === 'arrived' ? 'AT YOUR DOOR' :
                 ph.name === 'boxDrop' ? 'DROPPED OFF' : ''}
              </text>
            </g>

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'waiting'  ? 'WAITING ON A BOX' :
              ph.name === 'mapIn'    ? 'TRACK PARCEL' :
              ph.name === 'shrink'   ? 'ON ITS WAY' :
              ph.name === 'route'    ? 'EN ROUTE' :
              ph.name === 'arrived'  ? 'IT\'S HERE!' :
              ph.name === 'boxDrop'  ? 'DELIVERED' :
              ph.name === 'mapOut'   ? 'PUT AWAY' :
                                       'GOT MY PARCEL'
            } />
          </g>
        );

      } },
  ],
};

/* ============================================================
   SHOPPING — bespoke (14s) — FILL THE BAG variant
   Empty bag sits center; items FLY IN from various corners
   one at a time landing into the bag; bag fills; checkout total.
============================================================ */
cats.shopping = {
  label: 'Shopping',
  desc: 'Empty bag → items fly in → checkout.',
  kind: 'scene',
  tone: 'green',
  variants: [
    { id: 'shopping-bag', label: 'Fill the bag', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['eager',     0.08],
          ['bagIn',     0.07],
          ['shrink',    0.05],
          ['item1',     0.10],
          ['item2',     0.10],
          ['item3',     0.10],
          ['item4',     0.10],
          ['total',     0.18],
          ['bagOut',    0.08],
          ['grow',      0.06],
          ['done',      0.08],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'eager';
        if (ph.name === 'eager') eyeEmo = 'eager';
        else if (ph.name === 'bagIn') eyeEmo = 'curious';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, 40, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 24, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.32, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else if (['item1','item2','item3','item4'].includes(ph.name)) {
          eyeCx = 40; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'happy';
        }
        else if (ph.name === 'total') { eyeCx = 40; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'satisfied'; }
        else if (ph.name === 'bagOut') { eyeCx = 40; eyeCy = STATUS_H + 24; eyeScale = 0.32; eyeEmo = 'satisfied'; }
        else if (ph.name === 'grow') {
          eyeCx = lerp(40, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 24, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.32, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        }
        else eyeEmo = 'satisfied';

        // Bag Y
        const bagRestY = CY + 30;
        let bagY = bagRestY;
        if (ph.name === 'eager') bagY = null;
        else if (ph.name === 'bagIn') bagY = lerp(H + 60, bagRestY, ease.out(ph.p));
        else if (ph.name === 'bagOut') bagY = lerp(bagRestY, H + 60, ease.in(ph.p));

        // Determine how many items are in the bag
        const itemPhases = ['item1','item2','item3','item4'];
        const itemIdx = itemPhases.indexOf(ph.name);
        const itemsIn = itemIdx >= 0 ? itemIdx : (['total','bagOut'].includes(ph.name) ? 4 : 0);

        // Items (apple=circle, milk=rect, bread=ellipse, star=star)
        const items = [
          { kind: 'circle', from: { x: -40, y: STATUS_H + 60 } },
          { kind: 'rect',   from: { x: W + 40, y: STATUS_H + 80 } },
          { kind: 'ellipse',from: { x: -40, y: H - 60 } },
          { kind: 'star',   from: { x: W + 40, y: STATUS_H + 50 } },
        ];

        const ITEM_RESTS = [
          { x: W / 2 - 14, y: bagRestY + 6 },
          { x: W / 2 + 6,  y: bagRestY + 4 },
          { x: W / 2 - 6,  y: bagRestY - 6 },
          { x: W / 2 + 14, y: bagRestY - 8 },
        ];

        // Total price tally
        const TOTALS = ['$2.50', '$5.00', '$7.50', '$10.00'];
        const total = itemsIn > 0 ? TOTALS[itemsIn - 1] : '$0.00';

        const drawItem = (i, x, y) => {
          if (items[i].kind === 'circle')
            return <circle key={i} cx={x} cy={y} r={9} fill="var(--accent)" />;
          if (items[i].kind === 'rect')
            return <rect key={i} x={x - 7} y={y - 11} width={14} height={22} rx={2}
                         fill="var(--accent)" />;
          if (items[i].kind === 'ellipse')
            return <ellipse key={i} cx={x} cy={y} rx={11} ry={6}
                            fill="var(--accent)" />;
          if (items[i].kind === 'star')
            return <path key={i} d={starPath(x, y, 9, 4)} fill="var(--accent)" />;
        };

        return (
          <g>
            {/* bag */}
            {bagY !== null && (
              <g transform={`translate(${W / 2} ${bagY})`}>
                <path d="M -22 -18 Q -22 -36, 0 -36 Q 22 -36, 22 -18"
                      fill="none" stroke="var(--eye)" strokeWidth={4} />
                <path d="M -34 -16 L 34 -16 L 28 32 L -28 32 Z"
                      fill="var(--eye)" />
              </g>
            )}

            {/* items in bag (settled) */}
            {ph.name !== 'eager' && ph.name !== 'bagIn' && ph.name !== 'bagOut' &&
              Array.from({ length: itemsIn }).map((_, i) =>
                drawItem(i, ITEM_RESTS[i].x, ITEM_RESTS[i].y)
              )
            }
            {ph.name === 'bagOut' && Array.from({ length: 4 }).map((_, i) =>
              drawItem(i, ITEM_RESTS[i].x, ITEM_RESTS[i].y + (1 - bagY < 0 ? 0 : (bagY - bagRestY)))
            )}

            {/* current incoming item — flies from corner */}
            {itemIdx >= 0 && (() => {
              const item = items[itemIdx];
              const rest = ITEM_RESTS[itemIdx];
              const x = lerp(item.from.x, rest.x, ease.out(ph.p));
              const y = lerp(item.from.y, rest.y, ease.out(ph.p));
              return drawItem(itemIdx, x, y);
            })()}

            {/* total price + receipt during total phase */}
            {ph.name === 'total' && (
              <g>
                <text x={W - 60} y={STATUS_H + 80} textAnchor="end"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={9} fontWeight={700}
                      fill="var(--eye)" letterSpacing={2} opacity={0.7}>
                  TOTAL
                </text>
                <text x={W - 60} y={STATUS_H + 102} textAnchor="end"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={20} fontWeight={800}
                      fill="var(--accent)">{total}</text>
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'eager'  ? 'TIME TO SHOP' :
              ph.name === 'bagIn'  ? 'GRAB A BAG' :
              ph.name === 'shrink' ? 'LET\'S GO' :
              ph.name === 'item1'  ? 'APPLE' :
              ph.name === 'item2'  ? 'MILK' :
              ph.name === 'item3'  ? 'BREAD' :
              ph.name === 'item4'  ? 'TREAT!' :
              ph.name === 'total'  ? `PAID · ${total}` :
              ph.name === 'bagOut' ? 'HEADING HOME' :
                                     'NICE HAUL'
            } />
          </g>
        );
      } },
  ],
};

/* ============================================================
   SMARTHOME — bespoke (14s) — ROOMS LIGHT UP variant
   House outline with 4 rooms; each room lights up sequentially
   as the robot "taps" a remote; final all-on glow then powers down.
============================================================ */
cats.smarthome = {
  label: 'Smart home',
  desc: 'House → rooms light up one by one → all on → off.',
  kind: 'scene',
  tone: 'warm',
  variants: [
    { id: 'home-lights', label: 'Lights on', duration: 14000,
      render: (t) => {
        const ph = phases(t, [
          ['curious',   0.08],
          ['houseIn',   0.10],
          ['shrink',    0.05],
          ['room1',     0.10],
          ['room2',     0.10],
          ['room3',     0.10],
          ['room4',     0.10],
          ['allOn',     0.10],
          ['off',       0.07],
          ['houseOut',  0.06],
          ['grow',      0.06],
          ['done',      0.08],
        ]);

        let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'curious';
        if (ph.name === 'curious') eyeEmo = 'curious';
        else if (ph.name === 'houseIn') eyeEmo = 'eager';
        else if (ph.name === 'shrink') {
          eyeCx = lerp(W / 2, W - 36, ease.inOut(ph.p));
          eyeCy = lerp(CY, STATUS_H + 26, ease.inOut(ph.p));
          eyeScale = lerp(1, 0.30, ease.inOut(ph.p));
          eyeEmo = 'happy';
        }
        else if (ph.name.startsWith('room')) {
          eyeCx = W - 36; eyeCy = STATUS_H + 26; eyeScale = 0.30; eyeEmo = 'happy';
        }
        else if (ph.name === 'allOn') {
          eyeCx = W - 36; eyeCy = STATUS_H + 26; eyeScale = 0.30; eyeEmo = 'excited';
        }
        else if (ph.name === 'off') {
          eyeCx = W - 36; eyeCy = STATUS_H + 26; eyeScale = 0.30; eyeEmo = 'satisfied';
        }
        else if (ph.name === 'houseOut') {
          eyeCx = W - 36; eyeCy = STATUS_H + 26; eyeScale = 0.30; eyeEmo = 'satisfied';
        }
        else if (ph.name === 'grow') {
          eyeCx = lerp(W - 36, W / 2, ease.inOut(ph.p));
          eyeCy = lerp(STATUS_H + 26, CY, ease.inOut(ph.p));
          eyeScale = lerp(0.30, 1, ease.inOut(ph.p));
          eyeEmo = 'satisfied';
        }
        else eyeEmo = 'satisfied';

        // House opacity
        const houseOp = ph.name === 'curious' ? 0
                      : ph.name === 'houseIn' ? ease.out(ph.p)
                      : ph.name === 'houseOut' ? 1 - ease.in(ph.p)
                      : 1;

        const houseCx = W / 2, houseCy = CY + 10;

        // Room states (lit?)
        const ROOM_INDEX_BY_PHASE = { room1: 1, room2: 2, room3: 3, room4: 4, allOn: 4, off: 4 };
        const roomsLit = ROOM_INDEX_BY_PHASE[ph.name] || 0;
        const allOn = ph.name === 'allOn' || ph.name === 'off';
        const dimming = ph.name === 'off' ? ph.p : 0;

        const rooms = [
          { x: -34, y: -20 },
          { x:  34, y: -20 },
          { x: -34, y:  18 },
          { x:  34, y:  18 },
        ];

        return (
          <g opacity={houseOp}>
            {/* house outline */}
            <g transform={`translate(${houseCx} ${houseCy})`}
               stroke="var(--eye)" strokeWidth={3} fill="none" strokeLinecap="round"
               strokeLinejoin="round">
              <path d="M -64 32 L -64 -10 L 0 -54 L 64 -10 L 64 32 Z" />
              <line x1={-64} y1={-10} x2={64} y2={-10} />
              <line x1={0} y1={-10} x2={0} y2={32} />
              <rect x={-10} y={14} width={20} height={18} />
            </g>

            {/* room indicators (windows / circles) */}
            {rooms.map((r, i) => {
              const isLit = (i + 1) <= roomsLit;
              const glow = isLit && !dimming ? 1 : (dimming ? 1 - dimming : 0.3);
              return (
                <g key={i} transform={`translate(${houseCx + r.x} ${houseCy + r.y})`}>
                  <circle cx={0} cy={0} r={9}
                          fill={isLit ? 'var(--accent)' : 'var(--eye)'}
                          opacity={glow} />
                  {isLit && !dimming && (
                    /* glow ring */
                    <circle cx={0} cy={0} r={14}
                            fill="none" stroke="var(--accent)" strokeWidth={1.5}
                            opacity={0.4} />
                  )}
                </g>
              );
            })}

            {/* All-on aura */}
            {allOn && (
              <g opacity={(1 - dimming) * 0.4}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                  const a = (i / 8) * TAU + t * 0.3;
                  return (
                    <line key={i}
                          x1={houseCx + Math.cos(a) * 88}
                          y1={houseCy + Math.sin(a) * 88}
                          x2={houseCx + Math.cos(a) * 100}
                          y2={houseCy + Math.sin(a) * 100}
                          stroke="var(--accent)" strokeWidth={3}
                          strokeLinecap="round" />
                  );
                })}
              </g>
            )}

            {/* remote/click indicator at lower-left */}
            {(ph.name.startsWith('room') || ph.name === 'off') && (
              <g transform={`translate(40 ${H - 36})`}>
                <rect x={-14} y={-20} width={28} height={40} rx={4}
                      fill="var(--eye)" opacity={0.85} />
                <circle cx={0} cy={-8} r={3}
                        fill="var(--accent)"
                        opacity={Math.sin(t * TAU * 4) > 0 ? 1 : 0.3} />
                {[0, 1, 2].map((i) => (
                  <rect key={i} x={-8} y={0 + i * 6} width={16} height={3} rx={1.5}
                        fill="var(--bg)" opacity={0.6} />
                ))}
              </g>
            )}

            <PlacedFace cx={eyeCx} cy={eyeCy} scale={eyeScale}
                        emotion={eyeEmo} t={t} />

            <ActLabel text={
              ph.name === 'curious'  ? 'COMING HOME' :
              ph.name === 'houseIn'  ? 'HOME SWEET HOME' :
              ph.name === 'shrink'   ? 'GOOD EVENING' :
              ph.name === 'room1'    ? 'LIVING · ON' :
              ph.name === 'room2'    ? 'KITCHEN · ON' :
              ph.name === 'room3'    ? 'BEDROOM · ON' :
              ph.name === 'room4'    ? 'STUDY · ON' :
              ph.name === 'allOn'    ? '4 / 4 ROOMS' :
              ph.name === 'off'      ? 'POWERING DOWN' :
              ph.name === 'houseOut' ? 'GOODNIGHT' :
                                       'ENERGY SAVED'
            } />
          </g>
        );
      } },
  ],
};
