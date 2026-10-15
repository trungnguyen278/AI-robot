// SPDX-License-Identifier: MIT
/* Tests of the renderer (how to run them: ui/README.md).

   They check the expressions against the screen protocol's vocabulary, draw every
   expression on every screen profile, and check the animator: same calls give the
   same frames, transitions never jump, and protocol messages land where they should.
   The page also shows every expression, for a look. The verdict goes to #result as
   data-status="pass" or data-status="fail", with one line per failure.
*/

import { Animator, TRANSITION } from '../src/animator.js';
import { drawFrame } from '../src/draw.js';
import { EFFECTS } from '../src/effects.js';
import { DEFAULT_EXPRESSION, EXPRESSIONS } from '../src/expressions.js';
import { PROFILES, fit } from '../src/layout.js';
import { PROTOCOL, apply } from '../src/link.js';
import { MOTIONS } from '../src/motions.js';
import { EYE, FACE } from '../src/pose.js';
import { TONES } from '../src/tones.js';

const VOCABULARY = '../../protocol/screen/vocabulary.json';
const MOMENTS = [0, 0.37, 1.9, 4.4];
const LIFE_KEYS = ['blink', 'glance', 'breathe', 'voice'];

const failures = [];
const fail = (where, message) => failures.push(`${where}: ${message}`);
const check = (ok, where, message) => {
  if (!ok) fail(where, message);
};

// An animator without blinks or glances, so that frames are easy to compare.
function still(expression, seed = 3) {
  const animator = new Animator({ expression, seed });
  animator.enabled = { blink: false, glance: false, breathe: false };
  return animator;
}

async function checkVocabulary() {
  const vocabulary = await (await fetch(VOCABULARY)).json();
  check(vocabulary.protocol === PROTOCOL, 'protocol',
    `vocabulary.json is version ${vocabulary.protocol}, link.js speaks ${PROTOCOL}`);
  for (const name of Object.keys(vocabulary.expressions)) {
    check(Object.hasOwn(EXPRESSIONS, name), name, 'required by the protocol, missing from expressions.js');
  }
  check(Object.keys(TONES).join() === vocabulary.tones.join(), 'tones',
    `tones.js has ${Object.keys(TONES).join(', ')}; the protocol lists ${vocabulary.tones.join(', ')}`);
}

function checkExpressions() {
  check(Object.hasOwn(EXPRESSIONS, DEFAULT_EXPRESSION), DEFAULT_EXPRESSION, 'the default expression is missing');
  for (const [name, spec] of Object.entries(EXPRESSIONS)) {
    check(Boolean(TONES[spec.tone]), name, `unknown tone ${spec.tone}`);
    for (const [part, model] of [['face', FACE], ['eyes', EYE], ['left', EYE], ['right', EYE]]) {
      for (const [key, value] of Object.entries(spec[part] ?? {})) {
        check(Object.hasOwn(model, key), name, `${part}.${key} is not part of the face model`);
        check(Number.isFinite(value), name, `${part}.${key} is not a number`);
      }
    }
    if (spec.motion) {
      const type = typeof spec.motion === 'string' ? spec.motion : spec.motion.type;
      check(Boolean(MOTIONS[type]), name, `unknown motion ${type}`);
    }
    if (spec.effect) check(Boolean(EFFECTS[spec.effect]), name, `unknown effect ${spec.effect}`);
    for (const key of Object.keys(spec.life ?? {})) check(LIFE_KEYS.includes(key), name, `unknown life layer ${key}`);
    if (spec.life?.voice) check(['listen', 'talk'].includes(spec.life.voice), name, `unknown voice reaction ${spec.life.voice}`);
  }
}

function litPixels(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height);
  let lit = 0;
  for (let i = 0; i < data.length; i += 4) if (Math.max(data[i], data[i + 1], data[i + 2]) > 80) lit += 1;
  return lit;
}

function checkDrawing() {
  for (const profile of PROFILES) {
    const { width, height, shape } = profile;
    const layout = fit(width, height, shape);
    const ctx = new OffscreenCanvas(width, height).getContext('2d');
    for (const name of Object.keys(EXPRESSIONS)) {
      const animator = still(name);
      for (const t of MOMENTS) {
        try {
          drawFrame(ctx, layout, animator.frame(t), { status: { battery: 12, charging: true } });
        } catch (error) {
          fail(`${name} on ${profile.id} at ${t} s`, error.message);
        }
      }
      check(litPixels(ctx, width, height) > width * height * 0.01, `${name} on ${profile.id}`, 'almost nothing drawn');
    }
  }
}

function checkAnimator() {
  // The same calls give the same frames, glances and blinks included.
  const a = new Animator({ seed: 11 });
  const b = new Animator({ seed: 11 });
  for (let i = 0; i <= 600; i++) {
    const t = i / 60;
    if (i === 120) { a.set('happy', null, t); b.set('happy', null, t); }
    if (i === 300) { a.look({ x: 0.5, y: -0.3 }); b.look({ x: 0.5, y: -0.3 }); }
    if (JSON.stringify(a.frame(t)) !== JSON.stringify(b.frame(t))) {
      fail('animator', `two animators with the same seed differ at ${t.toFixed(2)} s`);
      break;
    }
  }

  // Transitions start where the face is and never jump, even when interrupted.
  const names = Object.keys(EXPRESSIONS);
  const animator = still(DEFAULT_EXPRESSION);
  let previous = animator.frame(0).pose;
  let worst = { jump: 0, at: '' };
  for (let i = 1; i <= 1200; i++) {
    const t = i / 120;
    if (i % 19 === 0) animator.set(names[(i / 19) % names.length], null, t); // faster than TRANSITION
    const { pose } = animator.frame(t);
    for (const part of ['face', 'left', 'right']) {
      for (const key of Object.keys(pose[part])) {
        const jump = Math.abs(pose[part][key] - previous[part][key]);
        if (jump > worst.jump) worst = { jump, at: `${part}.${key} at ${t.toFixed(3)} s` };
      }
    }
    previous = pose;
  }
  // 1/120 s steps: no number may move by more than this in one step.
  check(worst.jump < 6, 'transitions', `jump of ${worst.jump.toFixed(2)} in ${worst.at}`);

  // Once a transition is over, only the new expression is left.
  const settled = still('sad');
  settled.set('angry', null, 1);
  settled.frame(1 + TRANSITION + 0.01);
  check(settled.layers.length === 1 && settled.expression === 'angry', 'transitions', 'the old expression lingers');

  check(new Animator().set('no-such-expression') === DEFAULT_EXPRESSION, 'animator',
    'an unknown expression must show the default one');
}

function checkProtocol() {
  const player = { animator: still(DEFAULT_EXPRESSION), status: {}, now: () => 2 };
  apply({ type: 'state', face: { expression: 'sad', tone: 'red' }, status: { battery: 40, charging: true } }, player);
  const top = player.animator.layers[player.animator.layers.length - 1];
  check(top.name === 'sad' && top.tone === 'red', 'state', `shows ${top.name} in ${top.tone}`);
  check(player.status.battery === 40 && player.status.charging === true, 'state', 'status not applied');
  apply({ type: 'state', face: { expression: 42 }, status: { battery: 'full' } }, player);
  check(player.animator.expression === DEFAULT_EXPRESSION, 'state', 'a malformed expression must show the default one');
  check(player.status.battery === null, 'state', 'a malformed battery level must read as unknown');
  apply({ type: 'look', target: { x: 2, y: -0.5 } }, player);
  check(player.animator.gaze.target?.x === 1 && player.animator.gaze.target?.y === -0.5, 'look', 'target not clamped to [-1, 1]');
  apply({ type: 'look', target: null }, player);
  check(player.animator.gaze.target === null, 'look', 'null must release the gaze');
  apply({ type: 'voice', level: 0.5 }, player);
  check(player.animator.heard.target === 0.5, 'voice', 'level not applied');
  check(apply({ type: 'from-the-future' }, player) === false, 'messages', 'unknown types must be ignored');
}

// Every expression on the previous generation's 320 × 240 screen, for a look.
function showSheet() {
  const sheet = document.getElementById('sheet');
  const layout = fit(320, 240, 'rect');
  for (const name of Object.keys(EXPRESSIONS)) {
    const figure = document.createElement('figure');
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    drawFrame(canvas.getContext('2d'), layout, still(name).frame(1.2), { status: { battery: 82, charging: false } });
    const caption = document.createElement('figcaption');
    caption.textContent = name;
    figure.append(canvas, caption);
    sheet.append(figure);
  }
}

(async () => {
  let summary = '';
  try {
    await checkVocabulary();
    checkExpressions();
    checkDrawing();
    checkAnimator();
    checkProtocol();
    showSheet();
    summary = `${Object.keys(EXPRESSIONS).length} expressions · ${PROFILES.length} screens · `
      + `${MOMENTS.length} moments · protocol ${PROTOCOL}`;
  } catch (error) {
    fail('tests', error.message);
  }
  const status = failures.length ? 'fail' : 'pass';
  const result = document.getElementById('result');
  result.dataset.status = status;
  result.textContent = [`${status.toUpperCase()} · ${summary}`, ...failures].join('\n');
  document.title = `${status.toUpperCase()} · ${document.title}`;
})();
