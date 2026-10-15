// SPDX-License-Identifier: MIT
/* Screens: fits the face to a screen of any size and shape.

   A rectangular screen keeps a status row along its top, a twelfth of its height, and
   the face fills the rest at the largest scale that keeps its proportions (on the
   previous generation's 320 × 240 screen, exactly its design size). A round screen
   centres the face on the disc, at its design size on a 360 px disc, and draws inside
   the disc only.

   The profiles are the screens the studio previews; the robot's own page takes the
   size of the window it runs in.
*/

import { FACE_H, FACE_W } from './pose.js';

export const ROUND_DESIGN = 360;

export const PROFILES = [
  { id: 'lcd-1024x600', label: '7" LCD · 1024 × 600', shape: 'rect', width: 1024, height: 600 },
  { id: 'tft-320x240', label: '2" TFT · 320 × 240', shape: 'rect', width: 320, height: 240 },
  { id: 'round-240', label: 'Round · 240', shape: 'round', width: 240, height: 240 },
  { id: 'round-360', label: 'Round · 360', shape: 'round', width: 360, height: 360 },
  { id: 'round-466', label: 'Round · 466', shape: 'round', width: 466, height: 466 },
];

/** Where the face goes on a `width` × `height` screen (CSS pixels) of `shape`. */
export function fit(width, height, shape = 'rect') {
  if (shape === 'round') {
    const diameter = Math.min(width, height);
    return {
      shape, width, height,
      scale: diameter / ROUND_DESIGN,
      cx: width / 2,
      cy: height / 2,
      radius: diameter / 2,
    };
  }
  const statusH = height / 12;
  return {
    shape, width, height,
    scale: Math.min(width / FACE_W, (height - statusH) / FACE_H),
    cx: width / 2,
    cy: statusH + (height - statusH) / 2,
    statusH,
  };
}
