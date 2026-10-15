// SPDX-License-Identifier: MIT
/* Boot — the power-on status flow. A single brand-clean sequence:

        boot-poweron  →  boot-credits  →  boot-checks-personal  →  boot-ready-personal
        (2.4 s)          (4.5 s)           (4.2 s)                  (3.0 s)
        cyan             cyan              cyan                     cyan

   No school/company branding appears anywhere on screen. The credits'
   monogram, name, role and tagline come from window.ScreenData
   (screen.jsx), which the host fills in. The viewer exposes every stage
   as an ordinary variant so the flow can be previewed end-to-end.
*/

const {
  W, H, STATUS_H, CY, GAP, LX, RX, EYE_W, EYE_H, EYE_RX,
  TAU, lerp, clamp, wrap, ease, pulse, arcPath,
} = window.EmotionCore;

const cats = window.EMOTION_CATEGORIES;
const keys = window.EMOTION_CATEGORY_KEYS;

const SCX = W / 2;
const SCY = STATUS_H + (H - STATUS_H) / 2;

// ---- Credits monogram (personal-flow brand-free mark) --------------
// A small rounded square holding the credits' initials. Used in the
// `boot-ready-personal` variant for visual continuity with
// `boot-credits`. Contains no school/company text.
function Monogram({ cx = SCX, cy = SCY - 6, scale = 1, opacity = 1, color = 'currentColor' }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`} opacity={opacity}>
      <rect x={-22} y={-22} width={44} height={44} rx={10}
            fill="none" stroke={color} strokeWidth={2.5} />
      <text x={0} y={7} textAnchor="middle"
            fontFamily="ui-monospace, Menlo, monospace"
            fontWeight={800} fontSize={20} letterSpacing={1.5}
            fill={color}>{window.ScreenData.credits.monogram}</text>
    </g>
  );
}

// ---- shared render bodies -----------------------------------------
// Self-test checklist. `footer` is drawn at the bottom — pass any string
// (use empty string for a fully brand-clean render).
function renderSelfTest(t, footer) {
  const ITEMS = [
    { label: 'DISPLAY',      w: 64 },
    { label: 'AUDIO',        w: 52 },
    { label: 'MIC',          w: 38 },
    { label: 'NETWORK',      w: 66 },
    { label: 'AI CORE',      w: 60 },
  ];
  return (
    <g>
      <text x={SCX} y={STATUS_H + 22} textAnchor="middle"
            fontFamily="ui-monospace, Menlo, monospace"
            fontSize={11} letterSpacing={3}
            fill="var(--eye)" opacity={0.85}>SYSTEM CHECK</text>
      <line x1={48} y1={STATUS_H + 30} x2={W - 48} y2={STATUS_H + 30}
            stroke="var(--eye)" strokeWidth={0.5} opacity={0.35} />
      {ITEMS.map((it, i) => {
        const start = i * 0.15;
        const showT = clamp((t - start) / 0.1, 0, 1);
        const okT = clamp((t - start - 0.1) / 0.06, 0, 1);
        if (showT === 0) return null;
        const y = STATUS_H + 50 + i * 26;
        const rowOp = ease.out(showT);
        return (
          <g key={it.label} opacity={rowOp}>
            <text x={48} y={y + 4}
                  fontFamily="ui-monospace, Menlo, monospace"
                  fontSize={11} letterSpacing={1.5}
                  fill="var(--eye)">{it.label}</text>
            <line x1={48 + it.w + 4} y1={y} x2={W - 80} y2={y}
                  stroke="var(--eye)" strokeWidth={1}
                  strokeDasharray="2 3" opacity={0.4} />
            {okT < 1 && (
              <g transform={`translate(${W - 64} ${y - 6}) rotate(${t * 720})`}>
                <path d="M 0 0 a 8 8 0 1 1 -0.001 0"
                      fill="none" stroke="var(--accent)" strokeWidth={2}
                      strokeDasharray="14 30" />
              </g>
            )}
            {okT >= 1 && (
              <g>
                <text x={W - 56} y={y + 4}
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontSize={11} fontWeight={700} letterSpacing={1}
                      fill="var(--accent)">OK</text>
                <path d={`M ${W - 32} ${y - 2} l 3 4 l 7 -8`}
                      fill="none" stroke="var(--accent)" strokeWidth={2}
                      strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
          </g>
        );
      })}
      {footer && (
        <text x={SCX} y={H - 8} textAnchor="middle"
              fontFamily="ui-monospace, Menlo, monospace"
              fontSize={9} letterSpacing={2}
              fill="var(--eye)" opacity={0.55}>{footer}</text>
      )}
    </g>
  );
}

// Ready/progress screen. `Mark` is the component to draw at the top
// (pass `null` to render no mark).
function renderReady(t, Mark) {
  const fill = clamp(t / 0.7, 0, 1);
  const stampT = clamp((t - 0.75) / 0.15, 0, 1);
  const stampScale = lerp(1.6, 1, ease.out(stampT));
  const barW = W - 96;
  const barX = (W - barW) / 2;
  const barY = SCY + 8;
  return (
    <g>
      {Mark && <Mark cx={SCX} cy={STATUS_H + 38} scale={0.55}
                     opacity={0.95} color="var(--eye)" />}
      <rect x={barX} y={barY} width={barW} height={10} rx={3}
            fill="none" stroke="var(--eye)" strokeWidth={1.5} opacity={0.7} />
      <rect x={barX + 2} y={barY + 2}
            width={(barW - 4) * fill} height={6} rx={2}
            fill="var(--accent)" />
      <text x={SCX} y={barY + 30} textAnchor="middle"
            fontFamily="ui-monospace, Menlo, monospace"
            fontSize={11} letterSpacing={1}
            fill="var(--eye)" opacity={0.75}>
        {Math.round(fill * 100).toString().padStart(3, '0')}%
      </text>
      {stampT > 0.02 && (
        <g transform={`translate(${SCX} ${H - 24}) scale(${stampScale})`}
           opacity={stampT}>
          <rect x={-44} y={-12} width={88} height={22} rx={3}
                fill="none" stroke="var(--accent)" strokeWidth={2.5} />
          <text x={0} y={5} textAnchor="middle"
                fontFamily="ui-monospace, Menlo, monospace"
                fontWeight={800} fontSize={14} letterSpacing={4}
                fill="var(--accent)">READY</text>
        </g>
      )}
    </g>
  );
}

// ---- variants ---------------------------------------------------
cats.boot = {
  label: 'Boot',
  desc: 'Brand-clean power-on sequence.',
  kind: 'status',
  variants: [

    // 1. POWER-ON — single bright dot expands into two open eyes
    { id: 'boot-poweron', label: 'Power on', duration: 2400,
      render: (t) => {
        // 0.00–0.20: tiny center dot grows
        // 0.20–0.50: stretches horizontally
        // 0.50–0.80: splits into two eye blocks
        // 0.80–1.00: settles to default eye proportions
        const phase = t;
        let dotR = 0, barW = 0, barH = 0, split = 0;
        if (phase < 0.2) {
          dotR = lerp(0.5, 8, ease.out(phase / 0.2));
          barW = dotR * 2;
          barH = dotR * 2;
        } else if (phase < 0.5) {
          const p = (phase - 0.2) / 0.3;
          dotR = 0;
          barW = lerp(16, GAP + EYE_W, ease.inOut(p));
          barH = lerp(16, 14, ease.inOut(p));
        } else if (phase < 0.8) {
          const p = (phase - 0.5) / 0.3;
          barW = GAP + EYE_W;
          barH = lerp(14, EYE_H * 0.6, ease.inOut(p));
          split = ease.inOut(p);
        } else {
          const p = (phase - 0.8) / 0.2;
          barW = GAP + EYE_W;
          barH = lerp(EYE_H * 0.6, EYE_H, ease.inOut(p));
          split = 1;
        }
        // glow flicker on first frames
        const flicker = phase < 0.05 ? 0.3 + Math.random() * 0.7 : 1;

        if (split === 0) {
          // single horizontal slit
          return (
            <g opacity={flicker}>
              <rect x={SCX - barW / 2} y={CY - barH / 2}
                    width={barW} height={barH}
                    rx={Math.min(EYE_RX, barH / 2)}
                    fill="var(--eye)" />
            </g>
          );
        }
        // two eye blocks splitting outward
        const leftCx = lerp(SCX, LX, split);
        const rightCx = lerp(SCX, RX, split);
        const halfW = lerp(barW / 2, EYE_W / 2, split);
        return (
          <g opacity={flicker}>
            <rect x={leftCx - halfW} y={CY - barH / 2}
                  width={halfW * 2} height={barH}
                  rx={Math.min(EYE_RX, barH / 2)}
                  fill="var(--eye)" />
            <rect x={rightCx - halfW} y={CY - barH / 2}
                  width={halfW * 2} height={barH}
                  rx={Math.min(EYE_RX, barH / 2)}
                  fill="var(--eye)" />
          </g>
        );
      } },

    // 2. CREDITS — purely personal splash, no brand marks
    { id: 'boot-credits', label: 'Credits', duration: 4500,
      render: (t) => {
        // Timeline:
        //   0.00–0.30  monogram (the credits' initials) scales in
        //   0.20–0.50  ring sweeps around it
        //   0.30–0.65  name (typewriter)
        //   0.55–0.85  role line fades in
        //   0.65–1.00  bottom tagline + caret
        const monoIn   = clamp(t / 0.30, 0, 1);
        const sweep    = clamp((t - 0.20) / 0.30, 0, 1);
        const nameP    = clamp((t - 0.30) / 0.35, 0, 1);
        const roleP    = clamp((t - 0.55) / 0.30, 0, 1);
        const taglineP = clamp((t - 0.65) / 0.30, 0, 1);
        const caretOn  = Math.floor(t * 4) % 2 === 0;

        const reveal = (str, p) => str.slice(0, Math.floor(p * str.length + 0.0001));
        const { monogram: MONOGRAM, name: NAME, role: ROLE, tagline: TAG } =
          window.ScreenData.credits;

        // Monogram center
        const mY     = STATUS_H + 56;
        const monoS  = 1.0 * ease.out(monoIn);

        // Layout
        const nameY  = mY + 56;
        const roleY  = nameY + 18;
        const tagY   = H - 14;

        // Sweep arc around the monogram (decorative)
        const sweepAngle = sweep * TAU;
        const SR = 36;
        return (
          <g>
            {/* monogram: a rounded square with the initials inside */}
            <g transform={`translate(${SCX} ${mY}) scale(${monoS})`} opacity={ease.out(monoIn)}>
              <rect x={-28} y={-28} width={56} height={56} rx={12}
                    fill="none" stroke="var(--eye)" strokeWidth={2.5} />
              <text x={0} y={9} textAnchor="middle"
                    fontFamily="ui-monospace, Menlo, monospace"
                    fontWeight={800} fontSize={26} letterSpacing={2}
                    fill="var(--eye)">{MONOGRAM}</text>
            </g>

            {/* decorative sweep arc */}
            {sweep > 0.02 && (
              <path
                d={`M ${SCX + Math.cos(-Math.PI / 2) * SR}
                      ${mY + Math.sin(-Math.PI / 2) * SR}
                    A ${SR} ${SR} 0
                      ${sweepAngle > Math.PI ? 1 : 0} 1
                      ${SCX + Math.cos(-Math.PI / 2 + sweepAngle) * SR}
                      ${mY + Math.sin(-Math.PI / 2 + sweepAngle) * SR}`}
                fill="none" stroke="var(--accent)" strokeWidth={2.5}
                strokeLinecap="round" />
            )}
            {/* tiny dot at the leading edge of the sweep */}
            {sweep > 0.02 && sweep < 1 && (
              <circle cx={SCX + Math.cos(-Math.PI / 2 + sweepAngle) * SR}
                      cy={mY + Math.sin(-Math.PI / 2 + sweepAngle) * SR}
                      r={3} fill="var(--accent)" />
            )}

            {/* the name (typewriter) */}
            {nameP > 0 && (
              <g>
                <text x={SCX} y={nameY} textAnchor="middle"
                      fontFamily="ui-monospace, Menlo, monospace"
                      fontWeight={700} fontSize={13} letterSpacing={2}
                      fill="var(--eye)">{reveal(NAME, nameP)}</text>
                {nameP < 1 && caretOn && (
                  <rect x={SCX - 1} y={nameY - 10} width={2} height={12}
                        fill="var(--eye)"
                        transform={`translate(${(reveal(NAME, nameP).length * 4.5) - (NAME.length * 4.5) / 2}, 0)`} />
                )}
              </g>
            )}

            {/* role */}
            {roleP > 0 && (
              <text x={SCX} y={roleY} textAnchor="middle"
                    fontFamily="ui-monospace, Menlo, monospace"
                    fontSize={9} letterSpacing={1.5}
                    fill="var(--accent)" opacity={ease.out(roleP) * 0.9}>
                {ROLE}
              </text>
            )}

            {/* bottom tagline */}
            {taglineP > 0 && (
              <text x={SCX} y={tagY} textAnchor="middle"
                    fontFamily="ui-monospace, Menlo, monospace"
                    fontSize={9} letterSpacing={3}
                    fill="var(--eye)" opacity={ease.out(taglineP) * 0.6}>
                {`— ${reveal(TAG, taglineP)} —`}
              </text>
            )}
          </g>
        );
      } },

    // 3. CHECKS — self-test (brand-clean footer)
    { id: 'boot-checks-personal', label: 'Self-test', duration: 4200,
      render: (t) => renderSelfTest(t, 'v2.0') },

    // 4. READY — progress + READY stamp, credits monogram at top
    { id: 'boot-ready-personal', label: 'Ready', duration: 3000,
      render: (t) => renderReady(t, Monogram) },
  ],
};

// Insert `boot` at the top of the scene block so it lines up first in
// the scene rail (it's a power-on screen — the most natural ordering).
(() => {
  const idx = keys.indexOf('boot');
  if (idx >= 0) keys.splice(idx, 1);
  // find first scene key
  let firstScene = keys.length;
  for (let i = 0; i < keys.length; i++) {
    if (cats[keys[i]] && cats[keys[i]].kind === 'scene') {
      firstScene = i;
      break;
    }
  }
  keys.splice(firstScene, 0, 'boot');
  window.EMOTION_CATEGORY_KEYS = keys;
})();
