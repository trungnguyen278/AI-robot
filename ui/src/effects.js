// SPDX-License-Identifier: MIT
/* Effects: what an expression draws around the eyes (hearts, a tear, Zzz…).

   Each effect draws on a context already placed at the centre of the face, in face
   units (pose.js), with the expression's colour and glow set. `t` is the seconds since
   the expression started; `look.alpha` fades the effect in and out with its
   expression, and `look.voice` is the loudness of the voice the face reacts to.
*/

const TAU = Math.PI * 2;

function heart(ctx, cx, cy, size) {
  const k = size / 30;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 9 * k);
  ctx.bezierCurveTo(cx - 18 * k, cy - 3 * k, cx - 18 * k, cy - 18 * k, cx - 9 * k, cy - 18 * k);
  ctx.bezierCurveTo(cx - 4 * k, cy - 18 * k, cx, cy - 12 * k, cx, cy - 6 * k);
  ctx.bezierCurveTo(cx, cy - 12 * k, cx + 4 * k, cy - 18 * k, cx + 9 * k, cy - 18 * k);
  ctx.bezierCurveTo(cx + 18 * k, cy - 18 * k, cx + 18 * k, cy - 3 * k, cx, cy + 9 * k);
  ctx.fill();
}

// A drop with its tip up.
function drop(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.bezierCurveTo(cx + 0.9 * size, cy - 0.1 * size, cx + 0.6 * size, cy + 0.75 * size, cx, cy + 0.75 * size);
  ctx.bezierCurveTo(cx - 0.6 * size, cy + 0.75 * size, cx - 0.9 * size, cy - 0.1 * size, cx, cy - size);
  ctx.fill();
}

// A four-pointed sparkle.
function sparkle(ctx, cx, cy, radius) {
  const inner = radius * 0.28;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 === 0 ? radius : inner;
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  ctx.fill();
}

function text(ctx, value, x, y, size) {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

// Fades in over the start of a cycle and out over its end.
const rise = (p) => Math.sin(Math.PI * p);

export const EFFECTS = {
  hearts(ctx, t, { alpha }) {
    [-140, 0, 140].forEach((x, i) => {
      const p = (t / 2.4 + i / 3) % 1;
      ctx.globalAlpha = alpha * rise(p);
      heart(ctx, x + 8 * Math.sin(TAU * p), 40 - 130 * p, 18 + 8 * rise(p));
    });
  },

  tear(ctx, t, { alpha }) {
    const p = (t / 1.8) % 1;
    ctx.globalAlpha = alpha * Math.min(1, p * 6, (1 - p) * 4);
    drop(ctx, -108, 28 + 70 * p * p, 9);
  },

  zzz(ctx, t, { alpha }) {
    for (let i = 0; i < 3; i++) {
      const p = (t / 3 + i / 3) % 1;
      ctx.globalAlpha = alpha * rise(p);
      text(ctx, 'z', 118 + 34 * p, -38 - 64 * p, 14 + 14 * p);
    }
  },

  question(ctx, t, { alpha }) {
    ctx.globalAlpha = alpha;
    text(ctx, '?', 132, -74 + 4 * Math.sin(TAU * t * 0.8), 46);
  },

  sparkles(ctx, t, { alpha }) {
    [[-142, -62], [142, -50], [-130, 56], [134, 64]].forEach(([x, y], i) => {
      const twinkle = Math.max(0, Math.sin(TAU * (t / 1.2 + i * 0.27)));
      ctx.globalAlpha = alpha * twinkle;
      sparkle(ctx, x, y, 4 + 9 * twinkle);
    });
  },

  sweat(ctx, t, { alpha }) {
    const p = (t / 1.8) % 1;
    ctx.globalAlpha = alpha * Math.min(1, p * 5, (1 - p) * 3);
    drop(ctx, -130, -66 + 40 * p, 8);
  },

  dots(ctx, t, { alpha }) {
    for (let i = 0; i < 3; i++) {
      const p = (t * 1.6 + 1 - i * 0.2) % 1;
      ctx.globalAlpha = alpha * Math.max(0.25, p < 0.5 ? p * 2 : (1 - p) * 2);
      ctx.beginPath();
      ctx.arc(92 + i * 18, -96, 4.5, 0, TAU);
      ctx.fill();
    }
  },

  // Sound bars that follow the voice, with a faint shimmer in silence.
  bars(ctx, t, { alpha, voice }) {
    const shape = [0.45, 0.7, 0.9, 1, 0.9, 0.7, 0.45];
    ctx.globalAlpha = alpha * 0.85;
    shape.forEach((k, i) => {
      const shimmer = 2.5 * Math.abs(Math.sin(TAU * (t * 0.9 + i * 0.13)));
      const height = 5 + shimmer + 34 * k * voice * (0.75 + 0.25 * Math.sin(TAU * (t * 3.1 + i * 0.37)));
      ctx.beginPath();
      ctx.roundRect(-42 + i * 14 - 3.5, 96 - height / 2, 7, height, 3.5);
      ctx.fill();
    });
  },
};
