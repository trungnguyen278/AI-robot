// SPDX-License-Identifier: MIT
/* The animator: turns "show this expression, look there, this loud" into a pose for
   every frame, and keeps the face alive on its own, the way a robot's animation
   process does while its behaviour engine is busy:

   - transitions: a new expression blends in over SETTINGS.transition seconds while the
     previous one blends out (shape, colour, motion, effect), starting from wherever
     the face is, even in the middle of another transition;
   - life layers on top: breathing, glances around while nothing holds the gaze, the
     gaze target, the voice, and blinking;
   - scenes (scenes/): a scene fades in over SETTINGS.sceneTransition seconds while the face
     moves to the scene's slot, and back when it goes. Slots are blended by weight,
     with "no scene" as the rest, so the face stays put between two scenes that
     share a slot.

   Time is passed in (seconds) and randomness comes from a seeded generator, so the
   same calls give the same frames; the tests rely on it. How the face moves is tuned
   in settings.js.
*/

import { DEFAULT_EXPRESSION, EXPRESSIONS } from './expressions.js';
import { TAU, clamp, smooth, unsmooth } from './math.js';
import { motionDelta } from './motions.js';
import { addDelta, blendPoses, makePose } from './pose.js';
import { SCENES, sceneSlot, sceneTone } from './scenes/index.js';
import { SETTINGS } from './settings.js';
import { TONES } from './tones.js';

const { transition: TRANSITION, sceneTransition: SCENE_TRANSITION } = SETTINGS;
const { blink: BLINK, breathe: BREATHE, glance: GLANCE, gaze: GAZE, voice: VOICE } = SETTINGS;

const NO_LIFE = { blink: 0, glance: 0, breathe: 0 };
// The screen protocol's rule: a voice level older than this counts as silence
// (protocol/screen/README.md, voice).
const VOICE_HOLD = 0.5;

// Moves `value` towards `target`, `tau` being the time it takes to cover about 63 %.
const approach = (value, target, dt, tau) => target + (value - target) * Math.exp(-dt / tau);

// mulberry32: a small seeded generator.
function generator(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A speech-like loudness, used while the face talks without a voice to follow.
function babble(t) {
  if (Math.sin(TAU * 0.55 * t + 0.4) > 0.9) return 0; // a pause between phrases
  return clamp(0.5 + 0.5 * Math.sin(TAU * 4.3 * t) * Math.sin(TAU * 1.7 * t + 1.3), 0, 1);
}

export class Animator {
  constructor({ expression = DEFAULT_EXPRESSION, tone = null, seed = 1, time = 0, library = EXPRESSIONS } = {}) {
    this.library = library;
    this.random = generator(seed);
    this.time = time;
    this.layers = []; // the expressions on screen, the newest last
    this.sceneLayers = []; // the scenes on screen, the newest last
    this.held = { until: -Infinity, next: null }; // a scene that plays to its end first
    this.enabled = { blink: true, glance: true, breathe: true };
    this.gaze = { target: null, x: 0, y: 0 };
    this.glance = { x: 0, y: 0, toX: 0, toY: 0, next: time + this.between(...GLANCE.every) };
    this.blinking = { start: null, next: time + this.between(...BLINK.first), again: false };
    this.heard = { level: 0, target: 0, at: -Infinity };
    this.set(expression, tone, time, { instant: true });
  }

  between(lo, hi) {
    return lo + (hi - lo) * this.random();
  }

  /** The expression on screen, or arriving there. */
  get expression() {
    return this.layers[this.layers.length - 1].name;
  }

  /** The scene on screen, or arriving there; null for none. */
  get scene() {
    const top = this.sceneLayers[this.sceneLayers.length - 1];
    return top && top.leave === null ? top.name : null;
  }

  /** Move to the expression `name`, in `tone` (null: the expression's own colour).
      An unknown name shows the default expression. Returns the name shown. */
  set(name, tone = null, time = this.time, { instant = false } = {}) {
    const known = Object.hasOwn(this.library, name) ? name : DEFAULT_EXPRESSION;
    const spec = this.library[known];
    const toneName = tone && TONES[tone] ? tone : spec.tone;
    const top = this.layers[this.layers.length - 1];
    if (top && top.name === known && top.tone === toneName) return known;
    for (const layer of this.layers) if (layer.leave === null) layer.leave = time;
    const layer = {
      name: known,
      tone: toneName,
      spec,
      pose: makePose(spec),
      color: TONES[toneName],
      life: { ...NO_LIFE, ...spec.life },
      start: time,
      enter: instant ? -Infinity : time,
      leave: null,
    };
    if (instant) this.layers = [layer];
    else {
      this.layers.push(layer);
      if (this.random() < BLINK.onChange && this.enabled.blink) this.blink(time); // hides the change
    }
    return known;
  }

  /** Show the scene `name` with `data`, or no scene (null); an unknown name shows
      none. Returns the scene on screen.

      New data for the scene on screen updates it without starting it again, unless
      it changes the scene's colour (then the new one fades in), and a scene asked
      for again while it fades out fades back in from where it is. Options:
      `restart` plays it from the start anyway; `instant` skips the fade in; `hold`
      keeps it on screen for that many seconds, any other scene asked for meanwhile
      following when they are over. */
  setScene(name, data = {}, time = this.time, { instant = false, restart = false, hold = 0 } = {}) {
    const known = typeof name === 'string' && Object.hasOwn(SCENES, name) ? name : null;
    if (time < this.held.until) {
      this.held.next = { name: known, data };
      return this.scene;
    }
    const top = this.sceneLayers[this.sceneLayers.length - 1];
    if (top && top.name === known && !restart && sceneTone(top.spec, data) === sceneTone(top.spec, top.data)) {
      top.data = data;
      if (top.leave !== null) {
        top.enter = time - unsmooth(this.weight(top, time, SCENE_TRANSITION)) * SCENE_TRANSITION;
        top.leave = null;
      }
      return known;
    }
    for (const layer of this.sceneLayers) if (layer.leave === null) layer.leave = time;
    if (known) {
      const enter = instant ? -Infinity : time;
      this.sceneLayers.push({ name: known, spec: SCENES[known], data, start: time, enter, leave: null });
      this.held.until = hold > 0 ? time + hold : -Infinity;
    }
    return known;
  }

  /** Look at `target`, `{ x, y }` from -1 to 1 across the screen, or roam (null). */
  look(target) {
    this.gaze.target = target ? { x: clamp(target.x, -1, 1), y: clamp(target.y, -1, 1) } : null;
  }

  /** The loudness, from 0 to 1, of the voice the face reacts to. */
  voice(level, time = this.time) {
    this.heard.target = clamp(level, 0, 1);
    this.heard.at = time;
  }

  blink(time = this.time) {
    if (this.blinking.start === null) this.blinking.start = time;
  }

  weight(layer, time, span = TRANSITION) {
    const enter = smooth(clamp((time - layer.enter) / span, 0, 1));
    const leave = layer.leave === null ? 1 : 1 - smooth(clamp((time - layer.leave) / span, 0, 1));
    return enter * leave;
  }

  /** The face at `time`, in seconds; calls must not go back in time. */
  frame(time) {
    const dt = clamp(time - this.time, 0, 0.1);
    this.time = Math.max(this.time, time);
    this.layers = this.layers.filter((layer) => layer.leave === null || time - layer.leave < TRANSITION);
    const layers = this.layers.map((layer) => ({ layer, weight: this.weight(layer, time) }));
    let total = layers.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) {
      layers[layers.length - 1].weight = 1;
      total = 1;
    }

    // The expressions, blended.
    const pose = blendPoses(layers.map(({ layer, weight }) => ({ pose: layer.pose, weight })));
    const rgb = [0, 0, 0];
    let glow = 0;
    const life = { ...NO_LIFE };
    let listen = 0;
    let talk = 0;
    const effects = [];
    for (const { layer, weight } of layers) {
      const share = weight / total;
      layer.color.rgb.forEach((value, i) => { rgb[i] += value * share; });
      glow += layer.color.glow * share;
      for (const key in NO_LIFE) life[key] += layer.life[key] * share;
      if (layer.life.voice === 'listen') listen += share;
      if (layer.life.voice === 'talk') talk += share;
      addDelta(pose, motionDelta(layer.spec.motion, time - layer.start), weight);
      if (layer.spec.effect) effects.push({ name: layer.spec.effect, alpha: weight, t: time - layer.start });
    }
    if (!this.enabled.blink) life.blink = 0;
    if (!this.enabled.glance) life.glance = 0;
    if (!this.enabled.breathe) life.breathe = 0;
    const eyes = [pose.left, pose.right];

    // Breathing.
    const breath = Math.sin((TAU * time) / BREATHE.period) * life.breathe;
    pose.face.y += BREATHE.rise * breath;
    for (const eye of eyes) {
      eye.w *= 1 + BREATHE.swell * breath;
      eye.h *= 1 + BREATHE.swell * breath;
    }

    // Glances around, while nothing holds the gaze.
    const glance = this.glance;
    if (this.gaze.target) {
      glance.toX = 0;
      glance.toY = 0;
    } else if (time >= glance.next) {
      const centre = this.random() < GLANCE.centre;
      glance.toX = centre ? 0 : this.between(-GLANCE.reach.x, GLANCE.reach.x);
      glance.toY = centre ? 0 : this.between(-GLANCE.reach.y, GLANCE.reach.y);
      glance.next = time + this.between(...GLANCE.every);
    }
    glance.x = approach(glance.x, glance.toX, dt, GLANCE.speed);
    glance.y = approach(glance.y, glance.toY, dt, GLANCE.speed);
    pose.face.x += glance.x * life.glance;
    pose.face.y += glance.y * life.glance;

    // The gaze target: the face turns, the pupils lead, the nearer eye grows a little.
    const gaze = this.gaze;
    gaze.x = approach(gaze.x, gaze.target ? gaze.target.x : 0, dt, GAZE.speed);
    gaze.y = approach(gaze.y, gaze.target ? gaze.target.y : 0, dt, GAZE.speed);
    pose.face.x += GAZE.face.x * gaze.x;
    pose.face.y += GAZE.face.y * gaze.y;
    for (const eye of eyes) {
      eye.pupilX += GAZE.pupils.x * gaze.x + GLANCE.pupils * glance.x * life.glance;
      eye.pupilY += GAZE.pupils.y * gaze.y + GLANCE.pupils * glance.y * life.glance;
    }
    const nearer = GAZE.nearer * gaze.x;
    pose.left.w *= 1 - nearer;
    pose.left.h *= 1 - nearer;
    pose.right.w *= 1 + nearer;
    pose.right.h *= 1 + nearer;

    // The voice: the eyes swell while listening; the mouth moves while talking, on
    // made-up syllables when no voice level arrives.
    const heard = this.heard;
    const fresh = time - heard.at < VOICE_HOLD;
    const target = fresh ? heard.target : talk > 0 ? babble(time) : 0;
    heard.level = approach(heard.level, target, dt, target > heard.level ? VOICE.rise : VOICE.fall);
    for (const eye of eyes) {
      eye.w *= 1 + VOICE.listen * heard.level * listen;
      eye.h *= (1 + VOICE.listen * heard.level * listen) * (1 - VOICE.talk * heard.level * talk);
    }
    pose.face.mouthOpen += VOICE.mouth * heard.level * talk;

    // Blinking.
    const blinking = this.blinking;
    if (blinking.start === null && time >= blinking.next && life.blink > 0) blinking.start = time;
    let closed = 0;
    if (blinking.start !== null) {
      const since = time - blinking.start;
      if (since < BLINK.close) closed = smooth(since / BLINK.close);
      else if (since < BLINK.close + BLINK.open) closed = 1 - smooth((since - BLINK.close) / BLINK.open);
      else {
        blinking.start = null;
        if (blinking.again) {
          blinking.again = false;
          blinking.next = time + BLINK.gap;
        } else {
          blinking.again = this.random() < BLINK.twice;
          blinking.next = time + this.between(...BLINK.between) / Math.max(life.blink, BLINK.slowest);
        }
      }
    }
    for (const eye of eyes) eye.h += (BLINK.shut - eye.h) * closed;

    // Scenes, each with its colour. The face's slot is the average of the scenes'
    // slots by weight, "no scene" (the face in the middle, full size) taking the rest.
    if (this.held.next && time >= this.held.until) {
      const { name, data } = this.held.next;
      this.held.next = null;
      this.setScene(name, data, time);
    }
    this.sceneLayers = this.sceneLayers.filter(
      (layer) => layer.leave === null || time - layer.leave < SCENE_TRANSITION,
    );
    const sum = { x: 0, y: 0, scale: 0 };
    let shown = 0;
    let hidesClock = 0;
    const scenes = [];
    for (const layer of this.sceneLayers) {
      const weight = this.weight(layer, time, SCENE_TRANSITION);
      const since = time - layer.start;
      const target = sceneSlot(layer.spec, since);
      for (const key of ['x', 'y', 'scale']) sum[key] += weight * target[key];
      shown += weight;
      const tone = TONES[sceneTone(layer.spec, layer.data)];
      scenes.push({ name: layer.name, data: layer.data, alpha: weight, t: since, rgb: tone.rgb, glow: tone.glow });
      if (layer.spec.clock === false) hidesClock = Math.max(hidesClock, weight);
    }
    const rest = Math.max(0, 1 - shown);
    const slot = {
      x: sum.x / (shown + rest),
      y: sum.y / (shown + rest),
      scale: (sum.scale + rest) / (shown + rest),
    };

    const top = this.layers[this.layers.length - 1];
    return {
      pose, rgb, glow, effects, voice: heard.level, expression: top.name, tone: top.tone,
      scenes, slot, clockAlpha: 1 - hidesClock,
    };
  }
}
