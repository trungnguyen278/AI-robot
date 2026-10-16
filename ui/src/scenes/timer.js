// SPDX-License-Identifier: MIT
/* Timer: a ring that empties as the time runs out, and the time left.

   Data: `ends_at` (Unix time in seconds when it rings, on the software's clock),
   `duration` (its length in seconds) and `label` (optional). The page counts down on
   its own, so the software sends the timer once, not every second. At zero the ring
   pulses until the software takes the scene away. Without `ends_at` it shows a
   stopped "--:--". */

import { TAU, clamp } from '../math.js';
import { clip, digits, text } from '../text.js';
import { CORNER, cached, duration } from './kit.js';

export const LABEL_LENGTH = 16; // characters, as in the protocol's vocabulary

const RING = { x: -8, y: 8, r: 72 };

export default {
  tone: 'orange',
  slot: CORNER,
  example: { duration: 300, label: 'Tea' }, // `ends_at` is added when it starts

  draw(ctx, t, { alpha, data, now, pixels }) {
    const left = Number.isFinite(data.ends_at) ? Math.max(0, data.ends_at - now.getTime() / 1000) : null;
    const total = Number.isFinite(data.duration) && data.duration > 0 ? data.duration : Math.max(left ?? 1, 1);
    const done = left === 0;
    const { x, y, r } = RING;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.6 + 0.4 * alpha, 0.6 + 0.4 * alpha);
    ctx.globalAlpha = alpha;
    cached(ctx, 'timer-track', { x: -r - 6, y: -r - 6, w: 2 * r + 12, h: 2 * r + 12 }, pixels, (c) => {
      c.globalAlpha = 0.2;
      c.lineWidth = 9;
      c.beginPath();
      c.arc(0, 0, r, 0, TAU);
      c.stroke();
    });
    const share = left === null ? 0 : done ? 1 : clamp(left / total, 0, 1);
    if (share > 0.002) {
      ctx.globalAlpha = done ? alpha * (0.55 + 0.45 * Math.cos(TAU * t * 1.6)) : alpha;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + share * TAU);
      ctx.stroke();
    }
    ctx.restore();

    const shake = done ? 2.5 * Math.sin(TAU * t * 9) * Math.max(0, Math.cos(TAU * t * 0.8)) : 0;
    const label = typeof data.label === 'string' && data.label ? clip(data.label, LABEL_LENGTH) : 'Timer';
    const time = left === null ? '--:--' : duration(left);
    ctx.globalAlpha = alpha;
    digits(ctx, time, x + shake, y + 4, time.length > 5 ? 30 : 40);
    ctx.globalAlpha = alpha * 0.65;
    text(ctx, done ? 'Done' : label, x, y - 30, 14, { weight: 500 });
  },
};
