// SPDX-License-Identifier: MIT
/* Player: plays an animator (animator.js) on a canvas. It sizes the canvas to its box
   and to the screen's pixel density, and draws a frame on every display refresh. Its
   clock, in seconds, is the animator's time; `speed` slows it down to study a
   transition. The time it shows is the software's (`offset`, set by link.js). */

import { drawFrame } from './draw.js';
import { fit } from './layout.js';

export class Player {
  constructor(canvas, animator, { shape = 'rect', status = true } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.animator = animator;
    this.shape = shape;
    this.showStatus = status;
    this.status = { battery: null, charging: null };
    this.speed = 1;
    this.offset = 0; // seconds the software's clock is ahead of this page's
    this.fps = 0;
    this.clock = 0;
    this.last = null;
    this.running = false;
    this.tick = this.tick.bind(this);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }

  /** The animator's present time, in seconds. */
  now() {
    return this.clock;
  }

  /** The time of day, on the software's clock. */
  wallClock() {
    return new Date(Date.now() + this.offset * 1000);
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.dpr = window.devicePixelRatio || 1;
    this.layout = fit(width, height, this.shape);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    if (!this.running) this.draw();
  }

  setShape(shape) {
    this.shape = shape;
    this.resize();
  }

  draw() {
    const frame = this.animator.frame(this.clock);
    drawFrame(this.ctx, this.layout, frame, {
      status: this.status,
      statusRow: this.showStatus,
      dpr: this.dpr,
      now: this.wallClock(),
    });
    return frame;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = null;
    requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
  }

  tick(ms) {
    if (!this.running) return;
    if (this.last !== null) {
      const dt = Math.min(0.1, (ms - this.last) / 1000);
      this.clock += dt * this.speed;
      if (dt > 0) this.fps = this.fps ? 0.95 * this.fps + 0.05 / dt : 1 / dt;
    }
    this.last = ms;
    this.draw();
    requestAnimationFrame(this.tick);
  }
}
