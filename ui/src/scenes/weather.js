// SPDX-License-Identifier: MIT
/* Weather: an animated sky for the condition, the temperature and the place.

   Data: `condition` (one of CONDITIONS), `temperature` (a number), `unit` (one of
   UNITS, "C" by default), `night` (true for the moon instead of the sun) and `place`
   (optional, shown above the temperature). The protocol's vocabulary lists the same
   values; the tests compare them. */

import { TAU, clamp } from '../math.js';
import { clip, font, text } from '../text.js';
import { BACKGROUND, rgba } from '../tones.js';
import { CORNER, cutOut } from './kit.js';

export const CONDITIONS = {
  clear: { label: 'Clear', tone: 'warm', night: 'purple' },
  'partly-cloudy': { label: 'Partly cloudy', tone: 'warm', night: 'purple' },
  cloudy: { label: 'Cloudy', tone: 'white' },
  rain: { label: 'Rain', tone: 'blue' },
  storm: { label: 'Storm', tone: 'purple' },
  snow: { label: 'Snow', tone: 'white' },
  fog: { label: 'Fog', tone: 'white' },
};
export const UNITS = ['C', 'F'];
export const PLACE_LENGTH = 18; // characters

const ICON = { x: -60, y: 6 };
// The text column, right of the sky; the temperature shrinks to fit it.
const LEFT = -8;
const RIGHT = 150;

function sun(ctx, x, y, r, t) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU + t * 0.25;
    const pulse = 3 * Math.sin(t * 2 + i);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * (r + 9), y + Math.sin(angle) * (r + 9));
    ctx.lineTo(x + Math.cos(angle) * (r + 18 + pulse), y + Math.sin(angle) * (r + 18 + pulse));
    ctx.stroke();
  }
}

function moon(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.clip();
  ctx.shadowBlur = 0;
  ctx.fillStyle = rgba(BACKGROUND);
  ctx.beginPath();
  ctx.arc(x + 0.5 * r, y - 0.3 * r, 0.85 * r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function cloudPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x - 0.9 * s, y + 0.15 * s, 0.55 * s, 0, TAU);
  ctx.moveTo(x + 0.55 * s, y - 0.25 * s);
  ctx.arc(x - 0.2 * s, y - 0.25 * s, 0.75 * s, 0, TAU);
  ctx.moveTo(x + 1.25 * s, y + 0.05 * s);
  ctx.arc(x + 0.65 * s, y + 0.05 * s, 0.6 * s, 0, TAU);
  ctx.roundRect(x - 1.4 * s, y + 0.05 * s, 2.65 * s, 0.65 * s, 0.32 * s);
}

// A cloud, cut out from what is behind it by a thin gap.
function cloud(ctx, x, y, s, shade = 1) {
  ctx.save();
  ctx.globalAlpha *= shade;
  cloudPath(ctx, x, y, s);
  cutOut(ctx, 3.5);
  ctx.restore();
}

function rain(ctx, x, y, t, count, speed) {
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const p = (t * speed + i * 0.37) % 1;
    const dx = x - 34 + (i * 68) / (count - 1);
    ctx.save();
    ctx.globalAlpha *= Math.sin(Math.PI * p);
    ctx.beginPath();
    ctx.moveTo(dx - 4 * p, y + 34 * p);
    ctx.lineTo(dx - 4 * p - 3, y + 34 * p + 10);
    ctx.stroke();
    ctx.restore();
  }
}

function snow(ctx, x, y, t) {
  for (let i = 0; i < 6; i++) {
    const p = (t * 0.35 + i * 0.29) % 1;
    const dx = x - 34 + i * 13.6 + 5 * Math.sin(TAU * (p + i * 0.2));
    ctx.save();
    ctx.globalAlpha *= Math.sin(Math.PI * p);
    ctx.beginPath();
    ctx.arc(dx, y + 38 * p, 3.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function bolt(ctx, x, y, t) {
  const flash = (t % 2.6) < 0.18 ? 1 : 0.15;
  ctx.save();
  ctx.globalAlpha *= flash;
  ctx.beginPath();
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x - 8, y + 22);
  ctx.lineTo(x + 1, y + 22);
  ctx.lineTo(x - 5, y + 40);
  ctx.lineTo(x + 12, y + 15);
  ctx.lineTo(x + 3, y + 15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function fog(ctx, x, y, t) {
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const shift = 9 * Math.sin(t * 0.8 + i * 1.3);
    const width = i % 2 ? 62 : 78;
    ctx.save();
    ctx.globalAlpha *= 0.55 + 0.15 * i;
    ctx.beginPath();
    ctx.moveTo(x - width / 2 + shift, y - 27 + i * 18);
    ctx.lineTo(x + width / 2 + shift, y - 27 + i * 18);
    ctx.stroke();
    ctx.restore();
  }
}

function sky(ctx, condition, night, t) {
  const { x, y } = ICON;
  const drift = 3 * Math.sin(t * 0.6);
  const star = night ? () => moon(ctx, x - 14, y - 18, 24) : () => sun(ctx, x - 14, y - 18, 20, t);
  switch (condition) {
    case 'clear':
      if (night) moon(ctx, x, y, 34);
      else sun(ctx, x, y, 28, t);
      break;
    case 'partly-cloudy':
      star();
      cloud(ctx, x + 10 + drift, y + 14, 26);
      break;
    case 'rain':
      cloud(ctx, x + drift, y - 12, 28);
      rain(ctx, x, y + 18, t, 6, 1.4);
      break;
    case 'storm':
      cloud(ctx, x + drift, y - 12, 28, 0.75);
      rain(ctx, x, y + 18, t, 5, 1.8);
      bolt(ctx, x + 2, y + 6, t);
      break;
    case 'snow':
      cloud(ctx, x + drift, y - 12, 28);
      snow(ctx, x, y + 18, t);
      break;
    case 'fog':
      fog(ctx, x, y, t);
      break;
    default:
      cloud(ctx, x + drift, y, 30);
  }
}

const conditionOf = (data) => (Object.hasOwn(CONDITIONS, data.condition) ? data.condition : 'cloudy');
const nightOf = (data) => data.night === true;

export default {
  tone: (data) => {
    const condition = CONDITIONS[conditionOf(data)];
    return nightOf(data) && condition.night ? condition.night : condition.tone;
  },
  slot: CORNER,
  example: { condition: 'partly-cloudy', temperature: 24, unit: 'C', place: 'Home' },

  draw(ctx, t, { alpha, data }) {
    const condition = conditionOf(data);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, 14 * (1 - alpha));
    sky(ctx, condition, nightOf(data), t);
    ctx.restore();

    // The temperature, then its unit, at the largest size up to 56 that fits the column.
    const rise = 10 * (1 - alpha);
    const unit = UNITS.includes(data.unit) ? data.unit : UNITS[0];
    const degrees = Number.isFinite(data.temperature) ? String(Math.round(clamp(data.temperature, -99, 199))) : '--';
    ctx.font = font(22);
    const room = RIGHT - LEFT - ctx.measureText(`°${unit}`).width - 2;
    ctx.font = font(56);
    const size = Math.min(56, (56 * room) / ctx.measureText(degrees).width);
    ctx.globalAlpha = alpha;
    const width = text(ctx, degrees, LEFT, 6 + rise, size, { align: 'left' });
    text(ctx, `°${unit}`, LEFT + width + 2, -6 + rise, 22, { align: 'left' });
    ctx.globalAlpha = alpha * 0.7;
    text(ctx, CONDITIONS[condition].label, LEFT + 2, 44 + rise, 15, { weight: 500, align: 'left' });
    if (typeof data.place === 'string' && data.place) {
      ctx.globalAlpha = alpha * 0.55;
      text(ctx, clip(data.place, PLACE_LENGTH), LEFT + 2, -32 + rise, 13, { weight: 500, align: 'left' });
    }
  },
};
