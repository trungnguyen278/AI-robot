// SPDX-License-Identifier: MIT
/* Small maths shared by the renderer. */

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Eases in and out between 0 and 1 (smoothstep). */
export const smooth = (x) => x * x * (3 - 2 * x);

/** The inverse of `smooth`: the x for which smooth(x) is y. */
export const unsmooth = (y) => 0.5 - Math.sin(Math.asin(1 - 2 * clamp(y, 0, 1)) / 3);

export const ease = {
  out: (x) => 1 - (1 - x) ** 3,
  // Overshoots a little before settling.
  back: (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2,
};
