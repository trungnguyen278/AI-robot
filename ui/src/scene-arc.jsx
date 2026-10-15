// SPDX-License-Identifier: MIT
/* Shared "scene-arc" helpers (v3).

   A scene is a continuous mini-video. The robot's eyes stay visible the
   WHOLE TIME — they don't blink out, they shrink and move to a corner
   to "watch" the prop, then grow back when the prop leaves.

       ┌─────────────────────────────────────────────────────────┐
       │  OPEN              TRANS-IN       ACT          TRANS-OUT     CLOSE      │
       │  big eyes,         eyes shrink   prop owns    prop leaves    big eyes,  │
       │  centered          to corner     screen;      / eyes grow    centered   │
       │  opening emo       prop enters   eyes watch   back           closing emo│
       │                    from below    from corner                            │
       └─────────────────────────────────────────────────────────┘

   sceneArc(t, opts?) → {
     phase:    'open' | 'trans-in' | 'act' | 'trans-out' | 'close'
     p:        0..1 progress within phase
     eyeScale: 0.35..1   how big the eyes are right now
     eyeCx,
     eyeCy:    where the eye-face center is right now
     sceneOp:  0..1   opacity for the scene visuals
     emotion:  string  current emotion to show on the face
   }

   EmotionFace renders the robot's eyes for an emotion. They are always
   cyan (see EYE_CYAN below): the emotion changes their shape, not their
   color. The scene's `--eye` color still applies to the *prop* visuals.

   Loaded AFTER emotion-core.jsx. Exposes window.SceneArc.
*/

const {
  W, H, STATUS_H, CY, LX, RX, EYE_W, EYE_H,
  TAU, lerp, clamp, ease, blink, Eye, Eyes, arcPath,
} = window.EmotionCore;

/* ------------------------------------------------------------------ */
/*  Eye color: ALWAYS cyan. Switching emotion changes shape (slits,    */
/*  arcs, rounded rects), not color — that would flash distractingly   */
/*  in the middle of a scene transition. Cyan is the robot's identity. */
/* ------------------------------------------------------------------ */
const EYE_CYAN = '#5be9ff';
function emoColor(_e) { return EYE_CYAN; }

// Kept for backwards compat — the old map is no longer used to color
// anything, but other modules may still read it for future per-emotion
// accents (NOT for eye fill).
const EMOTION_COLOR = {
  steady: EYE_CYAN, curious: EYE_CYAN, thinking: EYE_CYAN,
  excited: EYE_CYAN, eager: EYE_CYAN, surprised: EYE_CYAN,
  happy: EYE_CYAN, satisfied: EYE_CYAN, sleepy: EYE_CYAN,
  sad: EYE_CYAN, love: EYE_CYAN,
};

/* ------------------------------------------------------------------ */
/*  sceneArc — phase splitter with shrink-to-corner transitions.       */
/* ------------------------------------------------------------------ */
function sceneArc(t, opts = {}) {
  const open     = opts.open     ?? 0.10;
  const transIn  = opts.transIn  ?? 0.12;
  const act      = opts.act      ?? 0.56;
  const transOut = opts.transOut ?? 0.12;
  // close = remainder

  const openEmo  = opts.openEmo  || 'steady';
  const actEmo   = opts.actEmo   || opts.openEmo || 'steady';
  const closeEmo = opts.closeEmo || 'steady';

  // Where the small "watcher" eyes go during the act.
  // Default: top-right of usable area, well away from status icons.
  const cornerX = opts.cornerX ?? (W - 42);
  const cornerY = opts.cornerY ?? (STATUS_H + 24);
  const cornerScale = opts.cornerScale ?? 0.32;
  const centerX = W / 2;
  const centerY = CY;

  let phase, p, eyeScale, sceneOp, emotion, eyeCx, eyeCy;

  if (t < open) {
    phase = 'open';
    p = t / open;
    eyeScale = 1;
    sceneOp = 0;
    eyeCx = centerX; eyeCy = centerY;
    emotion = openEmo;
  } else if (t < open + transIn) {
    phase = 'trans-in';
    p = (t - open) / transIn;
    const ep = ease.inOut(p);
    eyeScale = lerp(1, cornerScale, ep);
    eyeCx = lerp(centerX, cornerX, ep);
    eyeCy = lerp(centerY, cornerY, ep);
    // prop is already entering from below — start fading it in early
    sceneOp = clamp((p - 0.05) * 1.3, 0, 1);
    emotion = openEmo;
  } else if (t < open + transIn + act) {
    phase = 'act';
    p = (t - open - transIn) / act;
    eyeScale = cornerScale;
    eyeCx = cornerX; eyeCy = cornerY;
    sceneOp = 1;
    emotion = actEmo;
  } else if (t < open + transIn + act + transOut) {
    phase = 'trans-out';
    p = (t - open - transIn - act) / transOut;
    const ep = ease.inOut(p);
    eyeScale = lerp(cornerScale, 1, ep);
    eyeCx = lerp(cornerX, centerX, ep);
    eyeCy = lerp(cornerY, centerY, ep);
    sceneOp = clamp(1 - (p + 0.05) * 1.3, 0, 1);
    emotion = closeEmo;
  } else {
    phase = 'close';
    const closeLen = 1 - open - transIn - act - transOut;
    p = closeLen > 0 ? (t - open - transIn - act - transOut) / closeLen : 1;
    eyeScale = 1;
    eyeCx = centerX; eyeCy = centerY;
    sceneOp = 0;
    emotion = closeEmo;
  }

  return { phase, p, eyeScale, eyeCx, eyeCy, sceneOp, emotion };
}

/* ------------------------------------------------------------------ */
/*  EmotionFace — the robot's eyes for an emotion, always cyan.        */
/*  t is global time so subtle live wiggles still work in the corner.  */
/*  Render at native size (centered on W/2, CY); the caller transforms */
/*  it into position via the eyeScale/eyeCx/eyeCy fields from sceneArc.*/
/* ------------------------------------------------------------------ */
function EmotionFace({ emotion = 'steady', t = 0 }) {
  const color = emoColor(emotion);

  const rectEyes = (h, w = EYE_W, yOff = 0, rx = 22, extra = {}) => (
    <g>
      <rect x={LX - w / 2} y={CY + yOff - h / 2}
            width={w} height={h} rx={rx}
            fill={color} {...extra.L} />
      <rect x={RX - w / 2} y={CY + yOff - h / 2}
            width={w} height={h} rx={rx}
            fill={color} {...extra.R} />
    </g>
  );

  const arcSmile = (depth = 26, yOff = 10, sw = 14) => (
    <g fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round">
      <path d={arcPath(LX, CY + yOff, EYE_W - 10, depth, true)} />
      <path d={arcPath(RX, CY + yOff, EYE_W - 10, depth, true)} />
    </g>
  );

  switch (emotion) {
    case 'happy':     return arcSmile(26, 10, 14);
    case 'satisfied': return arcSmile(16, 8, 12);
    case 'sleepy': {
      const droop = Math.sin(t * TAU * 0.6) * 2;
      return rectEyes(EYE_H * 0.32, EYE_W, 22 + droop, 12);
    }
    case 'surprised':
      return rectEyes(EYE_H * 1.05, EYE_W * 1.08, 0, 36);
    case 'excited':
    case 'eager': {
      const wob = Math.sin(t * TAU * 3) * 2;
      return rectEyes(EYE_H * 1.05, EYE_W * 1.05, -2 + wob, 30);
    }
    case 'curious': {
      const tilt = Math.sin(t * TAU * 0.7) * 4;
      return (
        <g transform={`rotate(${tilt} ${W / 2} ${CY})`}>
          {rectEyes(EYE_H * 0.95, EYE_W, -2)}
        </g>
      );
    }
    case 'sad': {
      const y = CY + 6;
      const h = EYE_H * 0.7;
      return (
        <g>
          <rect x={LX - EYE_W / 2} y={y - h / 2}
                width={EYE_W} height={h} rx={18} fill={color} />
          <rect x={RX - EYE_W / 2} y={y - h / 2}
                width={EYE_W} height={h} rx={18} fill={color} />
          {/* slanted top-lids (background-colored) */}
          <polygon points={`
            ${LX - EYE_W / 2 - 4},${y - EYE_H / 2 - 4}
            ${LX + EYE_W / 2 + 4},${y - EYE_H / 2 - 4}
            ${LX + EYE_W / 2 + 4},${y - 4}
            ${LX - EYE_W / 2 - 4},${y + 20}`}
            fill="var(--bg)" />
          <polygon points={`
            ${RX - EYE_W / 2 - 4},${y - EYE_H / 2 - 4}
            ${RX + EYE_W / 2 + 4},${y - EYE_H / 2 - 4}
            ${RX + EYE_W / 2 + 4},${y + 20}
            ${RX - EYE_W / 2 - 4},${y - 4}`}
            fill="var(--bg)" />
        </g>
      );
    }
    case 'thinking': {
      const look = Math.sin(t * TAU * 0.8) * 6;
      return (
        <g>
          {rectEyes(EYE_H * 0.9, EYE_W, 0, 22)}
          <circle cx={LX + look} cy={CY - 8} r={12} fill="var(--bg)" />
          <circle cx={RX + look} cy={CY - 8} r={12} fill="var(--bg)" />
        </g>
      );
    }
    case 'love': {
      // heart eyes — built from rectangles is awkward, use circles
      const sz = EYE_W * 0.9;
      const heart = (cx) => {
        const k = sz / 30;
        return `M ${cx} ${CY + 9 * k}
                C ${cx - 18 * k} ${CY - 3 * k}, ${cx - 18 * k} ${CY - 18 * k}, ${cx - 9 * k} ${CY - 18 * k}
                C ${cx - 4 * k} ${CY - 18 * k}, ${cx} ${CY - 12 * k}, ${cx} ${CY - 6 * k}
                C ${cx} ${CY - 12 * k}, ${cx + 4 * k} ${CY - 18 * k}, ${cx + 9 * k} ${CY - 18 * k}
                C ${cx + 18 * k} ${CY - 18 * k}, ${cx + 18 * k} ${CY - 3 * k}, ${cx} ${CY + 9 * k} Z`;
      };
      return (
        <g fill={color}>
          <path d={heart(LX)} />
          <path d={heart(RX)} />
        </g>
      );
    }
    case 'steady':
    default: {
      const microBlink = Math.max(blink(t, 0.4, 0.05), blink(t, 0.9, 0.05));
      const h = EYE_H * (1 - microBlink * 0.92);
      return rectEyes(h, EYE_W, 0, 22);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  TransformedFace — convenience wrapper that places EmotionFace at      */
/*  (eyeCx, eyeCy) scaled by eyeScale. Use this from scenes.           */
/* ------------------------------------------------------------------ */
function TransformedFace({ arc, t }) {
  const { eyeCx, eyeCy, eyeScale, emotion } = arc;
  return (
    <g transform={`translate(${eyeCx} ${eyeCy})
                   scale(${eyeScale})
                   translate(${-W / 2} ${-CY})`}>
      <EmotionFace emotion={emotion} t={t} />
    </g>
  );
}

window.SceneArc = { sceneArc, EmotionFace, TransformedFace, EMOTION_COLOR };
