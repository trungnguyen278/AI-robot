// SPDX-License-Identifier: MIT
/* The studio (index.html): plays the face on any screen and drives it by hand, the
   way the robot software drives it over the screen protocol. Adding `#<expression>`,
   `#<scene>` or `#<screen id>` to the address opens the studio on it. */

import { Animator } from './animator.js';
import { EXPRESSIONS } from './expressions.js';
import { PROFILES } from './layout.js';
import { EXAMPLE, PanelView } from './panel.js';
import { Player } from './player.js';
import { SCENES, sceneTone } from './scenes/index.js';
import { CONDITIONS } from './scenes/weather.js';
import { TONES, rgba } from './tones.js';

const $ = (id) => document.getElementById(id);
const CUSTOM = 'custom';

const animator = new Animator({ seed: 7 });
const player = new Player($('face'), animator);
player.status = { battery: 82, charging: false };
player.start();

// The settings over the face, at the screen's own size in pixels, scaled as the face
// is. Nothing answers their changes here, as the robot software would.
const panel = new PanelView($('panel'), {
  onClose: () => {
    $('settings').checked = false;
  },
});
const overlay = $('overlay');
let screenWidth = 1; // CSS pixels
const scaleOverlay = () => overlay.style.setProperty('--k', String($('face').clientWidth / screenWidth));
new ResizeObserver(scaleOverlay).observe($('face'));
$('settings').addEventListener('change', (event) => panel.show(event.target.checked ? EXAMPLE : null));

let tone = null; // null: each expression's own colour

// A chip named `name`, with a dot of `toneName`'s colour unless it is null.
function addChip(container, name, toneName, onClick) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.dataset.name = name;
  chip.setAttribute('aria-pressed', 'false');
  if (toneName) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = rgba(TONES[toneName].rgb);
    chip.append(dot);
  }
  chip.append(name);
  chip.addEventListener('click', onClick);
  container.append(chip);
}

function press(container, name) {
  for (const chip of container.children) chip.setAttribute('aria-pressed', String(chip.dataset.name === name));
}

// Expressions.
const chips = $('expressions');
for (const [name, spec] of Object.entries(EXPRESSIONS)) addChip(chips, name, spec.tone, () => show(name));

function show(name) {
  press(chips, animator.set(name, tone, player.now()));
}

// Scenes, with data for those that take some.
const NONE = 'none';
const sceneChips = $('scenes');
let timer = null; // { duration, ends_at } of the timer started last

addChip(sceneChips, NONE, null, () => showScene(null));
for (const [name, spec] of Object.entries(SCENES)) {
  addChip(sceneChips, name, sceneTone(spec, spec.example), () => showScene(name, { restart: true }));
}

const conditionSelect = $('weather-condition');
for (const [value, { label }] of Object.entries(CONDITIONS)) conditionSelect.append(new Option(label, value));
conditionSelect.value = SCENES.weather.example.condition;

function startTimer() {
  const duration = Math.max(6, Number($('timer-minutes').value) * 60 || 60);
  timer = { duration, ends_at: player.wallClock().getTime() / 1000 + duration };
}

function sceneData(name) {
  if (name === 'weather') {
    const temperature = $('weather-temperature').value; // '' while empty or half typed
    return {
      condition: conditionSelect.value,
      temperature: temperature === '' ? null : Number(temperature),
      unit: $('weather-unit').value,
      night: $('weather-night').checked,
      place: $('weather-place').value,
    };
  }
  if (name === 'timer') {
    if (!timer) startTimer();
    return { ...timer, label: $('timer-label').value };
  }
  return { ...SCENES[name]?.example };
}

// Show scene `name` (null: none); `restart` plays it from the start, a timer anew.
function showScene(name, { restart = false } = {}) {
  if (restart && name === 'timer') startTimer();
  const shown = animator.setScene(name, name ? sceneData(name) : {}, player.now(), { restart });
  press(sceneChips, shown ?? NONE);
  $('scene-weather').hidden = shown !== 'weather';
  $('scene-timer').hidden = shown !== 'timer';
}
press(sceneChips, NONE);

for (const id of ['weather-condition', 'weather-temperature', 'weather-unit', 'weather-night', 'weather-place']) {
  $(id).addEventListener('input', () => showScene('weather'));
}
$('timer-label').addEventListener('input', () => showScene('timer'));
$('timer-start').addEventListener('click', () => showScene('timer', { restart: true }));

// Colour.
const toneSelect = $('tone');
toneSelect.append(new Option("Expression's own", ''));
for (const name of Object.keys(TONES)) toneSelect.append(new Option(name, name));
toneSelect.addEventListener('change', () => {
  tone = toneSelect.value || null;
  show(animator.expression);
});

// Screen.
const screenSelect = $('screen');
for (const profile of PROFILES) screenSelect.append(new Option(profile.label, profile.id));
screenSelect.append(new Option('Custom size…', CUSTOM));

function setScreen(id) {
  screenSelect.value = id;
  $('custom').hidden = id !== CUSTOM;
  const profile = PROFILES.find((p) => p.id === id);
  const clampSize = (input) => Math.min(4096, Math.max(64, Number(input.value) || 64));
  const width = profile ? profile.width : clampSize($('width'));
  const height = profile ? profile.height : clampSize($('height'));
  const shape = profile ? profile.shape : 'rect';
  const device = $('device');
  device.classList.toggle('round', shape === 'round');
  device.style.setProperty('--ratio', String(width / height));
  player.setShape(shape);
  screenWidth = width;
  overlay.style.setProperty('--w', String(width));
  overlay.style.setProperty('--h', String(height));
  panel.setShape(shape);
  scaleOverlay();
}
screenSelect.addEventListener('change', () => setScreen(screenSelect.value));
for (const id of ['width', 'height']) $(id).addEventListener('change', () => setScreen(CUSTOM));

// Look.
const pad = $('pad');
const spot = $('spot');
function steer(event) {
  const box = pad.getBoundingClientRect();
  const x = Math.min(1, Math.max(-1, ((event.clientX - box.left) / box.width) * 2 - 1));
  const y = Math.min(1, Math.max(-1, ((event.clientY - box.top) / box.height) * 2 - 1));
  spot.style.left = `${(x + 1) * 50}%`;
  spot.style.top = `${(y + 1) * 50}%`;
  pad.classList.add('held');
  animator.look({ x, y });
}
pad.addEventListener('pointerdown', (event) => {
  pad.setPointerCapture(event.pointerId);
  steer(event);
});
pad.addEventListener('pointermove', (event) => {
  if (pad.hasPointerCapture(event.pointerId)) steer(event);
});
$('roam').addEventListener('click', () => {
  animator.look(null);
  pad.classList.remove('held');
  spot.style.left = '50%';
  spot.style.top = '50%';
});

// Voice: the animator treats a level it has not heard for half a second as silence,
// so the slider's level is repeated while it is above 0.
const voice = $('voice');
voice.addEventListener('input', () => {
  $('voice-value').textContent = Number(voice.value).toFixed(2);
});
setInterval(() => {
  const level = Number(voice.value);
  if (level > 0) animator.voice(level, player.now());
}, 100);

// Life, playback and status.
for (const layer of ['blink', 'glance', 'breathe']) {
  const box = $(`life-${layer}`);
  box.addEventListener('change', () => {
    animator.enabled[layer] = box.checked;
  });
}
$('blink').addEventListener('click', () => animator.blink(player.now()));
$('speed').addEventListener('change', (event) => {
  player.speed = Number(event.target.value);
});
$('status').addEventListener('change', (event) => {
  player.showStatus = event.target.checked;
});
function updateStatus() {
  const battery = Math.min(100, Math.max(0, Number($('battery').value) || 0));
  player.status = { battery, charging: $('charging').checked, low: $('low').checked, muted: $('muted').checked };
}
$('battery').addEventListener('input', updateStatus);
for (const id of ['charging', 'low', 'muted']) $(id).addEventListener('change', updateStatus);

// Readout.
const readout = $('readout');
setInterval(() => {
  const { width, height } = player.layout;
  readout.textContent = `${animator.expression}${animator.scene ? ` on ${animator.scene}` : ''} · ${tone ?? 'own colour'} · `
    + `${Math.round(width)} × ${Math.round(height)} px · ${Math.round(player.fps)} fps`;
}, 250);

// Start from the address (#happy, #clock, #round-360…), or on the 7" LCD with "neutral".
const token = location.hash.slice(1);
setScreen(PROFILES.some((p) => p.id === token) ? token : PROFILES[0].id);
show(Object.hasOwn(EXPRESSIONS, token) ? token : 'neutral');
if (Object.hasOwn(SCENES, token)) showScene(token);
