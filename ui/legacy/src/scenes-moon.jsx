// SPDX-License-Identifier: MIT
/* MOON, multi-case pack (v4).

   The robot *IS* the moon (the phone app's moon shares the same phase
   math). Every phase is a long, meaningful little STORY told purely
   through motion — and, per the robot's identity rule, EACH story OPENS
   and CLOSES on the signature cyan eyes (the canonical pair, centered).
   The moon then *materializes around those same eyes* (they slide
   together & shrink onto the disc), the story plays, then the disc
   dissolves and the eyes return to their signature pose. So the viewer
   always sees the eyes first and last — the moon is what the robot
   becomes in between.

     ┌ signature eyes → moon forms → STORY → moon dissolves → signature eyes ┐

   The eight stories (≥ 22 s each), by lunar phase (Vietnamese name):
     new moon (Sóc)            fast asleep in the dark — a shooting star, a stir
     waxing crescent           wakes up: blinks, looks around, stretches, smiles
     first quarter             climbs the sky — diagonally upwards, half lit
     waxing gibbous            swelling, eager — lanterns light up, waiting for Rằm
     full moon (Rằm)           round and serene — soft light, lanterns rise (gentle eyes)
     waning gibbous            content — the festival ends, lanterns drift away
     last quarter              long yawns, sleepy — late at night
     waning crescent           dozes off to rest, dawn breaks → back to Sóc

   New `moon` category — spliced into EMOTION_CATEGORY_KEYS after `night`.
   Loaded after the arc packs + scenes-weather/comms.
*/

const {
  W, H, STATUS_H, CY, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, ease, blink, starPath,
} = window.EmotionCore;
const mCats = window.EMOTION_CATEGORIES;
const EYE_CYAN = '#5be9ff';

/* Progress helpers. Every library file runs in one global scope (Babel turns
   each into a classic script), so these names must not match another file's:
   a helper called `pulse` here used to replace EmotionCore.pulse everywhere. */
function seg(sp, a, b) { return clamp((sp - a) / (b - a), 0, 1); }
function phasePulse(sp, a, b) { const s = seg(sp, a, b); return Math.sin(s * Math.PI); }

/* ----- The robot-as-moon disc: phase-correct (same math as the phone
        app's moon). Lit side = scene tone (--accent); dark sphere felt by
        earthshine + rim so the robot's body is always present even at
        the new moon. ----- */
function moonDisc(cx, cy, R, p, op) {
  const cos = Math.cos(TAU * p);
  const illum = (1 - cos) / 2;
  const waxing = p < 0.5;
  const rx = R * Math.abs(cos);
  const gibbous = illum > 0.5;
  const dark = '#0e1422';
  const semi = waxing
    ? `M ${cx} ${cy - R} A ${R} ${R} 0 0 1 ${cx} ${cy + R} Z`
    : `M ${cx} ${cy - R} A ${R} ${R} 0 0 0 ${cx} ${cy + R} Z`;
  const crX = (a, b) => cx + (waxing && !gibbous ? a : b);
  return (
    <g opacity={op}>
      <circle cx={cx} cy={cy} r={R * (1.5 - illum * 0.25)}
              fill="var(--accent)" opacity={0.06 + illum * 0.14} />
      <circle cx={cx} cy={cy} r={R} fill={dark} />
      <circle cx={cx} cy={cy} r={R} fill="var(--accent)"
              opacity={illum < 0.05 ? 0.17 : 0.06} />
      {illum > 0.012 && <path d={semi} fill="var(--accent)" />}
      {rx > 0.4 && <ellipse cx={cx} cy={cy} rx={rx} ry={R}
                            fill={gibbous ? 'var(--accent)' : dark} />}
      {illum > 0.42 && (
        <g fill="var(--bg)" opacity={0.16}>
          <circle cx={crX(R * 0.34, -R * 0.42)} cy={cy - R * 0.5} r={R * 0.1} />
          <circle cx={crX(R * 0.5, R * 0.46)} cy={cy + R * 0.46} r={R * 0.13} />
        </g>
      )}
      <circle cx={cx} cy={cy} r={R - 0.6} fill="none" stroke="var(--eye)"
              strokeWidth={illum < 0.05 ? 1.7 : 1.2}
              strokeOpacity={illum < 0.05 ? 0.7 : 0.32} />
    </g>
  );
}

/* ----- Eye geometry that MORPHS between the signature pose (m=0:
        centered, EYE_W×EYE_H rounded rects at LX/RX) and the on-moon pose
        (m=1: drawn together & shrunk onto the disc at dcx,dcy with radius
        R). The eyes are ALWAYS cyan — that is the robot's identity,
        present at the start and end of every story. ----- */
function eyeGeo(m, dcx, dcy, R) {
  const eg = R * 0.34;
  return {
    xL: lerp(LX, dcx - eg, m),
    xR: lerp(RX, dcx + eg, m),
    cy: lerp(CY, dcy, m),
    w:  lerp(EYE_W, R * 0.27, m),
    h0: lerp(EYE_H, R * 0.5, m),
    rx: lerp(EYE_RX, R * 0.12, m),
    sw: lerp(14, R * 0.085, m),
  };
}
function drawEyes(g, emotion, t, R, gaze, fx) {
  // fx = scene-fx strength (0 at bookend → 1 in act): catchlights + keyline
  const c = EYE_CYAN;
  const gx = (gaze ? gaze[0] : 0) * R, gy = (gaze ? gaze[1] : 0) * R;
  const { w, rx, sw } = g;
  // thin dark keyline so the cyan eyes read on the bright lit half — only
  // while on the disc (fx>0). NOT a filled socket (no "eye-bag" look).
  const kw = fx > 0.04 ? Math.max(R * 0.05, 1.6) : 0;
  const kc = '#0a1422';
  const rect = (x, h, yo = 0, r = rx) => (
    <rect x={x + gx - w / 2} y={g.cy + gy + yo - Math.max(h, 4) / 2}
          width={w} height={Math.max(h, 4)} rx={r} fill={c}
          stroke={kw ? kc : 'none'} strokeWidth={kw} />
  );
  const catch_ = (x, h) => fx > 0.04 ? (
    <ellipse cx={x + gx - w * 0.17} cy={g.cy + gy - Math.max(h, 4) * 0.22}
             rx={w * 0.17} ry={Math.max(h, 4) * 0.15} fill="#eafdff" opacity={fx * 0.9} />
  ) : null;
  const lid = (x) => {
    const d = `M ${x + gx - w / 2} ${g.cy + gy} Q ${x + gx} ${g.cy + gy + g.h0 * 0.22} ${x + gx + w / 2} ${g.cy + gy}`;
    return <g fill="none" strokeLinecap="round">
      {kw ? <path d={d} stroke={kc} strokeWidth={sw + kw * 2} /> : null}
      <path d={d} stroke={c} strokeWidth={sw} />
    </g>;
  };
  const smile = (x, depth) => {
    const d = `M ${x + gx - w * 0.6} ${g.cy + gy + g.h0 * 0.06} Q ${x + gx} ${g.cy + gy - depth} ${x + gx + w * 0.6} ${g.cy + gy + g.h0 * 0.06}`;
    return <g fill="none" strokeLinecap="round">
      {kw ? <path d={d} stroke={kc} strokeWidth={sw * 1.05 + kw * 2} /> : null}
      <path d={d} stroke={c} strokeWidth={sw * 1.05} />
    </g>;
  };

  let inner;
  switch (emotion) {
    case 'sleep': inner = <g>{lid(g.xL)}{lid(g.xR)}</g>; break;
    case 'doze': { const h = g.h0 * 0.2; inner = <g>{rect(g.xL, h, 0, g.h0 * 0.1)}{rect(g.xR, h, 0, g.h0 * 0.1)}</g>; break; }
    case 'yawn': { const k = 0.2 + 0.65 * Math.abs(Math.sin(t * TAU * 0.45)); const h = g.h0 * k; inner = <g>{rect(g.xL, h)}{rect(g.xR, h)}{catch_(g.xL, h)}{catch_(g.xR, h)}</g>; break; }
    case 'beam': inner = <g>{smile(g.xL, g.h0 * 0.42)}{smile(g.xR, g.h0 * 0.42)}</g>; break;
    case 'content': inner = <g>{smile(g.xL, g.h0 * 0.24)}{smile(g.xR, g.h0 * 0.24)}</g>; break;
    case 'serene': { // FULL MOON (Rằm) — calm, round, catch-lit; slow gentle blink
      const ph = (t * 2.4) % 1; const bl = blink(ph, 0.5, 0.1);
      const h = g.h0 * (1.02 - bl * 0.92);
      inner = <g>{rect(g.xL, h)}{rect(g.xR, h)}{catch_(g.xL, h)}{catch_(g.xR, h)}</g>; break;
    }
    case 'eager': { const wob = Math.sin(t * TAU * 3) * g.h0 * 0.05; const h = g.h0 * 1.06; inner = <g>{rect(g.xL, h, wob)}{rect(g.xR, h, wob)}{catch_(g.xL, h)}{catch_(g.xR, h)}</g>; break; }
    case 'climb': { const h = g.h0 * 0.95; inner = <g>{rect(g.xL, h, -g.h0 * 0.12)}{rect(g.xR, h, -g.h0 * 0.12)}{catch_(g.xL, h)}{catch_(g.xR, h)}</g>; break; }
    case 'wide': { const h = g.h0 * 1.16; inner = <g>{rect(g.xL, h)}{rect(g.xR, h)}{catch_(g.xL, h)}{catch_(g.xR, h)}</g>; break; }
    default: { const bl = Math.max(blink(t, 0.4, 0.05), blink(t, 0.9, 0.05)); const h = g.h0 * (1 - bl * 0.92); inner = <g>{rect(g.xL, h)}{rect(g.xR, h)}{catch_(g.xL, h)}{catch_(g.xR, h)}</g>; }
  }

  return (
    <g style={{ filter: `drop-shadow(0 0 ${Math.max(R * 0.08, 5)}px rgba(91,233,255,0.8))` }}>{inner}</g>
  );
}

/* floating Zzz */
function zzz(x, y, t, s = 1, op = 1) {
  return (
    <g opacity={op}>
      {[0, 1, 2].map((i) => {
        const p = ((t * 0.5) + i * 0.34) % 1;
        return (
          <text key={i} x={x + i * 7 * s + p * 16 * s} y={y - p * 22 * s}
                fontFamily="ui-monospace, Menlo, monospace"
                fontSize={(9 + i * 2.5) * s} fontWeight={700}
                fill={EYE_CYAN} opacity={(1 - p) * 0.85}>z</text>
        );
      })}
    </g>
  );
}
function twinkle(x, y, r, t, off = 0) {
  const tw = 0.55 + 0.45 * Math.sin(t * TAU * 0.9 + off);
  return <path d={starPath(x, y, r, r * 0.42)} fill="var(--eye)" opacity={0.4 + tw * 0.5} />;
}
function lantern(x, y, s, lit) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-7} y={-12} width={14} height={3} rx={1.5} fill="var(--eye)" />
      <ellipse cx={0} cy={0} rx={9} ry={12} fill="var(--accent)" opacity={0.3 + lit * 0.5} />
      <ellipse cx={0} cy={0} rx={9} ry={12} fill="none" stroke="var(--eye)" strokeWidth={1.2} />
      <circle cx={0} cy={1} r={3.2} fill="var(--eye)" opacity={lit} />
      <rect x={-5} y={11} width={10} height={3} rx={1.5} fill="var(--eye)" />
      <line x1={0} y1={14} x2={0} y2={19} stroke="var(--accent)" strokeWidth={1.4} opacity={lit} />
    </g>
  );
}

/* ----- shared skeleton. Bookends on the signature eyes; the moon forms
        around them; the long `act` carries the story (sp = 0..1). ----- */
function moonScene({ id, label, tone, duration, p, R = 68, caption,
                    path, eyeFor, extras, breathe = 0.02 }) {
  return {
    id, label, tone, duration, p,
    render: (t) => {
      const durSec = duration / 1000;
      const fIn = 1.7 / durSec, fForm = 1.4 / durSec;
      const fOut = 1.7 / durSec, fUnform = 1.4 / durSec;
      const t1 = fIn, t2 = t1 + fForm, t4 = 1 - fOut, t3 = t4 - fUnform;

      let m, fx, discOp, sp, emo, gaze = [0, 0];
      let dcx = W / 2, dcy = CY, R0 = R;

      if (t < t1) {                              // ── signature eyes (open)
        m = 0; fx = 0; discOp = 0; sp = 0; emo = 'steady';
      } else if (t < t2) {                       // ── moon forms around eyes
        const pp = ease.inOut((t - t1) / (t2 - t1));
        m = pp; fx = pp; discOp = ease.out(pp); sp = 0; emo = 'steady';
        R0 = R * lerp(0.84, 1, pp);
      } else if (t < t3) {                       // ── the STORY
        m = 1; fx = 1; discOp = 1; sp = (t - t2) / (t3 - t2);
        emo = eyeFor ? eyeFor(t, sp) : 'wake';
        if (eyeFor && eyeFor.gaze) gaze = eyeFor.gaze(t, sp);
        if (path) { const d = path(sp, t); dcx += d.dx || 0; dcy += d.dy || 0; R0 = R * (d.s || 1); }
        R0 *= 1 + Math.sin(t * TAU * 0.4) * breathe;
        dcy += Math.sin(t * TAU * 0.3) * 3;
      } else if (t < t4) {                       // ── moon dissolves
        const pp = ease.inOut((t - t3) / (t4 - t3));
        m = 1 - pp; fx = 1 - pp; discOp = 1 - ease.in(pp); sp = 1; emo = 'steady';
        R0 = R * lerp(1, 0.84, pp);
      } else {                                   // ── signature eyes (close)
        m = 0; fx = 0; discOp = 0; sp = 1; emo = 'steady';
      }

      const g = eyeGeo(m, dcx, dcy, R0);
      return (
        <g>
          {extras && <g opacity={discOp}>{extras(t, sp, dcx, dcy, R0)}</g>}
          {discOp > 0.01 && moonDisc(dcx, dcy, R0, p, discOp)}
          {drawEyes(g, emo, t, R0, gaze, fx)}
        </g>
      );
    },
  };
}

/* ============================================================
   The eight phases — each a long narrative, bookended by the eyes
============================================================ */
const STARS = [[44, 64], [104, 44], [212, 50], [276, 92], [60, 150], [292, 150], [150, 38], [188, 150]];

const MOON_CASES = [

  /* 0 · NEW MOON (Sóc) — fast asleep; a shooting star; a small stir. */
  moonScene({
    id: 'moon-new', label: 'New moon · fast asleep', tone: 'purple', duration: 26000, p: 0.0, R: 60, breathe: 0.01,
    path: (sp) => ({ s: 1 + phasePulse(sp, 0.55, 0.72) * 0.03 }),
    eyeFor: (t, sp) => (phasePulse(sp, 0.58, 0.74) > 0.6 ? 'doze' : 'sleep'),
    extras: (t, sp, cx, cy, R) => {
      const sh = seg(sp, 0.18, 0.42);
      const shx = lerp(40, 280, sh), shy = lerp(46, 150, sh);
      return (
        <g>
          {STARS.map(([x, y], i) => <g key={i}>{twinkle(x, y, 3.2, t, i * 1.3)}</g>)}
          {sh > 0.02 && sh < 0.98 && (
            <g opacity={Math.sin(sh * Math.PI)}>
              <line x1={shx - 30} y1={shy - 15} x2={shx} y2={shy}
                    stroke="var(--eye)" strokeWidth={2} strokeLinecap="round" />
              <circle cx={shx} cy={shy} r={2.6} fill="var(--eye)" />
            </g>
          )}
          {zzz(cx + R * 0.3, cy - R * 1.0, t * 0.7, 1.1, 1 - phasePulse(sp, 0.55, 0.74) * 0.8)}
        </g>
      );
    },
  }),

  /* 1 · WAXING CRESCENT — wakes up: blinks, looks around, stretches, smiles. */
  moonScene({
    id: 'moon-wax-cre', label: 'Waxing crescent · waking up', tone: 'cyan', duration: 22000, p: 0.1, R: 62, breathe: 0.03,
    path: (sp) => ({ s: 1 + phasePulse(sp, 0.5, 0.66) * 0.05 }),
    eyeFor: Object.assign(
      (t, sp) => sp < 0.16 ? 'doze' : sp < 0.3 ? 'wide' : sp < 0.62 ? 'wake' : 'beam',
      { gaze: (t, sp) => {
          const look = seg(sp, 0.3, 0.6);
          return [Math.sin(look * TAU) * 0.12 * (look > 0 && look < 1 ? 1 : 0), 0];
        } }),
    extras: (t, sp, cx, cy, R) => (
      <g>
        {twinkle(70, 60, 4 + phasePulse(sp, 0.6, 0.85) * 3, t, 0)}
        {twinkle(258, 80, 3, t, 2.2)}
      </g>
    ),
  }),

  /* 2 · FIRST QUARTER — climbs the sky (diagonally upwards). */
  moonScene({
    id: 'moon-first-q', label: 'First quarter · climbing the sky', tone: 'cyan', duration: 22000, p: 0.25, R: 64, breathe: 0.015,
    path: (sp) => ({ dx: lerp(-44, 44, ease.inOut(sp)), dy: lerp(30, -26, ease.inOut(sp)) }),
    eyeFor: (t, sp) => (Math.sin(sp * TAU * 4) > 0.7 ? 'climb' : 'wake'),
    extras: (t, sp, cx, cy, R) => (
      <g>
        {[0, 1, 2].map((i) => {
          const pp = ((t * 0.6) + i * 0.33) % 1;
          const y = lerp(H - 10, STATUS_H + 30, pp), o = Math.sin(pp * Math.PI) * 0.45;
          return (
            <g key={i} stroke="var(--accent)" strokeWidth={2.2} fill="none"
               strokeLinecap="round" opacity={o}>
              <path d={`M ${W * 0.15} ${y} l 7 -7 l 7 7`} />
              <path d={`M ${W * 0.79} ${y} l 7 -7 l 7 7`} />
            </g>
          );
        })}
        {twinkle(60, 60, 2.8, t, 1)}
        {twinkle(290, 150, 2.6, t, 3)}
      </g>
    ),
  }),

  /* 3 · WAXING GIBBOUS — eager for the full moon; lanterns light up one by one. */
  moonScene({
    id: 'moon-wax-gib', label: 'Waxing gibbous · eager for the full moon', tone: 'warm', duration: 22000, p: 0.4, R: 68, breathe: 0.04,
    path: (sp, t) => ({ dy: Math.abs(Math.sin(t * TAU * 0.9)) * -6 }),
    eyeFor: () => 'eager',
    extras: (t, sp, cx, cy, R) => {
      const Ls = [[70, H - 30], [128, H - 22], [196, H - 28], [254, H - 22]];
      return (
        <g>
          {[...Array(9)].map((_, i) => {
            const a = (i / 9) * TAU + t * 0.4;
            const on = clamp(sp * 1.4 - i / 12, 0, 1);
            const rr = R + 16 + Math.sin(t * TAU * 0.8 + i) * 5;
            return on > 0.05 ? (
              <path key={i} d={starPath(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2.6 * on, 1.1 * on)}
                    fill="var(--accent)" opacity={on * 0.85} />
            ) : null;
          })}
          {Ls.map(([x, y], i) => {
            const lit = clamp((sp - (i * 0.2 + 0.05)) * 6, 0, 1);
            const bob = Math.sin(t * TAU * 0.6 + i) * 2;
            return lit > 0.02 ? <g key={i}>{lantern(x, y + bob, 0.78, lit)}</g> : null;
          })}
        </g>
      );
    },
  }),

  /* 4 · FULL MOON (Rằm) — round and SERENE. A soft gold disc, a gently
        breathing halo, a few lanterns drifting up; gentle round eyes with
        catchlights and an occasional slow blink. Calm and quiet. */
  moonScene({
    id: 'moon-full', label: 'Full moon · serene', tone: 'warm', duration: 30000, p: 0.5, R: 76, breathe: 0.02,
    eyeFor: () => 'serene',
    extras: (t, sp, cx, cy, R) => (
      <g>
        {/* softly breathing halo */}
        <circle cx={cx} cy={cy} r={R * (1.32 + 0.06 * Math.sin(t * TAU * 0.3))}
                fill="var(--accent)" opacity={0.07} />
        <circle cx={cx} cy={cy} r={R * (1.14 + 0.04 * Math.sin(t * TAU * 0.3))}
                fill="var(--accent)" opacity={0.06} />
        {/* a few motes of light floating around the moon (fireflies) */}
        {[...Array(6)].map((_, i) => {
          const a = (i / 6) * TAU + t * 0.18;
          const rr = R * 1.45 + Math.sin(t * TAU * 0.4 + i) * 10;
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * TAU * 0.5 + i));
          return <circle key={i} cx={cx + Math.cos(a) * rr} cy={cy + Math.sin(a) * rr * 0.7}
                         r={1.8} fill="var(--accent)" opacity={tw * 0.7} />;
        })}
        {/* two lanterns drifting up on either side */}
        {[-1, 1].map((s, i) => {
          const ph = ((t * 0.1) + i * 0.5) % 1;
          return <g key={i}>{lantern(cx + s * (R + 34), lerp(H + 16, STATUS_H + 26, ph), 0.82, 1)}</g>;
        })}
      </g>
    ),
  }),

  /* 5 · WANING GIBBOUS — the festival ends, content; lanterns drift away. */
  moonScene({
    id: 'moon-wan-gib', label: 'Waning gibbous · content', tone: 'warm', duration: 24000, p: 0.6, R: 68, breathe: 0.018,
    path: (sp, t) => ({ dx: Math.sin(t * TAU * 0.25) * 6 }),
    eyeFor: () => 'content',
    extras: (t, sp, cx, cy, R) => (
      <g>
        {twinkle(64, 60, 2.6, t, 1.5)}
        {twinkle(286, 150, 2.4, t, 3.4)}
        {[...Array(4)].map((_, i) => {
          const spk = ((t * 0.45) + i * 0.25) % 1;
          return <circle key={i} cx={cx - R + i * R * 0.6} cy={lerp(cy - R, cy + R, spk)}
                         r={1.6} fill="var(--accent)" opacity={(1 - spk) * (1 - sp) * 0.5} />;
        })}
        {[0, 1].map((i) => {
          const dx = lerp(cx - R - 10, -40, seg(sp, 0.1 + i * 0.25, 0.85));
          const yy = H - 40 + Math.sin(t * TAU * 0.5 + i) * 6;
          return seg(sp, 0.1 + i * 0.25, 1) < 1 ? <g key={i}>{lantern(dx, yy, 0.74, 0.7 - sp * 0.4)}</g> : null;
        })}
      </g>
    ),
  }),

  /* 6 · LAST QUARTER — long yawns, sleepy; late at night. */
  moonScene({
    id: 'moon-last-q', label: 'Last quarter · yawning', tone: 'blue', duration: 22000, p: 0.75, R: 64, breathe: 0.012,
    eyeFor: (t, sp) => (sp < 0.55 ? 'yawn' : 'doze'),
    extras: (t, sp, cx, cy, R) => (
      <g>
        {twinkle(58, 58, 2.6, t, 0)}
        {twinkle(150, 44, 2.2, t, 1.7)}
        {twinkle(286, 74, 2.8, t, 3.1)}
        {sp > 0.55 && zzz(cx + R * 0.4, cy - R * 1.0, t, 0.9, seg(sp, 0.55, 0.75))}
      </g>
    ),
  }),

  /* 7 · WANING CRESCENT — dozes off to rest; dawn breaks. */
  moonScene({
    id: 'moon-wan-cre', label: 'Waning crescent · going to rest', tone: 'purple', duration: 26000, p: 0.9, R: 60, breathe: 0.01,
    path: (sp) => ({ dy: lerp(-4, 26, ease.in(sp)), s: lerp(1, 0.92, sp) }),
    eyeFor: (t, sp) => (sp < 0.4 ? 'doze' : 'sleep'),
    extras: (t, sp, cx, cy, R) => (
      <g>
        <rect x={0} y={H - 30} width={W} height={30}
              fill="var(--accent)" opacity={0.06 + seg(sp, 0.3, 1) * 0.12} />
        {twinkle(96, 64, 2.4 * (1 - sp * 0.7), t, 1.2)}
        {twinkle(232, 56, 2.2 * (1 - sp * 0.7), t, 2.6)}
        {sp < 0.5 && zzz(cx + R * 0.4, cy - R * 0.95, t, 0.8, 1 - seg(sp, 0.2, 0.5))}
      </g>
    ),
  }),
];

/* ============================================================
   Register the new category + key
============================================================ */
mCats.moon = {
  label: 'Moon',
  desc: 'The robot becomes the moon: one story per lunar phase, opening and closing on its signature cyan eyes. Fast asleep at the new moon → serene at the full moon → back to rest.',
  kind: 'scene',
  tone: 'purple',
  variants: MOON_CASES,
};

(() => {
  const keys = window.EMOTION_CATEGORY_KEYS || (window.EMOTION_CATEGORY_KEYS = []);
  if (!keys.includes('moon')) {
    const at = keys.indexOf('night');
    if (at >= 0) keys.splice(at + 1, 0, 'moon');
    else keys.push('moon');
  }
})();

/* ============================================================
   Host hookup — pick the right story for tonight's lunar day.
   Standalone synodic math (the same as the phone app's moon):

     showScene('moon', MoonPhase.sceneId());            // tonight
     showScene('moon', MoonPhase.sceneForLunarDay(15)); // a given lunar day (the full moon)
============================================================ */
const M_SYNODIC = 29.530588853;
const M_NEWREF = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
const MOON_SCENE_IDS = [
  'moon-new', 'moon-wax-cre', 'moon-first-q', 'moon-wax-gib',
  'moon-full', 'moon-wan-gib', 'moon-last-q', 'moon-wan-cre',
];
function moonPhaseP(date) {
  const di = (date ? date.getTime() : Date.now()) / 86400000;
  let age = (di - M_NEWREF) % M_SYNODIC;
  if (age < 0) age += M_SYNODIC;
  return age / M_SYNODIC;                         // 0 new → .5 full → 1 new
}
function sceneIdForP(p) {
  p = ((p % 1) + 1) % 1;
  let best = 9, idx = 0;
  for (let i = 0; i < 8; i++) {
    const tp = i / 8; let d = Math.abs(tp - p); d = Math.min(d, 1 - d);
    if (d < best) { best = d; idx = i; }
  }
  return MOON_SCENE_IDS[idx];
}
window.MoonPhase = {
  MOON_SCENE_IDS,
  phaseP: moonPhaseP,
  sceneId: (date) => sceneIdForP(moonPhaseP(date)),
  sceneForLunarDay: (d) => sceneIdForP((((d - 1) % 30) + 30) % 30 / M_SYNODIC),
  variantFor: (date) => {
    const id = sceneIdForP(moonPhaseP(date));
    return mCats.moon.variants.find((v) => v.id === id);
  },
};
