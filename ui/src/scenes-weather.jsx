// SPDX-License-Identifier: MIT
/* WEATHER, multi-case pack (v3.1).

   Weather is the canonical "state varies with the real world" scene: the
   host calls showScene('weather', <condition>) and the robot must show the
   ACTUAL sky outside, not always sunny. So weather is no longer a single
   arc — it carries one distinct mini-story per condition.

   The original `weather-window` arc (sun crossing a curtained window)
   stays as the CLEAR / SUNNY case (variant 0). This file APPENDS six more
   conditions, each with its own props, motion, tone, eye emotion and
   caption so no two tell the same story:

     cloudy · rainy · thunderstorm · snow · fog · windy

   Loaded AFTER scenes-arc-pack-1.jsx (which defines cats.weather), and
   after the other packs. It only pushes onto cats.weather.variants — it
   does not touch any other category, so the authoritative KEYS order in
   scenes-arc-pack-3b.jsx is unaffected (no new category appears).
*/

const {
  W, H, STATUS_H, CY, LX, RX, EYE_W, EYE_H,
  TAU, lerp, clamp, ease, starPath,
} = window.EmotionCore;
const { EmotionFace } = window.SceneArc;
const wCats = window.EMOTION_CATEGORIES;

/* --- local copies of the small helpers that live (module-private) in
       scenes-arc-pack-1.jsx; redefined here because babel scripts don't
       share scope. --- */
function wPhases(t, list) {
  let acc = 0;
  for (const [name, len] of list) {
    if (t < acc + len || name === list[list.length - 1][0]) {
      return { name, p: clamp((t - acc) / len, 0, 1) };
    }
    acc += len;
  }
}
function WFace({ cx, cy, scale, emotion, t }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-W / 2} ${-CY})`}>
      <EmotionFace emotion={emotion} t={t} />
    </g>
  );
}
function WLabel({ text }) {
  return (
    <text x={W / 2} y={H - 12} textAnchor="middle"
          fontFamily="ui-monospace, Menlo, monospace"
          fontSize={11} fontWeight={700}
          fill="var(--eye)" letterSpacing={3} opacity={0.85}>{text}</text>
  );
}

/* --- factory: shared "look outside" choreography, unique weather body ---
   The eyes open centered, shrink into the top-right corner to watch the
   sky take over the screen, then grow back. Every condition supplies its
   own `act(t, ph, watchP)` for the sky + props, its own emotions, and its
   own caption track — so the SHARED part is only the camera move; the
   STORY is per-condition. */
function weatherCase({ id, label, tone, duration,
                       openEmo, watchEmo, closeEmo,
                       openText, watchText, closeText, act }) {
  return {
    id, label, tone, duration,
    render: (t) => {
      const ph = wPhases(t, [
        ['open',   0.12],
        ['shrink', 0.08],
        ['watch',  0.56],
        ['grow',   0.08],
        ['close',  0.16],
      ]);
      const cornerX = W - 42, cornerY = STATUS_H + 24;
      let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = openEmo;
      if (ph.name === 'shrink') {
        const e = ease.inOut(ph.p);
        eyeCx = lerp(W / 2, cornerX, e);
        eyeCy = lerp(CY, cornerY, e);
        eyeScale = lerp(1, 0.32, e);
        eyeEmo = watchEmo;
      } else if (ph.name === 'watch') {
        eyeCx = cornerX; eyeCy = cornerY; eyeScale = 0.32; eyeEmo = watchEmo;
      } else if (ph.name === 'grow') {
        const e = ease.inOut(ph.p);
        eyeCx = lerp(cornerX, W / 2, e);
        eyeCy = lerp(cornerY, CY, e);
        eyeScale = lerp(0.32, 1, e);
        eyeEmo = closeEmo;
      } else if (ph.name === 'close') {
        eyeEmo = closeEmo;
      }

      const sceneOp = ph.name === 'open'   ? clamp((ph.p - 0.5) * 2, 0, 1)
                    : ph.name === 'shrink' ? ease.out(ph.p)
                    : ph.name === 'close'  ? 1 - ease.in(ph.p)
                    : 1;
      const watchP = ph.name === 'watch' ? ph.p
                   : ph.name === 'grow'  ? 1 : 0;
      const caption = (ph.name === 'open')                        ? openText
                    : (ph.name === 'grow' || ph.name === 'close') ? closeText
                    : watchText;

      return (
        <g>
          <g opacity={sceneOp}>{act(t, ph, watchP)}</g>
          <WFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
          <WLabel text={caption} />
        </g>
      );
    },
  };
}

/* a soft puffy cloud, drawn from the given fill */
function cloudPuff(cx, cy, s = 1, fill = 'var(--eye)', op = 0.55) {
  return (
    <g fill={fill} opacity={op}>
      <ellipse cx={cx} cy={cy} rx={20 * s} ry={11 * s} />
      <ellipse cx={cx + 14 * s} cy={cy - 7 * s} rx={15 * s} ry={9 * s} />
      <ellipse cx={cx - 14 * s} cy={cy - 5 * s} rx={13 * s} ry={8 * s} />
      <ellipse cx={cx + 2 * s} cy={cy - 12 * s} rx={11 * s} ry={8 * s} />
    </g>
  );
}

/* ============================================================
   The six appended conditions
============================================================ */
const NEW_WEATHER = [

  /* --- CLOUDY: layered clouds drift in and merge; a thin sun-ray
         peeks through the gap mid-watch, then is swallowed again. --- */
  weatherCase({
    id: 'weather-cloudy', label: 'Cloudy', tone: 'cyan', duration: 12000,
    openEmo: 'steady', watchEmo: 'curious', closeEmo: 'steady',
    openText: 'HOW\'S THE SKY?', watchText: 'CLOUDY · OVERCAST', closeText: 'GREY OUT THERE',
    act: (t, ph, wp) => {
      // sun peeks only in the middle third of the watch
      const peek = clamp(1 - Math.abs(wp - 0.5) * 4, 0, 1);
      const drift = (i, speed) => ((t * speed) + i * 0.37) % 1.4 - 0.2;
      return (
        <g>
          {/* faint sun behind */}
          <g opacity={0.35 + peek * 0.5}>
            <circle cx={W / 2} cy={CY - 6} r={26} fill="var(--accent)" />
          </g>
          {/* three cloud layers sliding at different speeds */}
          {[0, 1, 2, 3].map((i) => {
            const x = lerp(-40, W + 40, drift(i, 0.12));
            const y = STATUS_H + 30 + (i % 3) * 34;
            const s = 1 + (i % 2) * 0.4;
            return <g key={i}>{cloudPuff(x, y, s, 'var(--eye)', 0.7)}</g>;
          })}
        </g>
      );
    },
  }),

  /* --- RAINY: an umbrella opens overhead, rain streaks fall and burst
         into ripples in a puddle along the floor. --- */
  weatherCase({
    id: 'weather-rainy', label: 'Rainy', tone: 'blue', duration: 12000,
    openEmo: 'steady', watchEmo: 'happy', closeEmo: 'satisfied',
    openText: 'IS IT WET OUT?', watchText: 'RAIN · BRING BROLLY', closeText: 'STAY DRY ☂',
    act: (t, ph, wp) => {
      const open = clamp(wp * 3, 0, 1);          // umbrella opens early
      const umbW = 150 * open;
      const puddleY = H - 24;
      return (
        <g>
          {/* rain streaks */}
          {[...Array(18)].map((_, i) => {
            const col = (i / 18) * W + 6;
            const p = ((t * 1.6) + i * 0.21) % 1;
            const y = lerp(STATUS_H + 10, puddleY, p);
            return (
              <line key={i} x1={col} y1={y} x2={col - 4} y2={y + 12}
                    stroke="var(--accent)" strokeWidth={2}
                    strokeLinecap="round" opacity={0.55} />
            );
          })}
          {/* puddle ripples */}
          {[0, 1, 2].map((i) => {
            const p = ((t * 0.9) + i * 0.33) % 1;
            return (
              <ellipse key={i} cx={W / 2 + (i - 1) * 56} cy={puddleY}
                       rx={6 + p * 22} ry={2 + p * 4}
                       fill="none" stroke="var(--accent)" strokeWidth={1.5}
                       opacity={(1 - p) * 0.6} />
            );
          })}
          <line x1={0} y1={puddleY} x2={W} y2={puddleY}
                stroke="var(--accent)" strokeWidth={1.5} opacity={0.4} />
          {/* umbrella canopy + shaft, top-centre */}
          {open > 0.05 && (
            <g>
              <path d={`M ${W / 2 - umbW / 2} ${STATUS_H + 44}
                        Q ${W / 2} ${STATUS_H + 44 - 46 * open}, ${W / 2 + umbW / 2} ${STATUS_H + 44}
                        Q ${W / 2 + umbW / 4} ${STATUS_H + 36}, ${W / 2} ${STATUS_H + 44}
                        Q ${W / 2 - umbW / 4} ${STATUS_H + 36}, ${W / 2 - umbW / 2} ${STATUS_H + 44} Z`}
                    fill="var(--eye)" />
              <line x1={W / 2} y1={STATUS_H + 40} x2={W / 2} y2={STATUS_H + 88}
                    stroke="var(--eye)" strokeWidth={3} />
              <path d={`M ${W / 2} ${STATUS_H + 88} q 8 0 8 -8`}
                    fill="none" stroke="var(--eye)" strokeWidth={3} />
            </g>
          )}
        </g>
      );
    },
  }),

  /* --- THUNDERSTORM: black cloud bank, heavy slanted rain, lightning
         bolts crack with a full-screen flash; the robot flinches. --- */
  weatherCase({
    id: 'weather-storm', label: 'Thunderstorm', tone: 'purple', duration: 12000,
    openEmo: 'steady', watchEmo: 'surprised', closeEmo: 'satisfied',
    openText: 'WEATHER?', watchText: 'STORM · STAY IN', closeText: 'IT\'LL PASS',
    act: (t, ph, wp) => {
      // lightning strikes twice during the watch
      const strike = (Math.sin(wp * TAU * 2 - 1.2) > 0.93) ? 1 : 0;
      const flashOp = strike ? 0.5 : 0;
      const bolt = `M ${W / 2 - 14} ${STATUS_H + 56}
                    L ${W / 2 + 6} ${CY - 16} L ${W / 2 - 8} ${CY - 16}
                    L ${W / 2 + 14} ${H - 60}`;
      return (
        <g>
          {/* flash */}
          <rect x={0} y={STATUS_H} width={W} height={H - STATUS_H}
                fill="var(--accent)" opacity={flashOp} />
          {/* slanted heavy rain */}
          {[...Array(22)].map((_, i) => {
            const col = (i / 22) * (W + 60) - 30;
            const p = ((t * 2.2) + i * 0.17) % 1;
            const y = lerp(STATUS_H + 30, H - 16, p);
            return (
              <line key={i} x1={col + 14} y1={y - 16} x2={col} y2={y}
                    stroke="var(--eye)" strokeWidth={2}
                    strokeLinecap="round" opacity={0.5} />
            );
          })}
          {/* dark cloud bank */}
          {cloudPuff(W / 2 - 40, STATUS_H + 34, 1.5, 'var(--eye)', 0.85)}
          {cloudPuff(W / 2 + 40, STATUS_H + 30, 1.7, 'var(--eye)', 0.85)}
          {/* lightning bolt during a strike */}
          {strike === 1 && (
            <path d={bolt} fill="none" stroke="var(--accent)"
                  strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
          )}
        </g>
      );
    },
  }),

  /* --- SNOW: slow flakes sway down and pile into a drift; a tiny
         snowman builds itself near the end. --- */
  weatherCase({
    id: 'weather-snow', label: 'Snow', tone: 'white', duration: 13000,
    openEmo: 'steady', watchEmo: 'surprised', closeEmo: 'happy',
    openText: 'COLD OUT?', watchText: 'SNOWING ❄', closeText: 'SNOW DAY!',
    act: (t, ph, wp) => {
      const driftH = wp * 14;                    // snow piling up
      const snowmanS = clamp((wp - 0.55) / 0.35, 0, 1);
      return (
        <g>
          {/* drifting flakes */}
          {[...Array(20)].map((_, i) => {
            const col = (i / 20) * W + 8;
            const p = ((t * 0.6) + i * 0.137) % 1;
            const x = col + Math.sin(p * TAU + i) * 10;
            const y = lerp(STATUS_H + 8, H - 18, p);
            const r = 1.6 + (i % 3) * 0.9;
            return <circle key={i} cx={x} cy={y} r={r} fill="var(--accent)" opacity={0.9} />;
          })}
          {/* accumulated drift along the floor */}
          <path d={`M 0 ${H} L 0 ${H - 8 - driftH}
                    Q ${W / 4} ${H - 16 - driftH} ${W / 2} ${H - 8 - driftH}
                    Q ${3 * W / 4} ${H - driftH} ${W} ${H - 10 - driftH} L ${W} ${H} Z`}
                fill="var(--accent)" opacity={0.6} />
          {/* tiny snowman */}
          {snowmanS > 0.05 && (
            <g transform={`translate(${W / 2} ${H - 18 - driftH}) scale(${snowmanS})`}>
              <circle cx={0} cy={-12} r={16} fill="var(--accent)" />
              <circle cx={0} cy={-34} r={11} fill="var(--accent)" />
              <circle cx={-3} cy={-36} r={1.6} fill="var(--bg)" />
              <circle cx={3} cy={-36} r={1.6} fill="var(--bg)" />
              <path d="M 0 -33 l 5 2" stroke="var(--eye)" strokeWidth={2} fill="none" />
            </g>
          )}
        </g>
      );
    },
  }),

  /* --- FOG: thick horizontal banks roll across at different speeds and
         dim a faint landmark; visibility stays low. --- */
  weatherCase({
    id: 'weather-fog', label: 'Fog', tone: 'blue', duration: 12000,
    openEmo: 'steady', watchEmo: 'sleepy', closeEmo: 'curious',
    openText: 'CAN YOU SEE?', watchText: 'FOG · LOW VIS', closeText: 'MIND THE MIST',
    act: (t, ph, wp) => {
      return (
        <g>
          {/* faint landmark behind the fog (a hill + flag) */}
          <g opacity={0.3}>
            <path d={`M ${W / 2 - 50} ${H - 20} Q ${W / 2} ${CY + 20} ${W / 2 + 50} ${H - 20} Z`}
                  fill="var(--eye)" />
          </g>
          {/* rolling fog bands */}
          {[0, 1, 2, 3, 4].map((i) => {
            const speed = 0.06 + (i % 3) * 0.05;
            const x = ((t * speed * (i % 2 ? 1 : -1)) % 1 + 1) % 1;
            const cx = lerp(-W, W, x) + (i % 2 ? 0 : W);
            const y = STATUS_H + 24 + i * 36;
            return (
              <rect key={i} x={cx - W} y={y} width={W * 2} height={26} rx={13}
                    fill="var(--accent)" opacity={0.22} />
            );
          })}
        </g>
      );
    },
  }),

  /* --- WINDY: fast diagonal gust lines and tumbling leaves blow across;
         a sapling at the floor bends hard with each gust; the eyes get
         shoved sideways. --- */
  weatherCase({
    id: 'weather-windy', label: 'Windy', tone: 'cyan', duration: 12000,
    openEmo: 'steady', watchEmo: 'curious', closeEmo: 'satisfied',
    openText: 'BREEZY?', watchText: 'WINDY · GUSTY', closeText: 'HOLD ONTO YOUR HAT',
    act: (t, ph, wp) => {
      const gust = Math.sin(t * TAU * 1.5) * 0.5 + 0.5;   // 0..1 gust
      const bend = gust * 26;
      return (
        <g>
          {/* gust streak lines */}
          {[...Array(8)].map((_, i) => {
            const p = ((t * 1.8) + i * 0.13) % 1;
            const y = STATUS_H + 18 + i * 22;
            const x = lerp(-80, W + 40, p);
            const len = 40 + (i % 3) * 18;
            return (
              <path key={i}
                    d={`M ${x} ${y} q ${len * 0.6} -6 ${len} 0`}
                    fill="none" stroke="var(--eye)" strokeWidth={2}
                    strokeLinecap="round" opacity={0.4} />
            );
          })}
          {/* tumbling leaves */}
          {[0, 1, 2, 3].map((i) => {
            const p = ((t * 1.2) + i * 0.27) % 1;
            const x = lerp(-30, W + 30, p);
            const y = CY + Math.sin(p * TAU * 2 + i) * 40;
            const rot = p * 720 + i * 90;
            return (
              <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
                <ellipse cx={0} cy={0} rx={7} ry={3.5} fill="var(--accent)" opacity={0.8} />
              </g>
            );
          })}
          {/* bending sapling */}
          <g>
            <path d={`M ${W / 2} ${H - 14}
                      Q ${W / 2 + bend * 0.6} ${CY + 30} ${W / 2 + bend} ${CY - 4}`}
                  fill="none" stroke="var(--eye)" strokeWidth={5} strokeLinecap="round" />
            <ellipse cx={W / 2 + bend} cy={CY - 8} rx={14} ry={9}
                     fill="var(--eye)" opacity={0.8} />
          </g>
        </g>
      );
    },
  }),
];

/* relabel the original window arc as the explicit "clear / sunny" case,
   then append the six new conditions. */
if (wCats.weather && wCats.weather.variants[0]) {
  wCats.weather.variants[0].label = 'Clear / sunny';
  if (!wCats.weather.variants[0].tone) wCats.weather.variants[0].tone = 'warm';
}
wCats.weather.variants.push(...NEW_WEATHER);
wCats.weather.desc = 'One case per sky: sunny · cloudy · rainy · storm · snow · fog · windy.';
