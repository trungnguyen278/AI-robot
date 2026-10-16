// SPDX-License-Identifier: MIT
/* Motions: the movement that gives an expression its character (a happy bounce, an
   angry tremble). Each one is a function of the seconds since the expression started
   and returns a change to add to the pose (pose.js), so that the animator can fade
   one motion out while the next fades in.
*/

import { TAU, ease } from './math.js';

export const MOTIONS = {
  // Hops up and down, squashing on each landing.
  bounce: (t, { period = 0.6, height = 8 } = {}) => {
    const phase = t / period;
    const stretch = Math.cos(TAU * phase);
    return {
      face: { y: -height * Math.abs(Math.sin(Math.PI * phase)) },
      eyes: { h: -4 * stretch, w: 3 * stretch },
    };
  },

  // Rocks gently from side to side.
  sway: (t, { period = 3.2, amp = 4 } = {}) => {
    const s = Math.sin((TAU * t) / period);
    return { face: { x: amp * s, tilt: 0.75 * amp * s } };
  },

  // Trembles; faster and wider when frightened.
  shake: (t, { freq = 2.2, amp = 0.8 } = {}) => ({
    face: {
      x: amp * Math.sin(TAU * freq * t),
      y: 0.4 * amp * Math.sin(TAU * freq * 1.7 * t + 1),
    },
  }),

  // Sinks a little, lids heavy.
  droop: (t, { period = 6.4 } = {}) => {
    const s = Math.sin((TAU * t) / period);
    return { face: { y: 2 * s }, eyes: { lidTop: 0.03 * (1 + s) } };
  },

  // Looks up to one side and the other, as if recalling something.
  ponder: (t, { period = 5.6 } = {}) => {
    const s = Math.sin((TAU * t) / period);
    return { face: { x: 2 * s }, eyes: { pupilX: 6 * s } };
  },

  // Floats slowly while the lids fall and rise.
  drift: (t, { period = 5 } = {}) => {
    const s = Math.sin((TAU * t) / period);
    return { face: { y: 3 * s }, eyes: { lidTop: 0.05 * (1 + s) } };
  },

  // Tilts back and forth, unsure.
  wobble: (t, { period = 3.6 } = {}) => {
    const s = Math.sin((TAU * t) / period);
    return { face: { tilt: 5 * s, x: 2 * s } };
  },

  // The pupils breathe.
  pulse: (t, { period = 1 } = {}) => ({ eyes: { pupil: 1.5 * Math.sin((TAU * t) / period) } }),

  // Swells with each heartbeat.
  beat: (t, { period = 1.1 } = {}) => {
    const b = Math.max(0, Math.sin((TAU * t) / period)) ** 6;
    return { eyes: { w: 6 * b, h: 6 * b } };
  },

  // Pops wide open, then settles.
  pop: (t) => {
    const grow = t < 0.12 ? ease.out(t / 0.12) : Math.max(0, 1 - (t - 0.12) / 0.5);
    return { eyes: { w: 14 * grow, h: 14 * grow } };
  },
};

/** The change `motion` (a name, or `{ type, ...settings }`) makes `t` seconds in. */
export function motionDelta(motion, t) {
  if (!motion) return null;
  const { type, ...settings } = typeof motion === 'string' ? { type: motion } : motion;
  const fn = MOTIONS[type];
  return fn ? fn(t, settings) : null;
}
