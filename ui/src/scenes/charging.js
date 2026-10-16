// SPDX-License-Identifier: MIT
/* Charging: a large battery filling up, with its level, while the robot is plugged
   in. It reads the battery from the status (no data of its own). */

import { TAU } from '../math.js';
import { text } from '../text.js';
import { CORNER, batteryPercent, boltPath, cached, cutOut } from './kit.js';

const BODY = { x: -90, y: -32, w: 160, h: 76, r: 16 };
const INSET = 9;

export default {
  tone: 'green',
  slot: CORNER,
  example: {},

  draw(ctx, t, { alpha, status, pixels }) {
    const percent = batteryPercent(status);
    const { x, w, h, r } = BODY;
    const y = BODY.y + 14 * (1 - alpha);

    // The shell and its terminal never change.
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(x, y);
    cached(ctx, 'battery-shell', { x: -3, y: -3, w: w + 20, h: h + 6 }, pixels, (c) => {
      c.lineWidth = 6;
      c.beginPath();
      c.roundRect(0, 0, w, h, r);
      c.stroke();
      c.beginPath();
      c.roundRect(w + 5, h / 2 - 15, 9, 30, 4);
      c.fill();
    });
    ctx.restore();

    // The level, with a light band sweeping along it as the charge flows in.
    const full = w - 2 * INSET;
    const fill = percent === null ? full * ((t * 0.4) % 1) : (full * percent) / 100;
    if (fill > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + INSET, y + INSET, fill, h - 2 * INSET, 7);
      ctx.globalAlpha = alpha * 0.85;
      ctx.fill();
      ctx.clip();
      ctx.shadowBlur = 0;
      const band = x + INSET + ((t * 0.7) % 1.4) * full - 0.2 * full;
      const sweep = ctx.createLinearGradient(band - 30, 0, band + 30, 0);
      sweep.addColorStop(0, 'rgba(255, 255, 255, 0)');
      sweep.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
      sweep.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }

    // A bolt in the middle, cut out so that it shows on the level and off it.
    ctx.globalAlpha = alpha;
    boltPath(ctx, x + w / 2, y + h / 2, 44 * (1 + 0.06 * Math.sin(TAU * t * 0.9)));
    cutOut(ctx, 3);

    ctx.globalAlpha = alpha * 0.75;
    text(ctx, percent === null ? 'Charging' : `${percent}%`, x + w / 2, y + h + 26, 20, { weight: 600 });
  },
};
