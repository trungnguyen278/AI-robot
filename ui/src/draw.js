// SPDX-License-Identifier: MIT
/* Draws one frame of the animator (animator.js) on a 2D canvas: the background, the
   scenes, the face with its glow and effects, and the status row (time and battery). */

import { EFFECTS } from './effects.js';
import { TAU, clamp } from './math.js';
import { EYE_SPACING } from './pose.js';
import { SCENES } from './scenes/index.js';
import { batteryPercent, boltPath, hhmm } from './scenes/kit.js';
import { font } from './text.js';
import { BACKGROUND, TONES, rgba } from './tones.js';

const GLOW = 5;          // blur of the glow, in face units
const BROW_LENGTH = 72;
const BROW_WIDTH = 10;
const MOUTH_WIDTH = 4;
const LOW_BATTERY = 15;  // percent: the battery turns red at or below it

const rad = (deg) => (deg * Math.PI) / 180;

/** Draw `frame` on `ctx` for the screen `layout` (layout.js). `status` is
    `{ battery, charging }`; `statusRow` shows it with the time along the top; `dpr`
    is the canvas's pixels per CSS pixel; `now` is the time to show. */
export function drawFrame(ctx, layout, frame, { status = {}, statusRow = true, dpr = 1, now = new Date() } = {}) {
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

  // Scenes, under the face. The blur is in device pixels: the canvas transform does
  // not scale it.
  const pixels = layout.scale * dpr;
  for (const scene of frame.scenes) {
    if (scene.alpha <= 0) continue;
    ctx.save();
    ctx.translate(layout.cx, layout.cy);
    ctx.scale(layout.scale, layout.scale);
    const ink = rgba(scene.rgb);
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.shadowColor = rgba(scene.rgb, scene.glow);
    ctx.shadowBlur = GLOW * pixels;
    SCENES[scene.name].draw(ctx, scene.t, { alpha: scene.alpha, data: scene.data, now, status, pixels });
    ctx.restore();
  }

  // The face, in its slot while a scene is on screen.
  const { face, left, right } = frame.pose;
  const { slot } = frame;
  ctx.save();
  ctx.translate(layout.cx + slot.x * layout.scale, layout.cy + slot.y * layout.scale);
  ctx.scale(layout.scale * slot.scale, layout.scale * slot.scale);
  ctx.translate(face.x, face.y);
  ctx.rotate(rad(face.tilt));
  ctx.scale(face.scale, face.scale);
  const color = rgba(frame.rgb);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.shadowColor = rgba(frame.rgb, frame.glow);
  ctx.shadowBlur = GLOW * layout.scale * Math.max(slot.scale, 0.4) * face.scale * dpr;
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

  if (statusRow) drawStatus(ctx, layout, status, frame.rgb, now, frame.clockAlpha);
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
  boltPath(ctx, cx, cy, size);
  ctx.fill();
}

// The time (faded out by `clockAlpha` while a scene shows its own) and the battery.
// Each keeps its own place, so that neither moves when the other changes.
function drawStatus(ctx, layout, status, rgb, now, clockAlpha) {
  const percent = batteryPercent(status);
  const low = percent !== null && percent <= LOW_BATTERY && !status.charging;
  const ink = rgba(rgb, 0.6);
  const warn = rgba(TONES.red.rgb, 0.85);
  const clock = (x, y) => {
    if (clockAlpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= clockAlpha;
    ctx.fillText(hhmm(now), x, y);
    ctx.restore();
  };
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;

  if (layout.shape === 'round') {
    // The time left of the centre and the battery right of it; the time alone, centred.
    const size = layout.radius * 0.085;
    const y = layout.cy - layout.radius * 0.8;
    const gap = size * 0.4;
    ctx.font = font(size, 600);
    ctx.textBaseline = 'middle';
    ctx.textAlign = percent === null ? 'center' : 'right';
    clock(percent === null ? layout.cx : layout.cx - gap, y);
    if (percent !== null) {
      ctx.textAlign = 'left';
      if (low) ctx.fillStyle = warn;
      ctx.fillText(`${percent}%`, layout.cx + gap, y);
      if (status.charging) bolt(ctx, layout.cx + gap + ctx.measureText(`${percent}%`).width + size * 0.5, y, size);
    }
    ctx.restore();
    return;
  }

  const rowH = layout.statusH;
  const size = rowH * 0.42;
  const pad = rowH * 0.5;
  const y = rowH / 2;
  ctx.font = font(size, 600);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  clock(pad, y);
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
  ctx.fillStyle = low ? warn : ink;
  ctx.beginPath();
  ctx.roundRect(bx + inset, y - bh / 2 + inset, (bw - 2 * inset) * (percent / 100), bh - 2 * inset, bh * 0.1);
  ctx.fill();
  ctx.textAlign = 'right';
  let x = bx - size * 0.45;
  if (status.charging) {
    bolt(ctx, x - size * 0.3, y, size);
    x -= size * 0.85;
  }
  ctx.fillText(`${percent}%`, x, y);
  ctx.restore();
}
