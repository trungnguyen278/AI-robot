// SPDX-License-Identifier: MIT
/* Clock: a dial with the present time, and the time and date in digits. */

import { TAU } from '../math.js';
import { digits, text } from '../text.js';
import { CORNER, cached, hhmm } from './kit.js';

const DIAL = { x: -44, y: 8, r: 72 };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The ring and the ticks, which never change.
function dial(ctx, r) {
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const major = i % 3 === 0;
    const turn = i / 12;
    const inner = r - (major ? 15 : 10);
    ctx.globalAlpha = major ? 0.9 : 0.5;
    ctx.lineWidth = major ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(Math.sin(turn * TAU) * inner, -Math.cos(turn * TAU) * inner);
    ctx.lineTo(Math.sin(turn * TAU) * (r - 5), -Math.cos(turn * TAU) * (r - 5));
    ctx.stroke();
  }
}

function hand(ctx, turn, length, width) {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(-Math.sin(turn * TAU) * 8, Math.cos(turn * TAU) * 8);
  ctx.lineTo(Math.sin(turn * TAU) * length, -Math.cos(turn * TAU) * length);
  ctx.stroke();
}

export default {
  tone: 'cyan',
  slot: CORNER,
  clock: false, // the status row leaves the time to the scene
  example: {},

  draw(ctx, t, { alpha, now, pixels }) {
    const { x, y, r } = DIAL;
    ctx.save();
    ctx.translate(x, y + 18 * (1 - alpha));
    ctx.scale(0.85 + 0.15 * alpha, 0.85 + 0.15 * alpha);
    ctx.globalAlpha = alpha;
    cached(ctx, 'clock-dial', { x: -r - 4, y: -r - 4, w: 2 * r + 8, h: 2 * r + 8 }, pixels, (c) => dial(c, r));
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    ctx.lineCap = 'round';
    hand(ctx, hours / 12, r * 0.5, 8);
    hand(ctx, minutes / 60, r * 0.74, 5);
    ctx.globalAlpha = alpha * 0.7;
    hand(ctx, seconds / 60, r * 0.82, 2);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.globalAlpha = alpha;
    digits(ctx, hhmm(now), 104, 8 + 10 * (1 - alpha), 34);
    ctx.globalAlpha = alpha * 0.65;
    text(ctx, `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`, 104, 40, 14, { weight: 500 });
  },
};
