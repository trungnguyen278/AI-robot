// SPDX-License-Identifier: MIT
/* Boot: the robot wakes up. A line of light grows from the centre, then opens into
   the eyes, which settle with a small overshoot. The robot's page plays it when it
   opens (screen.html), before the software's first state. */

import { clamp, ease } from '../math.js';

const LINE = 0.45; // seconds for the line to grow
const OPEN = 0.5;  // seconds for the eyes to open from it

export default {
  tone: 'cyan',
  length: 1.2, // seconds the whole animation needs
  // The face starts as a dot at the centre and grows to its full size.
  slot: (t) => ({ x: 0, y: 0, scale: 0.02 + 0.98 * ease.back(clamp((t - LINE) / OPEN, 0, 1)) }),
  example: {},

  draw(ctx, t, { alpha }) {
    const fade = 1 - clamp((t - LINE - 0.1) / 0.3, 0, 1);
    if (fade <= 0) return;
    const grow = ease.out(Math.min(1, t / LINE));
    ctx.globalAlpha = alpha * fade;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-120 * grow, 0);
    ctx.lineTo(120 * grow, 0);
    ctx.stroke();
  },
};
