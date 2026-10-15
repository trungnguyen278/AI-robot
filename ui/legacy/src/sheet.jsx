// SPDX-License-Identifier: MIT
/* The emotion sheet: every emotion, scene and status variant, on any screen.

   The stage plays the selected variant on the selected screen, the library
   on the right picks it, and the strip at the bottom shows the first
   variant of every category. Open #<screen id> (e.g. #round-360) to start on
   a given screen.

   Loaded LAST. Reads window.EMOTION_CATEGORIES and EMOTION_CATEGORY_KEYS
   (the library) and window.Screens (screen.jsx).
*/

const { useState, useEffect, useRef, useMemo, useCallback } = React;

const CATS = window.EMOTION_CATEGORIES;
const CAT_KEYS = window.EMOTION_CATEGORY_KEYS;
const { EYE_TONES, wrap } = window.EmotionCore;
const { PROFILES, toneVars, resolveTone, Screen } = window.Screens;

// With reduced motion, the thumbnails and the bottom strip hold one frame.
const STILL_T = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.3 : undefined;
  } catch (e) {
    return undefined;
  }
})();

const CUSTOM_MIN = 64;
const CUSTOM_MAX = 4096;

function sizeFrom(text, fallback) {
  const n = Math.round(Number(text));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, n));
}

function profileFor(screenId, custom) {
  if (screenId !== 'custom') return PROFILES.find((p) => p.id === screenId) || PROFILES[0];
  const width = sizeFrom(custom.width, 800);
  const height = custom.shape === 'round' ? width : sizeFrom(custom.height, 480);
  return { id: 'custom', label: 'Custom', shape: custom.shape, width, height };
}

// The screen to open on: #<profile id> in the page address, else the first profile.
function initialScreenId() {
  const id = (window.location.hash || '').slice(1);
  return id === 'custom' || PROFILES.some((p) => p.id === id) ? id : PROFILES[0].id;
}

function formatClock(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// The selected screen inside a device frame that matches its shape.
function Device({ profile, tone, kind, children }) {
  const size = `${profile.width}×${profile.height}`;
  if (profile.shape === 'round') {
    const diameter = Math.min(profile.width, 440);
    return (
      <div className="device device-round" style={toneVars(tone, kind)}>
        <div className="ring" style={{ width: `min(${diameter + 28}px, 100%)` }}>
          <div className="screen-host round">{children}</div>
        </div>
        <div className="device-foot"><span className="led" />{size} · {profile.label}</div>
      </div>
    );
  }
  // Wide enough to read, never taller than about 720 px.
  const maxWidth = Math.min(960, (720 * profile.width) / profile.height);
  return (
    <div className="device device-rect" style={{ ...toneVars(tone, kind), maxWidth: maxWidth + 64 }}>
      <div className="device-top" aria-hidden="true">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
      <div className="device-screen">
        <div className="screen-host rect" style={{ aspectRatio: `${profile.width} / ${profile.height}` }}>
          {children}
        </div>
      </div>
      <div className="device-foot">{size} · {profile.label}</div>
    </div>
  );
}

function ScreenPicker({ screenId, onScreen, custom, onCustom }) {
  return (
    <div className="screen-pick">
      <label htmlFor="screen-select">Screen</label>
      <select id="screen-select" value={screenId} onChange={(e) => onScreen(e.target.value)}>
        {PROFILES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label} · {p.width}×{p.height}
          </option>
        ))}
        <option value="custom">Custom size</option>
      </select>
      {screenId === 'custom' && (
        <span className="custom-size">
          <select id="screen-shape" aria-label="Screen shape" value={custom.shape}
                  onChange={(e) => onCustom({ ...custom, shape: e.target.value })}>
            <option value="rect">Rectangle</option>
            <option value="round">Round</option>
          </select>
          <input id="screen-width" type="number" inputMode="numeric"
                 min={CUSTOM_MIN} max={CUSTOM_MAX} step={1}
                 aria-label={custom.shape === 'round' ? 'Diameter in pixels' : 'Width in pixels'}
                 value={custom.width}
                 onChange={(e) => onCustom({ ...custom, width: e.target.value })} />
          {custom.shape === 'rect' && (
            <>
              <span aria-hidden="true">×</span>
              <input id="screen-height" type="number" inputMode="numeric"
                     min={CUSTOM_MIN} max={CUSTOM_MAX} step={1}
                     aria-label="Height in pixels" value={custom.height}
                     onChange={(e) => onCustom({ ...custom, height: e.target.value })} />
            </>
          )}
          <span>px</span>
        </span>
      )}
    </div>
  );
}

function VariantThumb({ variant, profile, active, onClick, fps, tone, kind }) {
  return (
    <button className={`thumb ${active ? 'active' : ''}`} onClick={onClick} type="button"
            aria-pressed={active}>
      <div className={`thumb-inner ${profile.shape}`}
           style={{ aspectRatio: `${profile.width} / ${profile.height}`, ...toneVars(tone, kind) }}>
        <Screen variant={variant} profile={profile} fps={fps} t={STILL_T}
                showStatus={false} tone={tone} kind={kind} />
      </div>
      <div className="thumb-label">{variant.label}</div>
    </button>
  );
}

function TinyScreen({ variant, profile, fps, tone, kind }) {
  return (
    <div className="tiny-wrap">
      <div className={`tiny-screen ${profile.shape}`}
           style={{ aspectRatio: `${profile.width} / ${profile.height}`, ...toneVars(tone, kind) }}>
        <Screen variant={variant} profile={profile} fps={fps} t={STILL_T}
                showStatus={false} tone={tone} kind={kind} />
      </div>
      <div className="tiny-label">{variant.label}</div>
    </div>
  );
}

function CategoryPill({ cat, active, onClick, scene = false, showTone = true }) {
  const td = EYE_TONES[cat.tone] || EYE_TONES.cyan;
  return (
    <button type="button" className={`pill ${active ? 'active' : ''} ${scene ? 'scene' : ''}`}
            onClick={onClick} aria-pressed={active}>
      {showTone && (
        <span className="pill-dot" aria-hidden="true"
              style={{ background: td.eye, boxShadow: `0 0 6px ${td.glow}` }} />
      )}
      <span className="pill-name">{cat.label}</span>
      <span className="pill-count">{cat.variants.length}</span>
    </button>
  );
}

function CategoryRail({ keys, catKey, onSelect, scene = false, showTone }) {
  return (
    <div className="cat-rail">
      {keys.map((k) => (
        <CategoryPill key={k} cat={CATS[k]} active={k === catKey} onClick={() => onSelect(k)}
                      scene={scene} showTone={showTone} />
      ))}
    </div>
  );
}

function Strip({ title, keys, profile, fps, colorMode, scene = false }) {
  return (
    <>
      <div className={`cat-section-label ${scene ? 'scene' : ''}`}>{title}</div>
      <div className="strip">
        {keys.map((k) => {
          const first = CATS[k].variants[0];
          return (
            <div key={k} className="strip-cell">
              <div className="strip-cell-cat">{CATS[k].label}</div>
              <TinyScreen variant={first} profile={profile} fps={fps}
                          tone={colorMode ? resolveTone(first, CATS[k]) : 'cyan'}
                          kind={CATS[k].kind || 'emotion'} />
            </div>
          );
        })}
      </div>
    </>
  );
}

function App() {
  const [catKey, setCatKey] = useState('normal');
  const [variantIdx, setVariantIdx] = useState(0);
  const [fps, setFps] = useState(30);
  const [autoplay, setAutoplay] = useState(false);
  const [idleMode, setIdleMode] = useState(false);
  const [autoplayMs, setAutoplayMs] = useState(3500);
  const [colorMode, setColorMode] = useState(true);
  const [screenId, setScreenId] = useState(initialScreenId);
  const [custom, setCustom] = useState({ shape: 'rect', width: '800', height: '480' });

  const profile = useMemo(() => profileFor(screenId, custom), [screenId, custom]);
  const cat = CATS[catKey];
  const variant = cat.variants[variantIdx];
  const recentRef = useRef([]); // recently shown variant ids, across categories

  const emotionKeys = useMemo(() => CAT_KEYS.filter((k) => !CATS[k].kind || CATS[k].kind === 'emotion'), []);
  const sceneKeys = useMemo(() => CAT_KEYS.filter((k) => CATS[k].kind === 'scene'), []);
  const statusKeys = useMemo(() => CAT_KEYS.filter((k) => CATS[k].kind === 'status'), []);

  // A random variant of a category, avoiding the last 6 shown.
  const pickVariant = useCallback((nextCatKey) => {
    const c = CATS[nextCatKey];
    const recent = recentRef.current;
    const pool = c.variants.filter((v) => !recent.includes(v.id));
    const choices = pool.length ? pool : c.variants;
    const v = choices[Math.floor(Math.random() * choices.length)];
    recentRef.current = [...recent, v.id].slice(-6);
    return c.variants.indexOf(v);
  }, []);

  // Autoplay: step through the categories, a fresh variant each time.
  useEffect(() => {
    if (!autoplay) return undefined;
    const id = setInterval(() => {
      setCatKey((prev) => {
        const next = CAT_KEYS[(CAT_KEYS.indexOf(prev) + 1) % CAT_KEYS.length];
        setVariantIdx(pickVariant(next));
        return next;
      });
    }, autoplayMs);
    return () => clearInterval(id);
  }, [autoplay, autoplayMs, pickVariant]);

  // Idle mode: random variants of 'normal', what the robot shows when it
  // has nothing else to do.
  useEffect(() => {
    if (!idleMode) return undefined;
    setCatKey('normal');
    const tick = () => setVariantIdx(pickVariant('normal'));
    tick();
    const id = setInterval(tick, autoplayMs);
    return () => clearInterval(id);
  }, [idleMode, autoplayMs, pickVariant]);

  // Live clock for the status chrome.
  const [clock, setClock] = useState(() => formatClock(new Date()));
  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const stopPlaying = () => { setAutoplay(false); setIdleMode(false); };
  const onSelectCat = (k) => { stopPlaying(); setCatKey(k); setVariantIdx(0); };
  const cycleVariant = (dir) => { stopPlaying(); setVariantIdx((i) => wrap(i + dir, cat.variants.length)); };
  const randomVariant = () => { stopPlaying(); setVariantIdx(pickVariant(catKey)); };

  const totalVariants = useMemo(() => CAT_KEYS.reduce((sum, k) => sum + CATS[k].variants.length, 0), []);
  const activeTone = colorMode ? resolveTone(variant, cat) : 'cyan';
  const activeKind = cat.kind || 'emotion';
  const kindPrefix = cat.kind === 'scene' ? 'SCENE · ' : cat.kind === 'status' ? 'STATUS · ' : '';

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-name">
          <span className="logo" aria-hidden="true">◉</span>
          <h1>Emotion Library</h1>
        </div>
        <div className="hdr-meta">
          <span>{emotionKeys.length} emotions</span><span aria-hidden="true">·</span>
          <span>{sceneKeys.length} scenes</span><span aria-hidden="true">·</span>
          <span>{statusKeys.length} status</span><span aria-hidden="true">·</span>
          <span>{totalVariants} variants</span><span aria-hidden="true">·</span>
          <span>{fps} fps</span><span aria-hidden="true">·</span>
          <span>
            {profile.shape === 'round' ? '○ ' : ''}{profile.width}×{profile.height} · {colorMode ? 'color' : 'mono cyan'}
          </span>
        </div>
      </header>

      <main className="main">
        <section className="stage" aria-label="Selected variant">
          <Device profile={profile} tone={activeTone} kind={activeKind}>
            <Screen variant={variant} profile={profile} fps={fps} showStatus
                    statusTime={clock} tone={activeTone} kind={activeKind} />
          </Device>

          <div className="stage-meta">
            <div className="stage-cat">{kindPrefix}{cat.label.toUpperCase()}</div>
            <div className="big-label">
              <span className="big-label-key">
                {String(variantIdx + 1).padStart(2, '0')}/{String(cat.variants.length).padStart(2, '0')}
              </span>
              <span className="big-label-name">{variant.label}</span>
            </div>
            <div className="big-sub">
              <span className="id">{variant.id}</span>
              <span className="sep">·</span>
              loop {variant.duration} ms
              <span className="sep">·</span>
              {Math.round((variant.duration / 1000) * fps)} frames at {fps} fps
            </div>
          </div>

          <div className="controls">
            <div className="ctrl-group">
              <button className="ctrl-ico" onClick={() => cycleVariant(-1)} type="button" aria-label="Previous variant">←</button>
              <button className="ctrl-ico" onClick={randomVariant} type="button" aria-label="Random variant">⤬</button>
              <button className="ctrl-ico" onClick={() => cycleVariant(1)} type="button" aria-label="Next variant">→</button>
            </div>
            <ScreenPicker screenId={screenId} onScreen={setScreenId} custom={custom} onCustom={setCustom} />
            <button className={`ctrl ${colorMode ? 'on-color' : ''}`} onClick={() => setColorMode((v) => !v)}
                    type="button" aria-pressed={colorMode}
                    title="Color: each category's accent tone. Mono: everything cyan.">
              {colorMode ? '◐ Color' : '◯ Mono'}
            </button>
            <button className={`ctrl ${idleMode ? 'on-idle' : ''}`}
                    onClick={() => { setAutoplay(false); setIdleMode((v) => !v); }}
                    type="button" aria-pressed={idleMode}
                    title="Random variants of Normal, as the robot shows when idle">
              {idleMode ? '■ Stop idle' : '◉ Idle mode'}
            </button>
            <button className={`ctrl ${autoplay ? 'on' : ''}`}
                    onClick={() => { setIdleMode(false); setAutoplay((v) => !v); }}
                    type="button" aria-pressed={autoplay}>
              {autoplay ? '■ Stop autoplay' : '▶ Autoplay all'}
            </button>
            <label className="ctrl-slider" htmlFor="fps-range">
              <span>fps</span>
              <input id="fps-range" type="range" min={12} max={60} step={1} value={fps}
                     onChange={(e) => setFps(+e.target.value)} />
              <span className="value">{fps}</span>
            </label>
            <label className="ctrl-slider" htmlFor="hold-range">
              <span>hold</span>
              <input id="hold-range" type="range" min={1500} max={6000} step={500} value={autoplayMs}
                     onChange={(e) => setAutoplayMs(+e.target.value)} disabled={!autoplay && !idleMode} />
              <span className="value">{(autoplayMs / 1000).toFixed(1)} s</span>
            </label>
          </div>
        </section>

        <aside className="lib-panel" aria-label="Library">
          <h2 className="panel-title">Library</h2>
          <p className="panel-sub">
            Pick a category, then a variant. Listening and Thinking are required for
            conversation. <strong>Scenes</strong> take over the whole screen for everyday
            information; <strong>status</strong> screens cover start-up and the network.
          </p>

          <div className="cat-section-label">Emotions <span className="sec-count">{emotionKeys.length}</span></div>
          <CategoryRail keys={emotionKeys} catKey={catKey} onSelect={onSelectCat} showTone={colorMode} />

          <div className="cat-section-label scene">Scenes <span className="sec-count">{sceneKeys.length}</span></div>
          <CategoryRail keys={sceneKeys} catKey={catKey} onSelect={onSelectCat} scene showTone={colorMode} />

          <div className="cat-section-label">Status <span className="sec-count">{statusKeys.length}</span></div>
          <CategoryRail keys={statusKeys} catKey={catKey} onSelect={onSelectCat} showTone={colorMode} />

          <div className="cat-header">
            <div>
              <div className="cat-header-name">{cat.label}</div>
              <div className="cat-header-desc">{cat.desc}</div>
            </div>
            <div className="cat-header-count">{cat.variants.length} variants</div>
          </div>

          <div className="grid">
            {cat.variants.map((v, i) => (
              <VariantThumb key={v.id} variant={v} profile={profile} active={i === variantIdx}
                            onClick={() => { stopPlaying(); setVariantIdx(i); }} fps={fps}
                            tone={colorMode ? resolveTone(v, cat) : 'cyan'} kind={activeKind} />
            ))}
          </div>
        </aside>
      </main>

      <footer className="strip-section">
        <div className="strip-title">
          <h2>Every category</h2>
          <span className="strip-sub">
            first variant of each, on the {profile.width}×{profile.height} {profile.shape === 'round' ? 'round ' : ''}screen
          </span>
        </div>
        <Strip title="Emotions" keys={emotionKeys} profile={profile} fps={fps} colorMode={colorMode} />
        <Strip title="Scenes" keys={sceneKeys} profile={profile} fps={fps} colorMode={colorMode} scene />
        {statusKeys.length > 0 && (
          <Strip title="Status" keys={statusKeys} profile={profile} fps={fps} colorMode={colorMode} />
        )}
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
