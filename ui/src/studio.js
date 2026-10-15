// SPDX-License-Identifier: MIT
/* The studio (index.html): plays the face on any screen and drives it by hand, the
   way the robot software drives it over the screen protocol. Adding `#<expression>`
   or `#<screen id>` to the address opens the studio on it. */

import { Animator } from './animator.js';
import { EXPRESSIONS } from './expressions.js';
import { PROFILES } from './layout.js';
import { Player } from './player.js';
import { TONES, rgba } from './tones.js';

const $ = (id) => document.getElementById(id);
const CUSTOM = 'custom';

const animator = new Animator({ seed: 7 });
const player = new Player($('face'), animator);
player.status = { battery: 82, charging: false };
player.start();

let tone = null; // null: each expression's own colour

// Expressions.
const chips = $('expressions');
for (const [name, spec] of Object.entries(EXPRESSIONS)) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.dataset.name = name;
  chip.setAttribute('aria-pressed', 'false');
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = rgba(TONES[spec.tone].rgb);
  chip.append(dot, name);
  chip.addEventListener('click', () => show(name));
  chips.append(chip);
}

function show(name) {
  const shown = animator.set(name, tone, player.now());
  for (const chip of chips.children) chip.setAttribute('aria-pressed', String(chip.dataset.name === shown));
}

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
  player.status = { battery, charging: $('charging').checked };
}
$('battery').addEventListener('input', updateStatus);
$('charging').addEventListener('change', updateStatus);

// Readout.
const readout = $('readout');
setInterval(() => {
  const { width, height } = player.layout;
  readout.textContent = `${animator.expression} · ${tone ?? 'own colour'} · `
    + `${Math.round(width)} × ${Math.round(height)} px · ${Math.round(player.fps)} fps`;
}, 250);

// Start from the address (#happy, #round-360…), or on the 7" LCD with "neutral".
const token = location.hash.slice(1);
setScreen(PROFILES.some((p) => p.id === token) ? token : PROFILES[0].id);
show(Object.hasOwn(EXPRESSIONS, token) ? token : 'neutral');
