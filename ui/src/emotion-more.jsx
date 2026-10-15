// SPDX-License-Identifier: MIT
/* Emotion library — MORE
   Adds 8 brand-new emotion categories (3 variants each = 24 new variants):
     disgusted · nervous · embarrassed · curious ·
     annoyed · cool · suspicious · determined
   Loaded AFTER emotion-balance.jsx. Inserts the new keys into
   window.EMOTION_CATEGORY_KEYS at thematically-appropriate positions
   (kept BEFORE scene keys so emotions stay grouped).
*/

const {
  W, H, STATUS_H, CY, GAP, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, wrap, ease, pulse, blink,
  Eye, Eyes, heartPath, starPath, arcPath,
} = window.EmotionCore;

const cats = window.EMOTION_CATEGORIES;

const baseEyes = (L = {}, R = {}) => <Eyes L={L} R={R} />;

// upper-lid mask (covers from top of eye down to drop px)
function topLidM(eyeCx, eyeY, drop) {
  return (
    <polygon
      points={`
        ${eyeCx - EYE_W/2 - 6},${eyeY - EYE_H/2 - 6}
        ${eyeCx + EYE_W/2 + 6},${eyeY - EYE_H/2 - 6}
        ${eyeCx + EYE_W/2 + 6},${eyeY - EYE_H/2 + drop}
        ${eyeCx - EYE_W/2 - 6},${eyeY - EYE_H/2 + drop}
      `}
      fill="var(--bg)"
    />
  );
}
// lower-lid mask (covers from bottom of eye up to lift px)
function botLidM(eyeCx, eyeY, lift) {
  return (
    <polygon
      points={`
        ${eyeCx - EYE_W/2 - 6},${eyeY + EYE_H/2 - lift}
        ${eyeCx + EYE_W/2 + 6},${eyeY + EYE_H/2 - lift}
        ${eyeCx + EYE_W/2 + 6},${eyeY + EYE_H/2 + 6}
        ${eyeCx - EYE_W/2 - 6},${eyeY + EYE_H/2 + 6}
      `}
      fill="var(--bg)"
    />
  );
}

// =============================================================
// DISGUSTED — 3 variants
// =============================================================
cats.disgusted = {
  label: 'Disgusted',
  desc: 'Rejection / yuck.',
  kind: 'emotion',
  variants: [

    { id: 'disgusted-yuck', label: 'Yuck', duration: 2200,
      render: (t) => {
        // Asymmetric: left squinted hard, right half-open. Tongue out below.
        const wob = Math.sin(t * TAU * 2) * 1.5;
        return (
          <g>
            <Eyes
              L={{ h: 10, y: CY + wob, rx: 6 }}
              R={{ h: EYE_H * 0.45, y: CY + 4, rx: 14 }}
            />
            {/* upper brows angled disgust */}
            <line x1={LX - 32} y1={CY - 26} x2={LX + 28} y2={CY - 38}
                  stroke="var(--eye)" strokeWidth={6} strokeLinecap="round" />
            <line x1={RX - 26} y1={CY - 34} x2={RX + 30} y2={CY - 28}
                  stroke="var(--eye)" strokeWidth={6} strokeLinecap="round" />
            {/* tongue */}
            <path d={`M ${W/2 - 14} ${H - 28}
                      Q ${W/2} ${H - 18 + wob}, ${W/2 + 14} ${H - 28}
                      L ${W/2 + 12} ${H - 16}
                      Q ${W/2} ${H - 8 + wob}, ${W/2 - 12} ${H - 16} Z`}
                  fill="var(--accent)" opacity={0.85} />
          </g>
        );
      } },

    { id: 'disgusted-gag', label: 'Gag', duration: 1600,
      render: (t) => {
        // Eyes go wide on gag, lower lid pushes up; throat puff at bottom.
        const gag = pulse(t, 0.4, 0.2);
        const sz = 1 + gag * 0.18;
        return (
          <g>
            <Eyes L={{ w: EYE_W * sz, h: EYE_H * sz }}
                  R={{ w: EYE_W * sz, h: EYE_H * sz }} />
            {botLidM(LX, CY, 14 + gag * 10)}
            {botLidM(RX, CY, 14 + gag * 10)}
            {/* shrunken pupils */}
            <circle cx={LX} cy={CY - 6} r={6} fill="var(--bg)" />
            <circle cx={RX} cy={CY - 6} r={6} fill="var(--bg)" />
            {/* gag puff */}
            <ellipse cx={W/2} cy={H - 22} rx={14 + gag * 10} ry={8 + gag * 6}
                     fill="none" stroke="var(--accent)" strokeWidth={3} opacity={0.8} />
            <path d={`M ${W/2 - 6} ${H - 24} Q ${W/2} ${H - 30}, ${W/2 + 6} ${H - 24}`}
                  fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'disgusted-sour', label: 'Sour', duration: 2600,
      render: (t) => {
        // Lemon-sour face: tight squint, puckered mouth at bottom.
        const pucker = 0.85 + Math.sin(t * TAU) * 0.15;
        return (
          <g>
            <Eyes L={{ h: 14, rx: 6, y: CY }} R={{ h: 14, rx: 6, y: CY }} />
            {/* squint diagonal creases at outer corners */}
            <g stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" opacity={0.7}>
              <line x1={LX - 36} y1={CY - 6} x2={LX - 22} y2={CY - 12} />
              <line x1={LX - 36} y1={CY + 6} x2={LX - 22} y2={CY + 12} />
              <line x1={RX + 36} y1={CY - 6} x2={RX + 22} y2={CY - 12} />
              <line x1={RX + 36} y1={CY + 6} x2={RX + 22} y2={CY + 12} />
            </g>
            {/* puckered mouth */}
            <circle cx={W/2} cy={H - 28} r={6 * pucker} fill="none"
                    stroke="var(--eye)" strokeWidth={4} />
            <circle cx={W/2} cy={H - 28} r={2} fill="var(--eye)" />
          </g>
        );
      } },
  ],
};

// =============================================================
// NERVOUS — 3 variants
// =============================================================
cats.nervous = {
  label: 'Nervous',
  desc: 'Anxious / jittery.',
  kind: 'emotion',
  variants: [

    { id: 'nervous-sweat', label: 'Sweat drop', duration: 2200,
      render: (t) => {
        // Wide eyes with little pupils + a sweat drop sliding on right side.
        const tremor = Math.sin(t * TAU * 9) * 0.8;
        const drop = (t * 1.4) % 1;
        return (
          <g transform={`translate(${tremor} 0)`}>
            <Eyes L={{ w: EYE_W * 1.1, h: EYE_H * 1.05 }}
                  R={{ w: EYE_W * 1.1, h: EYE_H * 1.05 }} />
            <circle cx={LX} cy={CY + 2} r={9} fill="var(--bg)" />
            <circle cx={RX} cy={CY + 2} r={9} fill="var(--bg)" />
            {/* sweat drop sliding down right side */}
            <path d={`M ${RX + 50} ${CY - 30 + drop * 70}
                      C ${RX + 56} ${CY - 18 + drop * 70},
                        ${RX + 56} ${CY - 26 + drop * 70},
                        ${RX + 50} ${CY - 38 + drop * 70} Z`}
                  fill="var(--accent)" opacity={1 - drop * 0.4} />
          </g>
        );
      } },

    { id: 'nervous-fidget', label: 'Fidget', duration: 1600,
      render: (t) => {
        // Pupils dart back and forth rapidly; small fidgety body shake.
        const dx = Math.sin(t * TAU * 5) * 10;
        const sh = Math.cos(t * TAU * 9) * 1.5;
        return (
          <g transform={`translate(${sh} 0)`}>
            <Eyes L={{ h: EYE_H * 0.85 }} R={{ h: EYE_H * 0.85 }} />
            <circle cx={LX + dx} cy={CY} r={9} fill="var(--bg)" />
            <circle cx={RX + dx} cy={CY} r={9} fill="var(--bg)" />
            {/* worried wavy mouth */}
            <path d={`M ${W/2 - 18} ${H - 26}
                      Q ${W/2 - 9} ${H - 30}, ${W/2} ${H - 26}
                      T ${W/2 + 18} ${H - 26}`}
                  fill="none" stroke="var(--eye)" strokeWidth={3.5}
                  strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'nervous-gulp', label: 'Gulp', duration: 2400,
      render: (t) => {
        // Wide eyes; a "gulp" bubble travels down a vertical line at center.
        const gulp = pulse(t, 0.5, 0.18);
        const fy = ((t * 1) % 1);
        return (
          <g>
            <Eyes L={{ w: EYE_W * 1.05, h: EYE_H * (1 - gulp * 0.05) }}
                  R={{ w: EYE_W * 1.05, h: EYE_H * (1 - gulp * 0.05) }} />
            {/* upper-lid lowers slightly on gulp */}
            {topLidM(LX, CY, 10 + gulp * 6)}
            {topLidM(RX, CY, 10 + gulp * 6)}
            <circle cx={LX} cy={CY - 4} r={8} fill="var(--bg)" />
            <circle cx={RX} cy={CY - 4} r={8} fill="var(--bg)" />
            {/* gulp travelling bubble */}
            <circle cx={W/2} cy={lerp(CY + 10, H - 14, fy)}
                    r={6 - fy * 2} fill="var(--accent)" opacity={1 - fy * 0.4} />
          </g>
        );
      } },
  ],
};

// =============================================================
// EMBARRASSED — 3 variants
// =============================================================
cats.embarrassed = {
  label: 'Embarrassed',
  desc: 'Flushed / mortified.',
  kind: 'emotion',
  variants: [

    { id: 'embarrassed-blush', label: 'Big blush', duration: 2400,
      render: (t) => {
        // Eyes look away to lower-left; big checkered blush patches.
        const side = Math.sin(t * TAU * 0.6) * 12 - 6;
        const stripe = (i) => i % 2 === 0 ? 1 : 0.45;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.65, y: CY + 4 }}
                  R={{ h: EYE_H * 0.65, y: CY + 4 }} />
            <circle cx={LX + side} cy={CY + 12} r={9} fill="var(--bg)" />
            <circle cx={RX + side} cy={CY + 12} r={9} fill="var(--bg)" />
            {/* hatched blush patches */}
            {[LX, RX].map((cx) => (
              <g key={cx} transform={`translate(${cx - 22} ${CY + 36})`}>
                {[0, 1, 2, 3].map((i) => (
                  <line key={i} x1={i * 11} y1={0} x2={i * 11 - 6} y2={10}
                        stroke="var(--accent)" strokeWidth={3} strokeLinecap="round"
                        opacity={stripe(i)} />
                ))}
              </g>
            ))}
          </g>
        );
      } },

    { id: 'embarrassed-hide', label: 'Hide eyes', duration: 2800,
      render: (t) => {
        // Eyes mostly hidden by upper lid; tiny peek through cracks.
        const peek = (Math.sin(t * TAU) + 1) / 2; // 0 hidden, 1 cracked
        const drop = lerp(EYE_H + 4, EYE_H * 0.7, peek);
        return (
          <g>
            <Eyes />
            {topLidM(LX, CY, drop)}
            {topLidM(RX, CY, drop)}
            {/* hand-like vertical bars partially covering — stylized */}
            <g fill="var(--bg)">
              <rect x={LX - 38} y={STATUS_H + 2} width={10} height={H} />
              <rect x={LX + 4} y={STATUS_H + 2} width={10} height={H} />
              <rect x={RX - 14} y={STATUS_H + 2} width={10} height={H} />
              <rect x={RX + 28} y={STATUS_H + 2} width={10} height={H} />
            </g>
            {/* outline of fingers */}
            <g stroke="var(--accent)" strokeWidth={1.5} fill="none" opacity={0.55}>
              <line x1={LX - 28} y1={STATUS_H + 4} x2={LX - 28} y2={H - 4} />
              <line x1={LX + 14} y1={STATUS_H + 4} x2={LX + 14} y2={H - 4} />
              <line x1={RX - 24} y1={STATUS_H + 4} x2={RX - 24} y2={H - 4} />
              <line x1={RX + 18} y1={STATUS_H + 4} x2={RX + 18} y2={H - 4} />
            </g>
          </g>
        );
      } },

    { id: 'embarrassed-cringe', label: 'Cringe', duration: 1800,
      render: (t) => {
        // Squint hard, slight head wobble, gritted teeth row at bottom.
        const wob = Math.sin(t * TAU * 3) * 1.5;
        return (
          <g transform={`translate(0 ${wob})`}>
            <Eyes L={{ h: 14, rx: 6, y: CY + 4 }}
                  R={{ h: 14, rx: 6, y: CY + 4 }} />
            {/* tight V brows */}
            <g stroke="var(--eye)" strokeWidth={6} strokeLinecap="round">
              <line x1={LX - 30} y1={CY - 32} x2={LX + 26} y2={CY - 14} />
              <line x1={RX + 30} y1={CY - 32} x2={RX - 26} y2={CY - 14} />
            </g>
            {/* gritted teeth — small vertical bars on a mouth line */}
            <rect x={W/2 - 32} y={H - 28} width={64} height={10} rx={2}
                  fill="none" stroke="var(--eye)" strokeWidth={2.5} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line key={i} x1={W/2 - 30 + i * 11} y1={H - 26}
                    x2={W/2 - 30 + i * 11} y2={H - 20}
                    stroke="var(--eye)" strokeWidth={2} />
            ))}
          </g>
        );
      } },
  ],
};

// =============================================================
// CURIOUS — 3 variants
// =============================================================
cats.curious = {
  label: 'Curious',
  desc: 'Wondering / leaning in.',
  kind: 'emotion',
  variants: [

    { id: 'curious-lean', label: 'Lean in', duration: 2800,
      render: (t) => {
        // Eyes slightly larger, drift forward; subtle tilt.
        const lean = (Math.sin(t * TAU - Math.PI / 2) + 1) / 2;
        const tilt = Math.sin(t * TAU) * 4;
        const s = 1 + lean * 0.06;
        return (
          <g transform={`rotate(${tilt} ${W/2} ${CY})`}>
            <Eyes L={{ w: EYE_W * s, h: EYE_H * s }}
                  R={{ w: EYE_W * s, h: EYE_H * s }} />
            {/* tiny pupils to suggest focus */}
            <circle cx={LX} cy={CY - 2} r={10} fill="var(--bg)" />
            <circle cx={RX} cy={CY - 2} r={10} fill="var(--bg)" />
          </g>
        );
      } },

    { id: 'curious-sparkle', label: 'Sparkle eyes', duration: 2000,
      render: (t) => {
        // Wide eyes with a single shiny sparkle inside each.
        const sp = pulse(t, 0.5, 0.3);
        return (
          <g>
            <Eyes L={{ w: EYE_W * 1.05, h: EYE_H * 1.05 }}
                  R={{ w: EYE_W * 1.05, h: EYE_H * 1.05 }} />
            {[LX, RX].map((cx) => (
              <g key={cx} fill="var(--bg)">
                <circle cx={cx + 10} cy={CY - 14} r={6} />
                <circle cx={cx - 14} cy={CY + 10} r={3} />
              </g>
            ))}
            {/* outer floating sparkle */}
            {sp > 0.05 && (
              <g opacity={sp}>
                <path d={starPath(W/2, STATUS_H + 30, 6 + sp * 4, 2)} fill="var(--accent)" />
              </g>
            )}
          </g>
        );
      } },

    { id: 'curious-scan', label: 'Tilt scan', duration: 3200,
      render: (t) => {
        // Slow head tilt while pupils scan side to side.
        const tilt = Math.sin(t * TAU * 0.5) * 10;
        const dx = Math.sin(t * TAU) * 12;
        return (
          <g transform={`rotate(${tilt} ${W/2} ${CY})`}>
            <Eyes L={{ h: EYE_H * 0.95 }} R={{ h: EYE_H * 0.95 }} />
            <circle cx={LX + dx} cy={CY} r={11} fill="var(--bg)" />
            <circle cx={RX + dx} cy={CY} r={11} fill="var(--bg)" />
            <circle cx={W/2 + dx * 0.4} cy={H - 32} r={3} fill="var(--accent)" opacity={0.55} />
          </g>
        );
      } },
  ],
};

// =============================================================
// ANNOYED — 3 variants
// =============================================================
cats.annoyed = {
  label: 'Annoyed',
  desc: 'Mild irritation.',
  kind: 'emotion',
  variants: [

    { id: 'annoyed-flat', label: 'Flat line', duration: 3000,
      render: (t) => {
        // Long flat horizontal eye-bars with a deadpan twitch.
        const tw = (t > 0.45 && t < 0.5) ? 3 : 0;
        return (
          <g transform={`translate(0 ${tw})`}>
            <Eyes L={{ h: 10, rx: 5, w: EYE_W * 1.05 }}
                  R={{ h: 10, rx: 5, w: EYE_W * 1.05 }} />
            {/* slightly angled-down brows */}
            <line x1={LX - 32} y1={CY - 28} x2={LX + 28} y2={CY - 22}
                  stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
            <line x1={RX + 32} y1={CY - 28} x2={RX - 28} y2={CY - 22}
                  stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
            {/* flat mouth */}
            <line x1={W/2 - 18} y1={H - 26} x2={W/2 + 18} y2={H - 26}
                  stroke="var(--eye)" strokeWidth={4} strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'annoyed-twitch', label: 'Eye twitch', duration: 2400,
      render: (t) => {
        // Left eye twitches periodically; right stays steady half-closed.
        const tw = (t > 0.55 && t < 0.62) ? Math.sin((t - 0.55) / 0.07 * Math.PI) * 8 : 0;
        const burst = (t > 0.55 && t < 0.62);
        return (
          <g>
            <Eyes
              L={{ h: burst ? 6 : EYE_H * 0.45, rx: 10, y: CY + 6, x: LX + tw * 0.3 }}
              R={{ h: EYE_H * 0.45, rx: 10, y: CY + 6 }} />
            {/* angled-in brows */}
            <line x1={LX - 32} y1={CY - 30 - tw} x2={LX + 28} y2={CY - 20}
                  stroke="var(--eye)" strokeWidth={6} strokeLinecap="round" />
            <line x1={RX + 32} y1={CY - 30} x2={RX - 28} y2={CY - 20}
                  stroke="var(--eye)" strokeWidth={6} strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'annoyed-sigh-side', label: 'Side sigh', duration: 3200,
      render: (t) => {
        // Eyes look to the side; sigh puff drifts away from mouth.
        const side = Math.sin(t * TAU * 0.6) * 8 + 6;
        const phase = ((t * 1) % 1);
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.5, y: CY + 6, rx: 12 }}
                  R={{ h: EYE_H * 0.5, y: CY + 6, rx: 12 }} />
            <circle cx={LX + side} cy={CY + 10} r={8} fill="var(--bg)" />
            <circle cx={RX + side} cy={CY + 10} r={8} fill="var(--bg)" />
            {/* sigh puff drifting up-right */}
            {phase > 0.35 && (
              <ellipse cx={W/2 + 20 + (phase - 0.35) * 40}
                       cy={H - 28 - (phase - 0.35) * 24}
                       rx={5 + (phase - 0.35) * 4} ry={3 + (phase - 0.35) * 2}
                       fill="none" stroke="var(--accent)" strokeWidth={2}
                       opacity={1 - (phase - 0.35) * 1.5} />
            )}
          </g>
        );
      } },
  ],
};

// =============================================================
// COOL — 3 variants
// =============================================================
cats.cool = {
  label: 'Cool',
  desc: 'Confident / chill.',
  kind: 'emotion',
  variants: [

    { id: 'cool-shades', label: 'Shades', duration: 2400,
      render: (t) => {
        // Sunglasses-shape lenses cover the eyes; drop in from above.
        const drop = t < 0.25 ? lerp(-80, 0, ease.out(t / 0.25)) : 0;
        const glint = ((t - 0.3) * 1.5) % 1;
        return (
          <g transform={`translate(0 ${drop})`}>
            <Eyes L={{ h: EYE_H * 0.55, y: CY + 4 }}
                  R={{ h: EYE_H * 0.55, y: CY + 4 }} />
            {/* shades — two rounded rects + bridge + frame on top */}
            <g fill="var(--accent)">
              <rect x={LX - 44} y={CY - 22} width={88} height={36} rx={14} />
              <rect x={RX - 44} y={CY - 22} width={88} height={36} rx={14} />
              <rect x={LX + 44} y={CY - 6} width={RX - LX - 88} height={4} />
            </g>
            <line x1={20} y1={CY - 24} x2={W - 20} y2={CY - 24}
                  stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />
            {/* glint sliding across the right lens */}
            {drop === 0 && glint > 0 && glint < 0.6 && (
              <g opacity={1 - glint / 0.6}>
                <line x1={RX - 30 + glint * 60} y1={CY - 16}
                      x2={RX - 22 + glint * 60} y2={CY + 4}
                      stroke="var(--bg)" strokeWidth={4} strokeLinecap="round" />
              </g>
            )}
            {/* tiny smirk below */}
            <path d={`M ${W/2 - 22} ${H - 24} Q ${W/2 + 4} ${H - 32}, ${W/2 + 24} ${H - 20}`}
                  fill="none" stroke="var(--eye)" strokeWidth={4} strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'cool-smirk', label: 'Smooth smirk', duration: 2800,
      render: (t) => {
        // Half-closed eyes with slow lazy blink and a steady tilted smirk.
        const b = pulse(t, 0.7, 0.12);
        const h = lerp(EYE_H * 0.4, 4, b);
        return (
          <g>
            <Eyes L={{ h, y: CY + 8, rx: 10 }} R={{ h, y: CY + 8, rx: 10 }} />
            {/* shadow above (cool/half-lidded) */}
            {topLidM(LX, CY, 30)}
            {topLidM(RX, CY, 30)}
            {/* smirk that lifts more on the right */}
            <path d={`M ${W/2 - 30} ${H - 26}
                      Q ${W/2 + 6} ${H - 38}, ${W/2 + 30} ${H - 20}`}
                  fill="none" stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'cool-swag', label: 'Swag sway', duration: 2200,
      render: (t) => {
        // Slow side-to-side sway; small head tilt, half-closed eyes.
        const sway = Math.sin(t * TAU) * 8;
        const tilt = Math.sin(t * TAU) * 4;
        return (
          <g transform={`translate(${sway} 0) rotate(${tilt} ${W/2} ${CY})`}>
            <Eyes L={{ h: EYE_H * 0.5, y: CY + 6 }}
                  R={{ h: EYE_H * 0.5, y: CY + 6 }} />
            {topLidM(LX, CY, 26)}
            {topLidM(RX, CY, 26)}
            {/* music notes drifting off corner */}
            {[0, 1].map((i) => {
              const p = ((t * 1.4) + i * 0.5) % 1;
              const x = W - 30 + p * 18;
              const y = STATUS_H + 18 - p * 14;
              return (
                <g key={i} fill="var(--accent)" opacity={1 - p}>
                  <ellipse cx={x} cy={y + 4} rx={4} ry={3} transform={`rotate(-15 ${x} ${y + 4})`} />
                  <rect x={x + 2} y={y - 10} width={2.5} height={16} />
                </g>
              );
            })}
          </g>
        );
      } },
  ],
};

// =============================================================
// SUSPICIOUS — 3 variants
// =============================================================
cats.suspicious = {
  label: 'Suspicious',
  desc: 'Skeptical / squinting.',
  kind: 'emotion',
  variants: [

    { id: 'suspicious-squint', label: 'Hard squint', duration: 2400,
      render: (t) => {
        // Both eyes squinted; pupils slowly scan.
        const dx = Math.sin(t * TAU * 0.7) * 10;
        return (
          <g>
            <Eyes L={{ h: 16, rx: 8, y: CY }}
                  R={{ h: 16, rx: 8, y: CY }} />
            <circle cx={LX + dx} cy={CY} r={5} fill="var(--bg)" />
            <circle cx={RX + dx} cy={CY} r={5} fill="var(--bg)" />
            {/* angled brows close above */}
            <line x1={LX - 36} y1={CY - 22} x2={LX + 30} y2={CY - 12}
                  stroke="var(--eye)" strokeWidth={6} strokeLinecap="round" />
            <line x1={RX + 36} y1={CY - 22} x2={RX - 30} y2={CY - 12}
                  stroke="var(--eye)" strokeWidth={6} strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'suspicious-side', label: 'Side eye', duration: 2800,
      render: (t) => {
        // Eyes glance hard to one side with narrow lids — locked, not scanning.
        const side = (t < 0.5) ? 16 : -16;
        const settle = (t < 0.06 || (t > 0.5 && t < 0.56))
          ? Math.sin(((t < 0.5 ? t : t - 0.5) / 0.06) * Math.PI) * 6 : 0;
        return (
          <g>
            <Eyes L={{ h: 22, rx: 10, y: CY + 2 }}
                  R={{ h: 22, rx: 10, y: CY + 2 }} />
            <circle cx={LX + side + settle} cy={CY + 2} r={8} fill="var(--bg)" />
            <circle cx={RX + side + settle} cy={CY + 2} r={8} fill="var(--bg)" />
            {/* one raised brow */}
            <line x1={LX - 30} y1={CY - 24} x2={LX + 30} y2={CY - 18}
                  stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
            <line x1={RX - 28} y1={CY - 32} x2={RX + 30} y2={CY - 18}
                  stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'suspicious-scan', label: 'Scan slowly', duration: 4000,
      render: (t) => {
        // Slow back-and-forth scan with narrowed eyes, with a faint scanner line.
        const dx = Math.sin(t * TAU) * 16;
        return (
          <g>
            <Eyes L={{ h: 20, rx: 8 }} R={{ h: 20, rx: 8 }} />
            <circle cx={LX + dx} cy={CY} r={6} fill="var(--bg)" />
            <circle cx={RX + dx} cy={CY} r={6} fill="var(--bg)" />
            {/* faint horizontal scan line below */}
            <line x1={20} y1={H - 22} x2={W - 20} y2={H - 22}
                  stroke="var(--accent)" strokeWidth={1} opacity={0.3} />
            <circle cx={lerp(20, W - 20, (Math.sin(t * TAU) + 1) / 2)} cy={H - 22}
                    r={3} fill="var(--accent)" />
          </g>
        );
      } },
  ],
};

// =============================================================
// DETERMINED — 3 variants
// =============================================================
cats.determined = {
  label: 'Determined',
  desc: 'Resolute / locked-in.',
  kind: 'emotion',
  variants: [

    { id: 'determined-stare', label: 'Hard stare', duration: 2800,
      render: (t) => {
        // Steady stare with brows angled in; subtle breathing.
        const bre = Math.sin(t * TAU) * 1.5;
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.7, y: CY + bre, rx: 12 }}
                  R={{ h: EYE_H * 0.7, y: CY + bre, rx: 12 }} />
            {/* pupils */}
            <circle cx={LX} cy={CY + bre} r={8} fill="var(--bg)" />
            <circle cx={RX} cy={CY + bre} r={8} fill="var(--bg)" />
            {/* angled brows (focus V) */}
            <g stroke="var(--eye)" strokeWidth={7} strokeLinecap="round">
              <line x1={LX - 34} y1={CY - 38} x2={LX + 30} y2={CY - 26} />
              <line x1={RX + 34} y1={CY - 38} x2={RX - 30} y2={CY - 26} />
            </g>
            {/* firm mouth line */}
            <line x1={W/2 - 24} y1={H - 24} x2={W/2 + 24} y2={H - 24}
                  stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
          </g>
        );
      } },

    { id: 'determined-fire', label: 'Fire eyes', duration: 1200,
      render: (t) => {
        // Flame shapes inside the eyes that flicker.
        const flick = (offset) => {
          const p = ((t * 2) + offset) % 1;
          return 1 + Math.sin(p * TAU * 3) * 0.08;
        };
        const flame = (cx) => {
          const s = flick(cx * 0.01);
          // simple flame path
          const w = 28 * s, h = 56 * s;
          return (
            <path
              d={`M ${cx} ${CY + h/2}
                  C ${cx - w} ${CY + h/4}, ${cx - w*0.7} ${CY - h/4}, ${cx - w*0.3} ${CY - h/3}
                  C ${cx - w*0.4} ${CY}, ${cx - w*0.1} ${CY - h*0.6}, ${cx} ${CY - h/2}
                  C ${cx + w*0.1} ${CY - h*0.6}, ${cx + w*0.4} ${CY}, ${cx + w*0.3} ${CY - h/3}
                  C ${cx + w*0.7} ${CY - h/4}, ${cx + w} ${CY + h/4}, ${cx} ${CY + h/2} Z`}
              fill="var(--accent)" />
          );
        };
        return (
          <g>
            {flame(LX)}
            {flame(RX)}
            {/* angled brows */}
            <g stroke="var(--eye)" strokeWidth={7} strokeLinecap="round">
              <line x1={LX - 32} y1={CY - 50} x2={LX + 26} y2={CY - 36} />
              <line x1={RX + 32} y1={CY - 50} x2={RX - 26} y2={CY - 36} />
            </g>
          </g>
        );
      } },

    { id: 'determined-lock', label: 'Lock on', duration: 1800,
      render: (t) => {
        // Crosshairs converge on each pupil then lock.
        const phase = t < 0.5 ? 1 - t / 0.5 : 0;
        const r = lerp(8, 36, phase);
        return (
          <g>
            <Eyes L={{ h: EYE_H * 0.8, rx: 14 }}
                  R={{ h: EYE_H * 0.8, rx: 14 }} />
            <circle cx={LX} cy={CY} r={6} fill="var(--bg)" />
            <circle cx={RX} cy={CY} r={6} fill="var(--bg)" />
            {/* converging brackets */}
            {[LX, RX].map((cx) => (
              <g key={cx} stroke="var(--accent)" strokeWidth={3} fill="none" strokeLinecap="round">
                <path d={`M ${cx - r} ${CY - r + 8} L ${cx - r} ${CY - r} L ${cx - r + 8} ${CY - r}`} />
                <path d={`M ${cx + r - 8} ${CY - r} L ${cx + r} ${CY - r} L ${cx + r} ${CY - r + 8}`} />
                <path d={`M ${cx - r} ${CY + r - 8} L ${cx - r} ${CY + r} L ${cx - r + 8} ${CY + r}`} />
                <path d={`M ${cx + r - 8} ${CY + r} L ${cx + r} ${CY + r} L ${cx + r} ${CY + r - 8}`} />
              </g>
            ))}
            {/* lock signal flicker on bottom */}
            {phase === 0 && (
              <g>
                <rect x={W/2 - 22} y={H - 22} width={44} height={8} rx={2}
                      fill="var(--accent)"
                      opacity={Math.sin(t * TAU * 6) > 0 ? 1 : 0.3} />
              </g>
            )}
          </g>
        );
      } },
  ],
};

// =============================================================
// Insert new keys into EMOTION_CATEGORY_KEYS at thematic positions.
// New keys go BEFORE any scene key so the emotions stay grouped.
// =============================================================
(() => {
  const keys = window.EMOTION_CATEGORY_KEYS.slice();

  // Find boundary: index of first scene key (or end of list).
  const firstSceneIdx = (() => {
    for (let i = 0; i < keys.length; i++) {
      if (cats[keys[i]] && cats[keys[i]].kind === 'scene') return i;
    }
    return keys.length;
  })();

  // Insert positions: after which existing key each new key should appear.
  const insertAfter = [
    ['annoyed',     'angry'],
    ['disgusted',   'annoyed'],
    ['nervous',     'scared'],
    ['embarrassed', 'shy'],
    ['cool',        'proud'],
    ['suspicious',  'mischievous'],
    ['curious',     'confused'],
    ['determined',  'focused'],
  ];

  // Drop any key that's already present (shouldn't be — defensive).
  for (const [k] of insertAfter) {
    const idx = keys.indexOf(k);
    if (idx >= 0) keys.splice(idx, 1);
  }

  // Insert each new key in order.
  for (const [k, after] of insertAfter) {
    let pos = keys.indexOf(after);
    if (pos < 0 || pos >= firstSceneIdx) {
      // fall back: insert just before the scene block
      pos = firstSceneIdx - 1;
    }
    keys.splice(pos + 1, 0, k);
  }

  window.EMOTION_CATEGORY_KEYS = keys;
})();
