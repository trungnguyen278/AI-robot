// SPDX-License-Identifier: MIT
/* Emotion library — BALANCE pass
   Adds extra variants to under-represented categories so every category
   has at least 4 variants. Loaded AFTER emotion-extras.jsx (and after
   scenes / scenes-extras tag categories with kind:'emotion'|'scene').

   Targets (final variant counts after this file):
     greet 4 · shy 4 · smug 4 · proud 4 · mischievous 4 · hungry 4 ·
     charging 4 · error 4 · mute 4 · wink 4 · crying 4 · scared 4 ·
     sleepy 4 · sleeping 4 · confused 4 · focused 4 · dizzy 4 · dead 4
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

// Upper lid that hangs down from the top of each eye (smug / sleepy mask).
function topLid(eyeCx, eyeY, drop) {
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

// =============================================================
// GREET — add 2 (2 → 4)
// =============================================================
cats.greet.variants.push(

  { id: 'greet-nod-twice', label: 'Double nod', duration: 2400,
    render: (t) => {
      // Two clear downward nods, with a small recovery.
      const phase = ((t * 2) % 1);
      const dy = phase < 0.4
        ? lerp(0, 16, ease.inOut(phase / 0.4))
        : lerp(16, 0, ease.inOut((phase - 0.4) / 0.6));
      const h = lerp(EYE_H, EYE_H * 0.78, dy / 16);
      return baseEyes({ y: CY + dy, h }, { y: CY + dy, h });
    } },

  { id: 'greet-sparkle-hi', label: 'Sparkle hi', duration: 1800,
    render: (t) => {
      // Eyes pop slightly bigger; sparkles drift away from outer corners.
      const pop = pulse(t, 0.25, 0.22);
      const s = 1 + pop * 0.12;
      return (
        <g>
          <Eyes L={{ w: EYE_W * s, h: EYE_H * s }}
                R={{ w: EYE_W * s, h: EYE_H * s }} />
          {[0, 1, 2, 3].map((i) => {
            const p = ((t * 1.4) + i * 0.25) % 1;
            const side = i % 2 === 0 ? -1 : 1;
            const x = (side === -1 ? LX - 38 : RX + 38) + side * p * 14;
            const y = CY - 24 - p * 30;
            const sz = lerp(8, 2, p);
            return (
              <path key={i} d={starPath(x, y, sz, sz * 0.4)}
                    fill="var(--accent)" opacity={(1 - p) * 0.9} />
            );
          })}
        </g>
      );
    } },
);

// =============================================================
// WINK — add 1 (3 → 4)
// =============================================================
cats.wink.variants.push(

  { id: 'wink-slow', label: 'Slow wink', duration: 3000,
    render: (t) => {
      // Long, languid right-eye wink — closes slowly, holds, reopens.
      let close;
      if (t < 0.3) close = ease.out(t / 0.3);
      else if (t < 0.6) close = 1;
      else if (t < 0.9) close = 1 - ease.in((t - 0.6) / 0.3);
      else close = 0;
      const rH = lerp(EYE_H, 4, close);
      return (
        <g>
          <Eye x={LX} y={CY} />
          {close > 0.9 ? (
            <path d={arcPath(RX, CY + 6, EYE_W - 6, 20, true)}
                  fill="none" stroke="var(--eye)" strokeWidth={12}
                  strokeLinecap="round" />
          ) : (
            <Eye x={RX} y={CY} h={rH} />
          )}
          {/* faint smile that grows with the wink */}
          {close > 0.4 && (
            <path d={arcPath(W/2, H - 32, 40, 8, true)} fill="none"
                  stroke="var(--eye)" strokeWidth={4} strokeLinecap="round"
                  opacity={close * 0.7} />
          )}
        </g>
      );
    } },
);

// =============================================================
// CRYING — add 1 (3 → 4)
// =============================================================
cats.crying.variants.push(

  { id: 'crying-trickle', label: 'Single tear', duration: 2800,
    render: (t) => {
      // One big tear forms on the right eye and falls slowly.
      const phase = t;
      const formed = clamp((phase - 0.05) * 4, 0, 1);
      const fall = phase > 0.35 ? clamp((phase - 0.35) / 0.6, 0, 1) : 0;
      const y = CY - 18;
      return (
        <g>
          <Eyes L={{ y: CY + 4, h: EYE_H * 0.78 }}
                R={{ y: CY + 4, h: EYE_H * 0.78 }} />
          {sadLid(LX, CY + 4, 22)}
          {sadLidMirrored(RX, CY + 4, 22)}
          {/* tear sitting at the right eye's lower edge */}
          {formed > 0.05 && fall < 0.05 && (
            <ellipse cx={RX + 26} cy={CY + 30}
                     rx={4 + formed * 2} ry={6 + formed * 4}
                     fill="var(--accent)" opacity={formed} />
          )}
          {/* tear falling */}
          {fall > 0.05 && (
            <ellipse cx={RX + 26} cy={CY + 30 + fall * 60}
                     rx={5} ry={10 - fall * 3}
                     fill="var(--accent)" opacity={1 - fall * 0.3} />
          )}
          {/* puddle hint */}
          {fall > 0.8 && (
            <ellipse cx={RX + 26} cy={H - 8} rx={8 * (fall - 0.8) * 5} ry={2.5}
                     fill="var(--accent)" opacity={(fall - 0.8) * 4} />
          )}
        </g>
      );
    } },
);

// =============================================================
// SCARED — add 1 (3 → 4)
// =============================================================
cats.scared.variants.push(

  { id: 'scared-darting', label: 'Darting', duration: 2200,
    render: (t) => {
      // Tiny pupils dart between 4 corners of a wide eye.
      const seq = [{x:-12,y:-6},{x:12,y:-6},{x:-12,y:6},{x:12,y:6}];
      const n = seq.length;
      const idx = clamp(Math.floor(t * n), 0, n - 1);
      const cur = seq[idx];
      return (
        <g>
          <Eyes L={{ w: EYE_W * 1.15, h: EYE_H * 1.15 }}
                R={{ w: EYE_W * 1.15, h: EYE_H * 1.15 }} />
          <circle cx={LX + cur.x} cy={CY + cur.y} r={7} fill="var(--bg)" />
          <circle cx={RX + cur.x} cy={CY + cur.y} r={7} fill="var(--bg)" />
        </g>
      );
    } },
);

// =============================================================
// SHY — add 2 (2 → 4)
// =============================================================
cats.shy.variants.push(

  { id: 'shy-peek', label: 'Peek out', duration: 3000,
    render: (t) => {
      // Eyes covered by upper lid, then peek through halfway.
      const peek = (Math.sin(t * TAU) + 1) / 2; // 0 covered, 1 open
      const drop = lerp(EYE_H + 6, EYE_H * 0.35, peek);
      return (
        <g>
          <Eyes L={{ y: CY }} R={{ y: CY }} />
          {topLid(LX, CY, drop)}
          {topLid(RX, CY, drop)}
          {/* tiny blush dots at outer edges */}
          <circle cx={LX - 34} cy={CY + 20} r={5} fill="var(--accent)" opacity={0.55} />
          <circle cx={RX + 34} cy={CY + 20} r={5} fill="var(--accent)" opacity={0.55} />
        </g>
      );
    } },

  { id: 'shy-blush', label: 'Blush', duration: 2400,
    render: (t) => {
      // Subtle eye shape with pulsing cheek dots and a small downward smile.
      const blush = 0.55 + Math.sin(t * TAU * 2) * 0.25;
      const wob = Math.sin(t * TAU) * 1.5;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.55, y: CY + 6 + wob, rx: 16 }}
                R={{ h: EYE_H * 0.55, y: CY + 6 - wob, rx: 16 }} />
          <ellipse cx={LX} cy={CY + 40} rx={18} ry={6}
                   fill="var(--accent)" opacity={blush} />
          <ellipse cx={RX} cy={CY + 40} rx={18} ry={6}
                   fill="var(--accent)" opacity={blush} />
          <path d={arcPath(W/2, H - 28, 26, 4, true)} fill="none"
                stroke="var(--eye)" strokeWidth={4} strokeLinecap="round"
                opacity={0.65} />
        </g>
      );
    } },
);

// =============================================================
// SMUG — add 2 (2 → 4)
// =============================================================
cats.smug.variants.push(

  { id: 'smug-brow', label: 'Brow raise', duration: 2600,
    render: (t) => {
      // Right brow lifts (a single bar above right eye); half-closed eyes.
      const raise = (Math.sin(t * TAU - Math.PI / 2) + 1) / 2;
      const dy = -raise * 8;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.5, y: CY + 6, rx: 12 }}
                R={{ h: EYE_H * 0.5, y: CY + 6, rx: 12 }} />
          {/* lower lid mask to keep half-closed shape */}
          <g fill="var(--bg)">
            <polygon points={`${LX - 50},${CY - 50} ${LX + 50},${CY - 50} ${LX + 50},${CY - 12} ${LX - 50},${CY - 4}`} />
            <polygon points={`${RX - 50},${CY - 50} ${RX + 50},${CY - 50} ${RX + 50},${CY - 4} ${RX - 50},${CY - 12}`} />
          </g>
          {/* right brow */}
          <line x1={RX - 28} y1={CY - 38 + dy} x2={RX + 28} y2={CY - 30 + dy}
                stroke="var(--eye)" strokeWidth={6} strokeLinecap="round" />
          {/* hint of a smirk */}
          <path d={`M ${W/2 - 22} ${H - 28} Q ${W/2 + 4} ${H - 34}, ${W/2 + 24} ${H - 24}`}
                fill="none" stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
        </g>
      );
    } },

  { id: 'smug-blink', label: 'Slow knowing blink', duration: 3200,
    render: (t) => {
      const b = pulse(t, 0.5, 0.18);
      const h = lerp(EYE_H * 0.45, 4, b);
      return (
        <g>
          <Eyes L={{ h, y: CY + 10, rx: 10 }} R={{ h, y: CY + 10, rx: 10 }} />
          <g fill="var(--bg)">
            <polygon points={`${LX - 50},${CY - 50} ${LX + 50},${CY - 50} ${LX + 50},${CY} ${LX - 50},${CY + 6}`} />
            <polygon points={`${RX - 50},${CY - 50} ${RX + 50},${CY - 50} ${RX + 50},${CY + 6} ${RX - 50},${CY}`} />
          </g>
          {/* settled smirk that lifts on closed */}
          <path d={`M ${W/2 - 28} ${H - 28 + b * 2}
                    Q ${W/2 + 4} ${H - 34 - b * 4}, ${W/2 + 28} ${H - 24 + b * 2}`}
                fill="none" stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
        </g>
      );
    } },
);

// =============================================================
// PROUD — add 2 (2 → 4)
// =============================================================
cats.proud.variants.push(

  { id: 'proud-medal', label: 'Medal', duration: 2200,
    render: (t) => {
      // Star "medal" appears at lower-center, with a ribbon hint.
      const s = pulse(t, 0.3, 0.25);
      const sz = 12 + s * 6;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.6, y: CY - 2, rx: 12 }}
                R={{ h: EYE_H * 0.6, y: CY - 2, rx: 12 }} />
          {/* upper-lid mask for a confident squint */}
          <g fill="var(--bg)">
            <polygon points={`${LX - 50},${CY - 50} ${LX + 50},${CY - 50} ${LX + 50},${CY - 12} ${LX - 50},${CY - 12}`} />
            <polygon points={`${RX - 50},${CY - 50} ${RX + 50},${CY - 50} ${RX + 50},${CY - 12} ${RX - 50},${CY - 12}`} />
          </g>
          {/* ribbon */}
          <g stroke="var(--accent)" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.85}>
            <line x1={W/2 - 14} y1={H - 56} x2={W/2 - 6} y2={H - 32} />
            <line x1={W/2 + 14} y1={H - 56} x2={W/2 + 6} y2={H - 32} />
          </g>
          {/* star medal */}
          <path d={starPath(W/2, H - 26, sz, sz * 0.42)} fill="var(--accent)" />
        </g>
      );
    } },

  { id: 'proud-rise', label: 'Chin up', duration: 3000,
    render: (t) => {
      // Eyes drift up slowly, then settle — chin-up posture.
      const phase = Math.sin(t * TAU - Math.PI / 2);
      const dy = phase < 0 ? phase * 10 : 0;
      return (
        <g>
          <Eyes L={{ y: CY + dy, h: EYE_H * 0.75 }}
                R={{ y: CY + dy, h: EYE_H * 0.75 }} />
          {/* lower-lid mask creates the upward-look posture */}
          <g fill="var(--bg)">
            <polygon points={`${LX - 50},${CY + dy + 12} ${LX + 50},${CY + dy + 12} ${LX + 50},${CY + 60} ${LX - 50},${CY + 60}`} />
            <polygon points={`${RX - 50},${CY + dy + 12} ${RX + 50},${CY + dy + 12} ${RX + 50},${CY + 60} ${RX - 50},${CY + 60}`} />
          </g>
          {/* small confident smile */}
          <path d={arcPath(W/2, H - 24, 36, 6, true)} fill="none"
                stroke="var(--eye)" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
        </g>
      );
    } },
);

// =============================================================
// MISCHIEVOUS — add 2 (2 → 4)
// =============================================================
cats.mischievous.variants.push(

  { id: 'mischievous-side', label: 'Side scheme', duration: 2600,
    render: (t) => {
      // Eyes slide to one side with slanted lower lids and a sly grin.
      const side = Math.sin(t * TAU * 0.6) * 14;
      const wob = Math.sin(t * TAU * 2) * 1;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.5, rx: 14, y: CY + 4 }}
                R={{ h: EYE_H * 0.5, rx: 14, y: CY + 4 }} />
          {/* slanted lower lids */}
          <g fill="var(--bg)">
            <polygon points={`${LX - 50},${CY + 18 + wob} ${LX + 50},${CY + 12 - wob} ${LX + 50},${CY + 60} ${LX - 50},${CY + 60}`} />
            <polygon points={`${RX - 50},${CY + 12 + wob} ${RX + 50},${CY + 18 - wob} ${RX + 50},${CY + 60} ${RX - 50},${CY + 60}`} />
          </g>
          {/* pupils glide */}
          <circle cx={LX + side} cy={CY - 2} r={9} fill="var(--bg)" />
          <circle cx={RX + side} cy={CY - 2} r={9} fill="var(--bg)" />
          {/* tilted smile that follows pupils */}
          <path d={`M ${W/2 - 26 + side/2} ${H - 26}
                    Q ${W/2 + side/2} ${H - 36}, ${W/2 + 26 + side/2} ${H - 26}`}
                fill="none" stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
        </g>
      );
    } },

  { id: 'mischievous-twinkle', label: 'Sly twinkle', duration: 1800,
    render: (t) => {
      // Squinted slanted eyes; a tiny star twinkles in the corner of one eye.
      const tw = pulse(t, 0.45, 0.15);
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.4, y: CY + 6, rx: 12 }}
                R={{ h: EYE_H * 0.4, y: CY + 6, rx: 12 }} />
          {/* slanted lower lids — outer corners higher */}
          <g fill="var(--bg)">
            <polygon points={`${LX - 50},${CY + 16} ${LX + 50},${CY + 10} ${LX + 50},${CY + 60} ${LX - 50},${CY + 60}`} />
            <polygon points={`${RX - 50},${CY + 10} ${RX + 50},${CY + 16} ${RX + 50},${CY + 60} ${RX - 50},${CY + 60}`} />
          </g>
          {/* twinkle on right eye outer corner */}
          {tw > 0.05 && (
            <g opacity={tw}>
              <path d={starPath(RX + 26, CY - 4, 6 + tw * 4, 2.5)} fill="var(--accent)" />
              <line x1={RX + 22} y1={CY - 4} x2={RX + 12} y2={CY - 4}
                    stroke="var(--accent)" strokeWidth={2} opacity={tw * 0.7} />
            </g>
          )}
          {/* wide cunning smile */}
          <path d={arcPath(W/2, H - 30, 90, 10, true)} fill="none"
                stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
        </g>
      );
    } },
);

// =============================================================
// HUNGRY — add 2 (2 → 4)
// =============================================================
cats.hungry.variants.push(

  { id: 'hungry-lick', label: 'Lick lips', duration: 1800,
    render: (t) => {
      // Eyes wide, tongue arc swipes across the lower mouth area.
      const phase = (t * 2) % 1;
      const lick = phase < 0.5 ? phase * 2 : 1 - (phase - 0.5) * 2;
      const tongueX = lerp(W/2 - 18, W/2 + 18, lick);
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.9 }} R={{ h: EYE_H * 0.9 }} />
          {/* mouth line */}
          <path d={arcPath(W/2, H - 28, 40, 5, true)} fill="none"
                stroke="var(--eye)" strokeWidth={4} strokeLinecap="round" />
          {/* tongue */}
          <ellipse cx={tongueX} cy={H - 22} rx={6} ry={4} fill="var(--accent)" />
        </g>
      );
    } },

  { id: 'hungry-stomach', label: 'Stomach growl', duration: 1400,
    render: (t) => {
      // Wavy growl line at the bottom; eyes look down with anticipation.
      const wob = Math.sin(t * TAU * 3) * 2;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.8, y: CY + 6 + wob }}
                R={{ h: EYE_H * 0.8, y: CY + 6 - wob }} />
          <circle cx={LX} cy={CY + 12} r={9} fill="var(--bg)" />
          <circle cx={RX} cy={CY + 12} r={9} fill="var(--bg)" />
          {/* growl waveform across bottom */}
          <path d={`M 30 ${H - 18}
                    Q ${W * 0.2} ${H - 18 - 6}, ${W * 0.32} ${H - 18}
                    T ${W * 0.5} ${H - 18}
                    T ${W * 0.68} ${H - 18}
                    T ${W * 0.85} ${H - 18}
                    T ${W - 30} ${H - 18}`}
                transform={`translate(${wob * 2} 0)`}
                fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    } },
);

// =============================================================
// CHARGING — add 2 (2 → 4)
// =============================================================
cats.charging.variants.push(

  { id: 'charging-spark', label: 'Sparks', duration: 1200,
    render: (t) => {
      // Lightning-like sparks arc from above into each eye.
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.7 }} R={{ h: EYE_H * 0.7 }} />
          {[LX, RX].map((cx, side) => {
            const phase = ((t * 2) + side * 0.5) % 1;
            const op = phase < 0.5 ? 1 : 0;
            return (
              <g key={cx} opacity={op}>
                <polyline
                  points={`${cx - 4},${STATUS_H + 6}
                          ${cx + 6},${STATUS_H + 22}
                          ${cx - 2},${STATUS_H + 30}
                          ${cx + 8},${CY - 50}`}
                  fill="none" stroke="var(--accent)" strokeWidth={3}
                  strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={cx + 8} cy={CY - 50} r={4} fill="var(--accent)" />
              </g>
            );
          })}
        </g>
      );
    } },

  { id: 'charging-glow', label: 'Glow up', duration: 2400,
    render: (t) => {
      // Eyes brighten from dim to full, with an outer halo.
      const phase = (Math.sin(t * TAU - Math.PI / 2) + 1) / 2;
      const op = 0.35 + phase * 0.65;
      const haloR = 36 + phase * 14;
      return (
        <g>
          <circle cx={LX} cy={CY} r={haloR} fill="var(--accent)" opacity={phase * 0.18} />
          <circle cx={RX} cy={CY} r={haloR} fill="var(--accent)" opacity={phase * 0.18} />
          <g opacity={op}>
            <Eyes L={{ h: EYE_H * 0.95 }} R={{ h: EYE_H * 0.95 }} />
          </g>
          {/* small + ticks at the top to suggest power */}
          <g stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" opacity={op}>
            <line x1={W/2 - 4} y1={STATUS_H + 12} x2={W/2 + 4} y2={STATUS_H + 12} />
            <line x1={W/2} y1={STATUS_H + 8} x2={W/2} y2={STATUS_H + 16} />
          </g>
        </g>
      );
    } },
);

// =============================================================
// ERROR — add 2 (2 → 4)
// =============================================================
cats.error.variants.push(

  { id: 'error-pixels', label: 'Pixel scramble', duration: 1400,
    render: (t) => {
      // Eyes replaced by a scrambled grid of small rects that re-tile each tick.
      const cols = 6, rows = 6;
      // deterministic 'noise' per cell using t
      const noise = (i, j) => {
        const k = Math.sin((i * 12.9898 + j * 78.233 + Math.floor(t * 8)) * 43758.5453);
        return k - Math.floor(k);
      };
      const block = (cx) => {
        const cells = [];
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const n = noise(cx + i, j);
            if (n < 0.55) continue;
            const x = cx - (EYE_W / 2) + (i / cols) * EYE_W;
            const y = CY - (EYE_H / 2) + (j / rows) * EYE_H;
            cells.push(
              <rect key={`${cx}-${i}-${j}`} x={x} y={y}
                    width={EYE_W / cols - 1.5} height={EYE_H / rows - 1.5}
                    fill="var(--accent)" opacity={0.4 + n * 0.6} />
            );
          }
        }
        return cells;
      };
      return (
        <g>
          {block(LX)}
          {block(RX)}
          {/* glitch scanline */}
          <line x1={0} y1={CY + Math.sin(t * TAU * 4) * 16} x2={W}
                y2={CY + Math.sin(t * TAU * 4) * 16}
                stroke="var(--accent)" strokeWidth={1.5} opacity={0.35} />
        </g>
      );
    } },

  { id: 'error-warning', label: 'Warning sign', duration: 1800,
    render: (t) => {
      // A triangle warning sign with a "!" — pulses.
      const p = 0.55 + Math.abs(Math.sin(t * TAU * 1.5)) * 0.45;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.45, rx: 10 }} R={{ h: EYE_H * 0.45, rx: 10 }} />
          <g transform={`translate(${W/2} ${CY + 4})`} opacity={p}>
            <path d="M 0 -34 L 32 24 L -32 24 Z" fill="none"
                  stroke="var(--accent)" strokeWidth={4} strokeLinejoin="round" />
            <rect x={-3} y={-18} width={6} height={20} rx={2} fill="var(--accent)" />
            <circle cx={0} cy={12} r={3.5} fill="var(--accent)" />
          </g>
        </g>
      );
    } },
);

// =============================================================
// MUTE — add 2 (2 → 4)
// =============================================================
cats.mute.variants.push(

  { id: 'mute-hush', label: 'Hush', duration: 2400,
    render: (t) => {
      // Vertical "shh" bar over the mouth area, gentle pulse.
      const p = 0.6 + Math.abs(Math.sin(t * TAU)) * 0.4;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.85 }} R={{ h: EYE_H * 0.85 }} />
          {/* small mouth */}
          <ellipse cx={W/2} cy={H - 28} rx={5} ry={3}
                   fill="none" stroke="var(--eye)" strokeWidth={3} />
          {/* hush bar (a stylized finger over the lips) */}
          <g opacity={p}>
            <rect x={W/2 - 4} y={H - 56} width={8} height={36} rx={4}
                  fill="var(--accent)" />
            <circle cx={W/2} cy={H - 56} r={6} fill="var(--accent)" />
          </g>
          {/* small "shh" marks */}
          {[-1, 0, 1].map((i) => (
            <line key={i}
                  x1={W/2 + 18 + i * 8} y1={H - 50 + i * 4}
                  x2={W/2 + 26 + i * 8} y2={H - 46 + i * 4}
                  stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round"
                  opacity={p * 0.8} />
          ))}
        </g>
      );
    } },

  { id: 'mute-line', label: 'Lips sealed', duration: 2600,
    render: (t) => {
      // A straight line for a mouth + slowly drifting "sound waves" with X.
      const drift = Math.sin(t * TAU) * 2;
      const fade = 0.5 + Math.abs(Math.sin(t * TAU * 0.5)) * 0.5;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.6, y: CY + 4 }}
                R={{ h: EYE_H * 0.6, y: CY + 4 }} />
          {/* sealed mouth line */}
          <line x1={W/2 - 26} y1={H - 28 + drift} x2={W/2 + 26} y2={H - 28 - drift}
                stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
          {/* faint sound waves crossed out */}
          <g opacity={fade} stroke="var(--accent)" strokeWidth={2} fill="none">
            <path d={`M ${W/2 + 38} ${H - 36} Q ${W/2 + 46} ${H - 28}, ${W/2 + 38} ${H - 20}`}
                  strokeLinecap="round" />
            <path d={`M ${W/2 + 46} ${H - 40} Q ${W/2 + 56} ${H - 28}, ${W/2 + 46} ${H - 16}`}
                  strokeLinecap="round" opacity={0.6} />
            <line x1={W/2 + 32} y1={H - 40} x2={W/2 + 60} y2={H - 16}
                  strokeWidth={3} strokeLinecap="round" />
          </g>
        </g>
      );
    } },
);

// =============================================================
// SLEEPY — add 1 (3 → 4)
// =============================================================
cats.sleepy.variants.push(

  { id: 'sleepy-blink-slow', label: 'Long blink', duration: 4400,
    render: (t) => {
      // Very slow, lingering blinks.
      let b;
      if (t < 0.5) b = ease.out(t / 0.5);
      else b = 1 - ease.in((t - 0.5) / 0.5);
      const h = lerp(EYE_H * 0.55, 4, b);
      return baseEyes(
        { y: CY + 18, h, rx: 12 },
        { y: CY + 18, h, rx: 12 },
      );
    } },
);

// =============================================================
// SLEEPING — add 1 (3 → 4)
// =============================================================
cats.sleeping.variants.push(

  { id: 'sleeping-bubble', label: 'Snore bubble', duration: 3000,
    render: (t) => {
      // Closed arc eyes + a single growing/popping snore bubble at nose level.
      const phase = (t * 1) % 1;
      const grow = phase < 0.7 ? phase / 0.7 : 1;
      const pop  = phase > 0.85 ? (phase - 0.85) / 0.15 : 0;
      const r = lerp(4, 16, grow) * (1 - pop);
      return (
        <g>
          <g fill="none" stroke="var(--eye)" strokeWidth={10} strokeLinecap="round">
            <path d={arcPath(LX, CY + 14, EYE_W, 16)} />
            <path d={arcPath(RX, CY + 14, EYE_W, 16)} />
          </g>
          {r > 0.5 && (
            <circle cx={W/2 + 6} cy={H - 32 - grow * 4} r={r}
                    fill="none" stroke="var(--accent)" strokeWidth={2.5}
                    opacity={1 - pop} />
          )}
          {pop > 0.05 && (
            <g opacity={1 - pop}>
              {[0, 1, 2, 3].map((i) => {
                const a = (i / 4) * TAU + pop * 1;
                const rr = 12 + pop * 14;
                return (
                  <circle key={i}
                          cx={W/2 + 6 + Math.cos(a) * rr}
                          cy={H - 32 + Math.sin(a) * rr}
                          r={2} fill="var(--accent)" />
                );
              })}
            </g>
          )}
        </g>
      );
    } },
);

// =============================================================
// CONFUSED — add 1 (3 → 4)
// =============================================================
cats.confused.variants.push(

  { id: 'confused-spin-q', label: 'Spinning ?', duration: 2200,
    render: (t) => {
      // Eyes wobble; a question mark slowly spins above.
      const tilt = Math.sin(t * TAU) * 6;
      return (
        <g>
          <Eyes L={{ h: EYE_H * 0.8, rot: tilt }}
                R={{ h: EYE_H * 0.8, rot: -tilt }} />
          <g transform={`translate(${W/2} ${STATUS_H + 28}) rotate(${t * 360})`}>
            <path d="M -10 -10 Q -10 -22 0 -22 Q 12 -22 12 -10 Q 12 -2 0 4 L 0 8"
                  fill="none" stroke="var(--accent)" strokeWidth={5}
                  strokeLinecap="round" />
            <circle cx={0} cy={18} r={4} fill="var(--accent)" />
          </g>
        </g>
      );
    } },
);

// =============================================================
// FOCUSED — add 1 (3 → 4)
// =============================================================
cats.focused.variants.push(

  { id: 'focused-pinpoint', label: 'Pinpoint', duration: 1600,
    render: (t) => {
      // Very small pupil + rotating crosshair around each eye.
      const ang = t * 360;
      return (
        <g>
          <Eyes L={{ w: EYE_W * 0.95, h: EYE_H * 0.85 }}
                R={{ w: EYE_W * 0.95, h: EYE_H * 0.85 }} />
          <circle cx={LX} cy={CY} r={4} fill="var(--bg)" />
          <circle cx={RX} cy={CY} r={4} fill="var(--bg)" />
          {[LX, RX].map((cx) => (
            <g key={cx} transform={`translate(${cx} ${CY}) rotate(${ang})`}
               stroke="var(--bg)" strokeWidth={2} fill="none">
              <line x1={-22} y1={0} x2={-12} y2={0} />
              <line x1={12} y1={0} x2={22} y2={0} />
              <line x1={0} y1={-22} x2={0} y2={-12} />
              <line x1={0} y1={12} x2={0} y2={22} />
            </g>
          ))}
        </g>
      );
    } },
);

// =============================================================
// DIZZY — add 1 (3 → 4)
// =============================================================
cats.dizzy.variants.push(

  { id: 'dizzy-figure8', label: 'Figure 8', duration: 2000,
    render: (t) => {
      // Pupils trace a lemniscate over closed-arc eyes.
      const a = t * TAU;
      const fx = Math.sin(a) * 18;
      const fy = Math.sin(a * 2) * 10;
      return (
        <g>
          <g fill="none" stroke="var(--eye)" strokeWidth={10} strokeLinecap="round">
            <path d={arcPath(LX, CY + 10, EYE_W, 18)} />
            <path d={arcPath(RX, CY + 10, EYE_W, 18)} />
          </g>
          {/* faint figure-8 path */}
          <g stroke="var(--accent)" strokeWidth={1.5} fill="none" opacity={0.25}>
            <path d={`M ${LX - 18} ${CY} C ${LX - 18} ${CY - 14}, ${LX + 18} ${CY + 14}, ${LX + 18} ${CY}
                      C ${LX + 18} ${CY - 14}, ${LX - 18} ${CY + 14}, ${LX - 18} ${CY} Z`} />
            <path d={`M ${RX - 18} ${CY} C ${RX - 18} ${CY - 14}, ${RX + 18} ${CY + 14}, ${RX + 18} ${CY}
                      C ${RX + 18} ${CY - 14}, ${RX - 18} ${CY + 14}, ${RX - 18} ${CY} Z`} />
          </g>
          <circle cx={LX + fx} cy={CY + fy} r={6} fill="var(--accent)" />
          <circle cx={RX + fx} cy={CY + fy} r={6} fill="var(--accent)" />
        </g>
      );
    } },
);

// =============================================================
// DEAD — add 1 (3 → 4)
// =============================================================
cats.dead.variants.push(

  { id: 'dead-droop', label: 'Drooping X', duration: 3200,
    render: (t) => {
      // X-eyes droop and tilt as if hanging; very slow breathe.
      const sag = 6 + Math.sin(t * TAU) * 2;
      const sz = 22;
      const drawX = (cx, cy, tilt) => (
        <g key={cx} transform={`rotate(${tilt} ${cx} ${cy})`}
           stroke="var(--eye)" strokeWidth={8} strokeLinecap="round" opacity={0.7}>
          <line x1={cx - sz} y1={cy - sz} x2={cx + sz} y2={cy + sz} />
          <line x1={cx + sz} y1={cy - sz} x2={cx - sz} y2={cy + sz} />
        </g>
      );
      return (
        <g>
          {drawX(LX, CY + sag, -8)}
          {drawX(RX, CY + sag, 8)}
          {/* slack mouth */}
          <ellipse cx={W/2} cy={H - 24} rx={10} ry={4}
                   fill="none" stroke="var(--eye)" strokeWidth={3} opacity={0.55} />
        </g>
      );
    } },
);
