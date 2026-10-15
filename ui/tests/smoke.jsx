// SPDX-License-Identifier: MIT
/* Smoke test of the emotion library (how to run it: ui/README.md).

   Checks the library's structure, renders every variant at several moments
   of its loop and on every screen profile, checks that no file replaced a
   shared helper, and that smoke.html loads the same files as the sheet. The
   verdict goes to #result as
   data-status="pass" or data-status="fail", with one line per failure.
*/

const { renderToStaticMarkup } = ReactDOMServer;
const { EYE_TONES } = window.EmotionCore;
const { PROFILES, Screen } = window.Screens;
const CATS = window.EMOTION_CATEGORIES;
const KEYS = window.EMOTION_CATEGORY_KEYS;

const MOMENTS = [0, 0.07, 0.19, 0.33, 0.48, 0.61, 0.77, 0.9, 0.99];
const KINDS = ['emotion', 'scene', 'status'];

function knownTone(tone) {
  return !tone || tone === 'multi' || Boolean(EYE_TONES[tone]);
}

function checkLibrary(fail) {
  const keys = new Set(KEYS);
  for (const k of Object.keys(CATS)) {
    if (!keys.has(k)) fail(k, 'category missing from EMOTION_CATEGORY_KEYS');
  }
  const ids = new Set();
  const counts = Object.fromEntries(KINDS.map((kind) => [kind, { categories: 0, variants: 0 }]));
  let variants = 0;
  for (const k of KEYS) {
    const cat = CATS[k];
    if (!cat) { fail(k, 'listed in EMOTION_CATEGORY_KEYS but not defined'); continue; }
    if (!KINDS.includes(cat.kind)) fail(k, `unknown kind ${cat.kind}`);
    if (!knownTone(cat.tone)) fail(k, `unknown tone ${cat.tone}`);
    if (!cat.variants || cat.variants.length === 0) { fail(k, 'no variants'); continue; }
    if (counts[cat.kind]) {
      counts[cat.kind].categories += 1;
      counts[cat.kind].variants += cat.variants.length;
    }
    for (const v of cat.variants) {
      variants += 1;
      if (ids.has(v.id)) fail(v.id, 'duplicate variant id');
      ids.add(v.id);
      if (!(v.duration > 0)) fail(v.id, 'duration must be positive');
      if (!knownTone(v.tone)) fail(v.id, `unknown tone ${v.tone}`);
      for (const t of MOMENTS) {
        try {
          renderToStaticMarkup(<svg>{v.render(t)}</svg>);
        } catch (e) {
          fail(`${v.id} at t=${t}`, e.message);
        }
      }
      for (const profile of PROFILES) {
        try {
          renderToStaticMarkup(
            <Screen variant={v} profile={profile} t={0.5}
                    tone={v.tone || cat.tone || 'cyan'} kind={cat.kind} />);
        } catch (e) {
          fail(`${v.id} on ${profile.id}`, e.message);
        }
      }
    }
  }
  return { variants, counts };
}

// Babel runs every library file as a classic script, all in one global scope,
// so a top-level helper in one file can silently replace another file's: the
// global must still be the exported value.
function checkSharedNames(fail) {
  const exports = { EmotionCore: window.EmotionCore, SceneArc: window.SceneArc, Screens: window.Screens };
  for (const [owner, values] of Object.entries(exports)) {
    for (const [name, value] of Object.entries(values)) {
      if (name in window && window[name] !== value) {
        fail(`${owner}.${name}`, 'replaced in the global scope by another file');
      }
    }
  }
}

// The library files this page loads, and those ../index.html loads (minus the sheet).
async function compareScriptLists(fail) {
  const html = await (await fetch('../index.html')).text();
  const sheet = [...html.matchAll(/<script type="text\/babel" src="src\/([^"]+)"/g)]
    .map((m) => m[1])
    .filter((name) => name !== 'sheet.jsx');
  const here = [...document.querySelectorAll('script[type="text/babel"]')]
    .map((s) => s.getAttribute('src'))
    .filter((src) => src.startsWith('../src/'))
    .map((src) => src.slice('../src/'.length));
  if (sheet.join() !== here.join()) {
    fail('smoke.html', `loads ${here.join(', ')}; index.html loads ${sheet.join(', ')}`);
  }
}

(async () => {
  const failures = [];
  const fail = (where, message) => failures.push(`${where}: ${message}`);
  let summary = '';
  try {
    for (const message of window.LOAD_ERRORS) fail('loading', message);
    const { variants, counts } = checkLibrary(fail);
    checkSharedNames(fail);
    await compareScriptLists(fail);
    const byKind = KINDS.map((kind) => `${counts[kind].categories} ${kind} (${counts[kind].variants})`).join(', ');
    summary = `${KEYS.length} categories: ${byKind} · ${variants} variants · `
      + `${MOMENTS.length} moments · ${PROFILES.length} screens`;
  } catch (e) {
    fail('smoke test', e.message);
  }
  const status = failures.length ? 'fail' : 'pass';
  const result = document.getElementById('result');
  result.dataset.status = status;
  result.textContent = [`${status.toUpperCase()} · ${summary}`, ...failures].join('\n');
  document.title = `${status.toUpperCase()} · ${document.title}`;
})();
