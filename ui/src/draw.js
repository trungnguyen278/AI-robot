// SPDX-License-Identifier: MIT
/* Draws one frame of the animator (animator.js) on a 2D canvas: the background, the
   face with its glow, the effects, and the status row (time and battery). */

import { EFFECTS } from './effects.js';
import { EYE_SPACING } from './pose.js';
import { BACKGROUND, TONES, rgba } from './tones.js';

const GLOW = 5;          // blur of the glow, in face units
const BROW_LENGTH = 72;
const BROW_WIDTH = 10;
const MOUTH_WIDTH = 4;
const LOW_BATTERY = 15;  // percent: the battery turns red at or below it

const TAU = Math.PI * 2;
const rad = (deg) => (deg * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Draw `frame` on `ctx` for the screen `layout` (layout.js). `status`, if given,
    shows the time and `{ battery, charging }`; `dpr` is the canvas's pixels per CSS
    pixel. */
export function drawFrame(ctx, layout, frame, { status = null, dpr = 1, now = new Date() } = {}) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.fillStyle = rgba(BACKGROUND);
  ctx.fillRect(0, 0, layout.width, layout.height);

  ctx.save();
  if (layout.shape === 'round') {
    ctx.beginPath();
    ctx.arc(layout.cx, layout.cy, layout.radius, 0, TAU);
    ctx.clip();
  }

  const { face, left, right } = frame.pose;
  ctx.save();
  ctx.translate(layout.cx, layout.cy);
  ctx.scale(layout.scale, layout.scale);
  ctx.translate(face.x, face.y);
  ctx.rotate(rad(face.tilt));
  ctx.scale(face.scale, face.scale);
  const color = rgba(frame.rgb);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  // The blur is in device pixels: the canvas transform does not scale it.
  ctx.shadowColor = rgba(frame.rgb, frame.glow);
  ctx.shadowBlur = GLOW * layout.scale * face.scale * dpr;
  drawEye(ctx, left, -EYE_SPACING / 2, 1);
  drawEye(ctx, right, EYE_SPACING / 2, -1);
  drawMouth(ctx, face);
  for (const effect of frame.effects) {
    const draw = EFFECTS[effect.name];
    if (!draw || effect.alpha <= 0) continue;
    ctx.save();
    draw(ctx, effect.t, { alpha: effect.alpha, voice: frame.voice });
    ctx.restore();
  }
  ctx.restore();

  if (status) drawStatus(ctx, layout, status, frame.rgb, now);
  ctx.restore();
}

// `side` is 1 for the left eye and -1 for the right one, whose inner side is on the left.
function drawEye(ctx, eye, x0, side) {
  if (eye.alpha <= 0) return;
  const w = Math.max(eye.w, 1);
  const h = Math.max(eye.h, 1);
  const reach = 2 * (w + h); // far enough to cover the eye and its glow
  ctx.save();
  ctx.globalAlpha *= clamp(eye.alpha, 0, 1);
  ctx.translate(x0 + eye.x, eye.y);

  ctx.save();
  ctx.rotate(-side * rad(eye.rot));
  if (eye.lidTop > 0 || eye.lidTopAngle !== 0) {
    // Keep what lies below the top lid's edge.
    const y = -h / 2 + clamp(eye.lidTop, 0, 1) * h;
    const k = Math.tan(rad(clamp(eye.lidTopAngle, -60, 60))) * side;
    ctx.beginPath();
    ctx.moveTo(-reach, y - k * reach);
    ctx.lineTo(reach, y + k * reach);
    ctx.lineTo(reach, 4 * reach);
    ctx.lineTo(-reach, 4 * reach);
    ctx.clip();
  }
  if (eye.lidBottom > 0 || eye.lidBottomBend > 0) {
    // Keep what lies above the bottom lid's edge, arched up by the bend.
    const y = h / 2 - clamp(eye.lidBottom, 0, 1) * h;
    const rise = clamp(eye.lidBottomBend, 0, 1) * h * 0.5;
    ctx.beginPath();
    ctx.moveTo(-reach, -4 * reach);
    ctx.lineTo(reach, -4 * reach);
    ctx.lineTo(reach, y);
    ctx.lineTo(w / 2, y);
    ctx.quadraticCurveTo(0, y - 2 * rise, -w / 2, y);
    ctx.lineTo(-reach, y);
    ctx.clip();
  }
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, clamp(eye.r, 0, Math.min(w, h) / 2));
  ctx.fill();
  if (eye.pupil > 0.5) {
    ctx.clip(); // the pupil stays inside the eye
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(BACKGROUND);
    ctx.beginPath();
    ctx.arc(eye.pupilX, eye.pupilY, eye.pupil, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  if (eye.brow > 0) {
    ctx.globalAlpha *= clamp(eye.brow, 0, 1);
    ctx.translate(0, eye.browY);
    ctx.rotate(side * rad(eye.browAngle));
    ctx.lineWidth = BROW_WIDTH;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-BROW_LENGTH / 2, 0);
    ctx.lineTo(BROW_LENGTH / 2, 0);
    ctx.stroke();
  }
  ctx.restore();
}

// Two curves between the mouth's corners: one line when closed, an "O" when open.
function drawMouth(ctx, face) {
  if (face.mouth <= 0.01) return;
  const open = clamp(face.mouthOpen, 0, 1.5);
  const width = face.mouthW + (16 - face.mouthW) * Math.min(open, 1);
  const curve = 2 * face.mouthCurve;
  const gap = 14 * open;
  ctx.save();
  ctx.globalAlpha *= clamp(face.mouth, 0, 1);
  ctx.translate(0, face.mouthY);
  ctx.lineWidth = MOUTH_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-width / 2, 0);
  ctx.quadraticCurveTo(0, curve - gap, width / 2, 0);
  ctx.quadraticCurveTo(0, curve + gap, -width / 2, 0);
  ctx.stroke();
  ctx.restore();
}

function bolt(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.moveTo(cx + 0.15 * size, cy - 0.5 * size);
  ctx.lineTo(cx - 0.3 * size, cy + 0.08 * size);
  ctx.lineTo(cx, cy + 0.08 * size);
  ctx.lineTo(cx - 0.15 * size, cy + 0.5 * size);
  ctx.lineTo(cx + 0.3 * size, cy - 0.08 * size);
  ctx.lineTo(cx, cy - 0.08 * size);
  ctx.closePath();
  ctx.fill();
}

function drawStatus(ctx, layout, { battery = null, charging = null }, rgb, now) {
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const percent = Number.isFinite(battery) ? Math.round(clamp(battery, 0, 100)) : null;
  const low = percent !== null && percent <= LOW_BATTERY && !charging;
  const ink = rgba(rgb, 0.6);
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.textBaseline = 'middle';

  if (layout.shape === 'round') {
    const size = layout.radius * 0.085;
    const y = layout.cy - layout.radius * 0.8;
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const label = percent === null ? clock : `${clock} · ${percent}%`;
    if (low) ctx.fillStyle = rgba(TONES.red.rgb, 0.85);
    ctx.fillText(label, layout.cx, y);
    if (charging) bolt(ctx, layout.cx + ctx.measureText(label).width / 2 + size * 0.6, y, size);
    ctx.restore();
    return;
  }

  const rowH = layout.statusH;
  const size = rowH * 0.42;
  const pad = rowH * 0.5;
  const y = rowH / 2;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(clock, pad, y);
  if (percent === null) {
    ctx.restore();
    return;
  }
  // Battery: an outline, a terminal, a level, then the percentage to its left.
  const line = Math.max(1, size * 0.12);
  const bw = size * 2;
  const bh = size * 1.05;
  const bx = layout.width - pad - bw - 2 * line;
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.roundRect(bx, y - bh / 2, bw, bh, bh * 0.22);
  ctx.stroke();
  ctx.fillRect(bx + bw + line, y - bh * 0.22, 1.6 * line, bh * 0.44);
  const inset = 1.8 * line;
  ctx.fillStyle = low ? rgba(TONES.red.rgb, 0.85) : ink;
  ctx.beginPath();
  ctx.roundRect(bx + inset, y - bh / 2 + inset, (bw - 2 * inset) * (percent / 100), bh - 2 * inset, bh * 0.1);
  ctx.fill();
  ctx.fillStyle = low ? rgba(TONES.red.rgb, 0.85) : ink;
  ctx.textAlign = 'right';
  let x = bx - size * 0.45;
  if (charging) {
    bolt(ctx, x - size * 0.3, y, size);
    x -= size * 0.85;
  }
  ctx.fillText(`${percent}%`, x, y);
  ctx.restore();
}
