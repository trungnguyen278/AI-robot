// SPDX-License-Identifier: MIT
/* A press held still: the robot opens its settings on it (protocol/screen/README.md,
   `hold`). The page reports the tap as soon as a press begins; this tells a press that
   stays, for `seconds`, within `slop` of where it began, from one that moves or ends. */

export class Press {
  /** `onHold(x, y)` runs when a press has been held; `timers` stands in for
      setTimeout and clearTimeout, so that the tests need not wait. Positions and
      `slop` are in CSS pixels, as a pointer event's `clientX` and `clientY`. */
  constructor({
    seconds,
    slop,
    onHold,
    timers = { set: (run, ms) => setTimeout(run, ms), clear: (id) => clearTimeout(id) },
  }) {
    this.seconds = seconds;
    this.slop = slop;
    this.onHold = onHold;
    this.timers = timers;
    this.at = null; // where the press began, while it may still become a hold
    this.timer = null;
  }

  down(x, y) {
    this.up();
    this.at = { x, y };
    this.timer = this.timers.set(() => {
      const { x: heldX, y: heldY } = this.at;
      this.at = null;
      this.timer = null;
      this.onHold(heldX, heldY);
    }, this.seconds * 1000);
  }

  move(x, y) {
    if (this.at && Math.hypot(x - this.at.x, y - this.at.y) > this.slop) this.up();
  }

  up() {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
    this.at = null;
  }
}
