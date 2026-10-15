// SPDX-License-Identifier: MIT
/* The colour palette, kept from the previous generation's design: one bright colour
   on near-black, chosen by each expression (protocol/screen/vocabulary.json lists the
   names). Colours are RGB triples so that the animator can blend them.
*/

export const BACKGROUND = Object.freeze([6, 9, 13]);

export const TONES = Object.freeze({
  cyan:   { rgb: [91, 233, 255], glow: 0.55 },   // calm, neutral (the default)
  warm:   { rgb: [255, 209, 102], glow: 0.55 },  // happy, proud
  rose:   { rgb: [255, 107, 157], glow: 0.55 },  // love, shy
  red:    { rgb: [255, 91, 110], glow: 0.6 },    // angry, faults
  blue:   { rgb: [118, 184, 255], glow: 0.55 },  // sad
  green:  { rgb: [123, 232, 142], glow: 0.55 },  // charging, disgusted
  purple: { rgb: [180, 140, 255], glow: 0.55 },  // sleepy, mischievous
  orange: { rgb: [255, 157, 91], glow: 0.55 },   // curious, confused
  white:  { rgb: [240, 244, 255], glow: 0.55 },  // surprised, scared
});

export function rgba([r, g, b], alpha = 1) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}
