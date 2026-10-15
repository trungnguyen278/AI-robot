// SPDX-License-Identifier: MIT
/* The face model: two eyes with lids, pupils and brows, and a small mouth, all
   described by numbers (the procedural face of Anki's Cozmo and Vector works the same
   way). An expression is a set of these numbers, so any expression blends into any
   other.

   Lengths are face units: the face is designed on a 320 × 220 area, the previous
   generation's screen below its status row, and layout.js scales it to the screen.
   Angles are in degrees. "Inner" is the side of an eye that faces the other eye.
*/

export const FACE_W = 320;
export const FACE_H = 220;
export const EYE_SPACING = 150; // between the centres of the two eyes

export const FACE = Object.freeze({
  x: 0,           // offset of the whole face
  y: 0,
  tilt: 0,        // rotation of the whole face, clockwise
  scale: 1,
  mouth: 0,       // opacity of the mouth (0: no mouth)
  mouthY: 78,     // its height below the eyes' centre line
  mouthW: 36,     // its width
  mouthCurve: 0,  // > 0 bends it into a smile, < 0 into a frown
  mouthOpen: 0,   // 0: a line, 1: a round "O"
});

export const EYE = Object.freeze({
  x: 0,              // offset from the eye's resting place
  y: 0,
  w: 88,             // width
  h: 96,             // height
  r: 22,             // corner radius
  rot: 0,            // rotation; > 0 raises the inner side
  lidTop: 0,         // share of the eye hidden by the top lid, from 0 to 1
  lidTopAngle: 0,    // > 0 lowers the lid's inner end (angry), < 0 its outer end (sad)
  lidBottom: 0,      // share hidden by the bottom lid
  lidBottomBend: 0,  // 0: a straight bottom lid; 1: arched up into a smiling eye
  pupil: 0,          // radius of a dark pupil (0: none)
  pupilX: 0,         // its offset from the eye's centre
  pupilY: 0,
  brow: 0,           // opacity of the brow above the eye (0: no brow)
  browY: -62,        // the brow's height above the eye's centre
  browAngle: 0,      // > 0 lowers the brow's inner end
  alpha: 1,          // opacity of the eye
});

/** A pose from an expression's overrides: `face`, `eyes` (both), then `left`, `right`. */
export function makePose({ face, eyes, left, right } = {}) {
  return {
    face: { ...FACE, ...face },
    left: { ...EYE, ...eyes, ...left },
    right: { ...EYE, ...eyes, ...right },
  };
}

export function copyPose(pose) {
  return { face: { ...pose.face }, left: { ...pose.left }, right: { ...pose.right } };
}

/** The weighted average of poses: `entries` is a list of `{ pose, weight }`. */
export function blendPoses(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (entries.length === 1 || total <= 0) return copyPose(entries[entries.length - 1].pose);
  const out = makePose();
  for (const part of ['face', 'left', 'right']) {
    for (const key of Object.keys(out[part])) {
      let value = 0;
      for (const { pose, weight } of entries) value += pose[part][key] * weight;
      out[part][key] = value / total;
    }
  }
  return out;
}

/** Add `delta` (`face`, `eyes`, `left`, `right`, each optional) to `pose`, in place. */
export function addDelta(pose, delta, weight = 1) {
  if (!delta || weight === 0) return pose;
  const add = (target, values) => {
    if (!values) return;
    for (const key in values) target[key] += values[key] * weight;
  };
  add(pose.face, delta.face);
  add(pose.left, delta.eyes);
  add(pose.right, delta.eyes);
  add(pose.left, delta.left);
  add(pose.right, delta.right);
  return pose;
}
