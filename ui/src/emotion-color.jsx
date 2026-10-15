// SPDX-License-Identifier: MIT
/* Emotion library — COLOR pass.
   Assigns a `tone` (key into window.EmotionCore.EYE_TONES) to every
   EMOTION category. The renderer reads `cat.tone` and applies it as a CSS
   variable on the screen, so every `var(--eye)` inside the variant SVG
   picks up the color — no per-variant changes needed.

   Scope note: scene categories now set their own `tone` inline in the
   scenes-arc-pack-* files, so this pass only tones emotions plus the two
   `status` flows (boot / network). Loaded AFTER everything that creates an
   emotion or status category, BEFORE the scene-arc packs + app.jsx.
*/

const cats = window.EMOTION_CATEGORIES;
const TONES = window.EmotionCore.EYE_TONES;

// emotion tones — chosen for emotional temperature, not literal color
const EMOTION_TONE = {
  // calm / neutral / robotic states stay cyan
  normal:       'cyan',
  greet:        'cyan',
  bored:        'cyan',
  cool:         'cyan',
  listening:    'cyan',
  thinking:     'cyan',
  loading:      'cyan',
  mute:         'cyan',

  // warm + positive
  happy:        'warm',
  wink:         'warm',
  smug:         'warm',
  proud:        'warm',
  excited:      'warm',

  // pink / affection
  love:         'rose',
  shy:          'rose',
  embarrassed:  'rose',

  // red / hot states
  angry:        'red',
  focused:      'red',
  determined:   'red',
  error:        'red',
  dead:         'red',

  // sad / cold blue
  sad:          'blue',
  crying:       'blue',

  // sick / disgusted / power-up green
  disgusted:    'green',
  charging:     'green',

  // sleepy / dreamy / mischievous purple
  sleepy:       'purple',
  sleeping:     'purple',
  mischievous:  'purple',
  dizzy:        'purple',
  suspicious:   'purple',

  // orange — appetite, curiosity, mild irritation
  hungry:       'orange',
  curious:      'orange',
  confused:     'orange',
  annoyed:      'orange',
  nervous:      'orange',

  // bright pop — shock
  surprised:    'white',
  scared:       'white',
};

// status-flow tones. boot/network are the only non-emotion categories
// toned here; every `scene` category sets its own tone in the
// scenes-arc-pack-* files.
const SCENE_TONE = {
  boot:       'red',
  network:    'cyan',
};

// per-variant tone overrides for the status flows (a single category can
// hold variants of different emotional temperature).
const SCENE_VARIANT_TONE = {
  // boot: single brand-clean flow, all cyan
  'boot-poweron':            'cyan',
  'boot-checks-personal':    'cyan',
  'boot-credits':            'cyan',
  'boot-ready-personal':     'cyan',

  // network: cyan for in-progress, red for failures, purple for Bluetooth
  'network-wifi-scan':       'cyan',
  'network-wifi-connect':    'cyan',
  'network-wifi-retry':      'orange',
  'network-offline':         'red',
  'network-bt-scan':         'purple',
  'network-bt-paired':       'purple',
  'network-server-error':    'red',
};

// apply
for (const k of Object.keys(cats)) {
  const fromEmotion = EMOTION_TONE[k];
  const fromScene = SCENE_TONE[k];
  const tone = fromEmotion || fromScene || 'cyan';
  if (TONES[tone]) cats[k].tone = tone;
  else cats[k].tone = 'cyan';

  // Per-variant tone overrides (status flows).
  if (cats[k].variants) {
    for (const v of cats[k].variants) {
      const override = SCENE_VARIANT_TONE[v.id];
      if (override) v.tone = override;
    }
  }
}

// expose canonical maps for the host
window.EMOTION_TONE = EMOTION_TONE;
window.SCENE_TONE = SCENE_TONE;
window.SCENE_VARIANT_TONE = SCENE_VARIANT_TONE;
