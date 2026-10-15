// SPDX-License-Identifier: MIT
/* Network — the connectivity status flow:
     wifi-scan · wifi-connect · wifi-retry · offline · bt-scan · bt-paired · server-error

   These are status screens, not emotions — they take over the whole
   screen when the host needs to surface a connectivity event. Tone: cyan
   for normal/in-progress states, red for failures, purple for Bluetooth.
   The network name and the paired device come from window.ScreenData
   (screen.jsx), which the host fills in.

   Loaded AFTER scenes-boot.jsx and BEFORE emotion-color.jsx
   (so the color pass sees the new category + per-variant tones).
*/

const {
  W, H, STATUS_H, CY, GAP, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, wrap, ease, pulse,
} = window.EmotionCore;

const cats = window.EMOTION_CATEGORIES;
const keys = window.EMOTION_CATEGORY_KEYS;

const SCX = W / 2;
const SCY = STATUS_H + (H - STATUS_H) / 2;

// ---- shared glyphs ---------------------------------------------------
// Wi-Fi icon: 3 concentric top-half arcs (curving up, opening down) +
// a dot at the bottom. `bars` controls how many arcs are at full opacity.
function WifiIcon({ cx, cy, scale = 1, bars = 3, opacity = 1, color = 'var(--accent)' }) {
  // Top-half arc centered on (cx, cy): sweep-flag=1 (clockwise in SVG's
  // y-down screen space) sweeps from (cx-r, cy) up over (cx, cy-r) to
  // (cx+r, cy) — gives the classic wi-fi "fan" shape with the open side
  // facing downward toward the dot.
  const arc = (r, sw, op) => (
    <path
      d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
      fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
      opacity={op * opacity} />
  );
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`}>
      {arc(28, 5, bars >= 3 ? 1 : 0.2)}
      {arc(18, 5, bars >= 2 ? 1 : 0.2)}
      {arc(8,  5, bars >= 1 ? 1 : 0.2)}
      <circle cx={cx} cy={cy + 3} r={3} fill={color} opacity={opacity} />
    </g>
  );
}

// Bluetooth glyph
function BTIcon({ cx, cy, scale = 1, opacity = 1, color = 'var(--accent)' }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`}
       stroke={color} strokeWidth={4} strokeLinecap="round"
       strokeLinejoin="round" fill="none" opacity={opacity}>
      <path d="M -10 -16 L 10 0 L -10 16 L -10 -16 L 10 -8 L -10 8 L 10 16" />
    </g>
  );
}

// Cloud silhouette (for server icons)
function CloudIcon({ cx, cy, scale = 1, opacity = 1, color = 'var(--accent)', fill = 'none' }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`}
       stroke={color} strokeWidth={3} strokeLinecap="round"
       strokeLinejoin="round" fill={fill} opacity={opacity}>
      <path d="M -28 8
               C -38 8, -38 -8, -24 -10
               C -22 -22, -4 -24, 2 -14
               C 14 -22, 30 -12, 26 2
               C 36 4, 36 16, 26 16
               L -28 16
               C -38 16, -38 8, -28 8 Z" />
    </g>
  );
}

// Small label
function MonoLabel({ x, y, text, size = 11, ls = 2, fill = 'var(--eye)', op = 1, weight = 500, anchor = 'middle' }) {
  return (
    <text x={x} y={y} textAnchor={anchor}
          fontFamily="ui-monospace, Menlo, monospace"
          fontWeight={weight} fontSize={size} letterSpacing={ls}
          fill={fill} opacity={op}>{text}</text>
  );
}

// Animated typing dots — 3 dots, one brighter each step.
function TypingDots({ cx, cy, t, color = 'var(--accent)', size = 4, gap = 12 }) {
  const step = Math.floor(t * 6) % 3;
  return (
    <g>
      {[-1, 0, 1].map((i) => (
        <circle key={i} cx={cx + i * gap} cy={cy} r={size}
                fill={color} opacity={i === step - 1 ? 1 : 0.3} />
      ))}
    </g>
  );
}

// ---- variants ---------------------------------------------------
cats.network = {
  label: 'Network',
  desc: 'Connectivity status displays.',
  kind: 'status',
  variants: [

    // 1. WIFI SCAN — arcs cycle from inner → outer like a radar sweep
    { id: 'network-wifi-scan', label: 'Searching', duration: 1800,
      render: (t) => {
        const phase = (t * 3) % 1;
        const bars = phase < 0.33 ? 1 : phase < 0.66 ? 2 : 3;
        return (
          <g>
            <WifiIcon cx={SCX} cy={SCY - 14} scale={1.8} bars={bars}
                      color="var(--accent)" />
            <MonoLabel x={SCX} y={H - 36} text="SEARCHING WI-FI" size={11} ls={2.5} op={0.95} />
            <TypingDots cx={SCX} cy={H - 18} t={t} />
          </g>
        );
      } },

    // 2. WIFI CONNECT — full bars, with progress bar underneath + SSID line
    { id: 'network-wifi-connect', label: 'Connecting', duration: 2400,
      render: (t) => {
        const fill = clamp(t, 0, 1);
        const blink = Math.floor(t * 4) % 2 === 0 ? 1 : 0.4;
        const barW = W - 80;
        const barX = (W - barW) / 2;
        const barY = H - 38;
        return (
          <g>
            <WifiIcon cx={SCX} cy={STATUS_H + 56} scale={1.5} bars={3}
                      opacity={blink} />
            <MonoLabel x={SCX} y={STATUS_H + 108} text="CONNECTING" size={11} ls={3} />
            <MonoLabel x={SCX} y={STATUS_H + 124} text={window.ScreenData.ssid} size={9} ls={1.5}
                       fill="var(--accent)" op={0.85} />
            {/* progress bar */}
            <rect x={barX} y={barY} width={barW} height={8} rx={2}
                  fill="none" stroke="var(--eye)" strokeWidth={1.2} opacity={0.6} />
            <rect x={barX + 1.5} y={barY + 1.5}
                  width={(barW - 3) * fill} height={5} rx={1.5}
                  fill="var(--accent)" />
          </g>
        );
      } },

    // 3. WIFI RETRY — wifi with circular arrow + counter
    { id: 'network-wifi-retry', label: 'Retrying', duration: 2000,
      render: (t) => {
        const spin = t * 360;
        const attempt = Math.floor(t * 3) + 1;
        return (
          <g>
            <WifiIcon cx={SCX} cy={STATUS_H + 60} scale={1.5} bars={1}
                      opacity={0.85} />
            {/* circular retry arrow around the icon */}
            <g transform={`translate(${SCX} ${STATUS_H + 60}) rotate(${spin})`}
               stroke="var(--accent)" strokeWidth={3} fill="none" strokeLinecap="round">
              <path d="M -42 0
                       A 42 42 0 1 1 0 42" />
              {/* arrow head */}
              <path d="M -6 36 L 0 42 L 6 36" strokeLinejoin="round" />
            </g>
            <MonoLabel x={SCX} y={STATUS_H + 130} text="RETRY CONNECTION" size={10} ls={2.5} />
            <MonoLabel x={SCX} y={H - 16} text={`ATTEMPT ${attempt} OF 3`}
                       size={10} ls={2} fill="var(--accent)" op={0.95} weight={700} />
          </g>
        );
      } },

    // 4. OFFLINE — wifi crossed out, "OFFLINE" stamp
    { id: 'network-offline', label: 'Offline', duration: 2400,
      render: (t) => {
        const breathe = 0.7 + Math.abs(Math.sin(t * TAU)) * 0.3;
        return (
          <g>
            <WifiIcon cx={SCX} cy={STATUS_H + 60} scale={1.6} bars={0}
                      opacity={0.45} color="var(--eye)" />
            {/* diagonal slash across icon */}
            <line x1={SCX - 36} y1={STATUS_H + 30}
                  x2={SCX + 36} y2={STATUS_H + 100}
                  stroke="var(--accent)" strokeWidth={5}
                  strokeLinecap="round" />
            <MonoLabel x={SCX} y={STATUS_H + 134} text="NO INTERNET" size={11} ls={3}
                       weight={700} op={breathe} />
            <MonoLabel x={SCX} y={H - 16} text="CHECK WI-FI ROUTER" size={9} ls={1.5}
                       fill="var(--eye)" op={0.55} />
          </g>
        );
      } },

    // 5. BT SCAN — pulsing BT icon with radar sweep, "searching for devices"
    { id: 'network-bt-scan', label: 'BT searching', duration: 2200,
      render: (t) => {
        const breathe = 0.85 + Math.sin(t * TAU * 2) * 0.15;
        const wave = (p) => {
          const r = lerp(18, 56, p);
          return (
            <circle cx={SCX} cy={SCY - 14} r={r}
                    fill="none" stroke="var(--accent)" strokeWidth={2}
                    opacity={(1 - p) * 0.7} />
          );
        };
        const found = Math.floor(t * 3); // 0, 1, 2
        return (
          <g>
            {wave((t) % 1)}
            {wave(((t) + 0.5) % 1)}
            <BTIcon cx={SCX} cy={SCY - 14} scale={1.5 * breathe}
                    color="var(--accent)" />
            <MonoLabel x={SCX} y={SCY + 38} text="SEARCHING DEVICES"
                       size={11} ls={2.5} weight={700} />
            <MonoLabel x={SCX} y={SCY + 56} text={`${found} FOUND`}
                       size={10} ls={2} fill="var(--accent)" op={0.9} />
            <TypingDots cx={SCX} cy={H - 18} t={t} />
          </g>
        );
      } },

    // 6. BT CONNECTED — merged from the old Bluetooth scene. Robot
    //    shows a paired device with a confirm check. (Pairing-mode
    //    variant was removed; pair from a phone, then this confirms.)
    { id: 'network-bt-paired', label: 'Bluetooth on', duration: 2600,
      render: (t) => {
        const pop = t < 0.25 ? ease.out(t / 0.25) : 1;
        const wave = Math.sin(t * TAU) * 0.5 + 0.5;
        return (
          <g>
            {/* BT glyph on left */}
            <BTIcon cx={SCX - 60} cy={SCY - 10} scale={1.5}
                    color="var(--accent)" opacity={0.85 + wave * 0.15} />
            {/* phone shape on right */}
            <g transform={`translate(${SCX + 60} ${SCY - 10})`}>
              <rect x={-16} y={-26} width={32} height={52} rx={4}
                    fill="var(--accent)" />
              <rect x={-12} y={-22} width={24} height={40} rx={2}
                    fill="var(--bg)" opacity={0.4} />
              <circle cx={0} cy={20} r={2.5} fill="var(--bg)" />
            </g>
            {/* dashed link line */}
            <line x1={SCX - 38} y1={SCY - 10}
                  x2={SCX + 40} y2={SCY - 10}
                  stroke="var(--accent)" strokeWidth={2}
                  strokeDasharray="4 4" opacity={0.6} />
            {/* center check pops in */}
            <g transform={`translate(${SCX} ${SCY - 10}) scale(${pop})`}>
              <circle cx={0} cy={0} r={14} fill="var(--accent)" />
              <path d="M -6 0 L -1 5 L 7 -5"
                    fill="none" stroke="var(--bg)" strokeWidth={3.5}
                    strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <MonoLabel x={SCX} y={SCY + 50} text="BLUETOOTH ON" size={11}
                       ls={3} weight={700} />
            <MonoLabel x={SCX} y={H - 14} text={window.ScreenData.pairedDevice}
                       size={10} ls={1.5} fill="var(--accent)" op={0.85} />
          </g>
        );
      } },

    // 6. SERVER ERROR — cloud with X / ! glyph + retry hint
    { id: 'network-server-error', label: 'Server down', duration: 2400,
      render: (t) => {
        const shake = Math.sin(t * TAU * 6) * 1.5;
        const blink = Math.floor(t * 3) % 2 === 0 ? 1 : 0.5;
        return (
          <g transform={`translate(${shake} 0)`}>
            <CloudIcon cx={SCX} cy={STATUS_H + 52} scale={1.35}
                       color="var(--eye)" opacity={0.7} />
            {/* ! inside the cloud */}
            <g opacity={blink}>
              <rect x={SCX - 3} y={STATUS_H + 38} width={6} height={20} rx={2}
                    fill="var(--accent)" />
              <circle cx={SCX} cy={STATUS_H + 66} r={3.5} fill="var(--accent)" />
            </g>
            <MonoLabel x={SCX} y={STATUS_H + 110} text="SERVER UNREACHABLE" size={10}
                       ls={2} weight={700} op={0.95} />
            <MonoLabel x={SCX} y={STATUS_H + 128} text="ERROR 503" size={9} ls={3}
                       fill="var(--accent)" op={0.85} />
            <MonoLabel x={SCX} y={H - 16} text="RETRYING IN A MOMENT" size={9} ls={1.5}
                       fill="var(--eye)" op={0.55} />
          </g>
        );
      } },
  ],
};

// Insert `network` right after `boot` in the scene block.
(() => {
  const idx = keys.indexOf('network');
  if (idx >= 0) keys.splice(idx, 1);
  const bootIdx = keys.indexOf('boot');
  // if boot is in the list, drop network just after it; else at start of scenes
  if (bootIdx >= 0) {
    keys.splice(bootIdx + 1, 0, 'network');
  } else {
    let firstScene = keys.length;
    for (let i = 0; i < keys.length; i++) {
      if (cats[keys[i]] && cats[keys[i]].kind === 'scene') {
        firstScene = i;
        break;
      }
    }
    keys.splice(firstScene, 0, 'network');
  }
  window.EMOTION_CATEGORY_KEYS = keys;
})();
