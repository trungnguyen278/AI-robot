// SPDX-License-Identifier: MIT
/* COMMS multi-case pack (v3.1): call + message.

   Like weather, a call or a message has more than one real-world state.
   The host needs to show the RIGHT one:

     call:    incoming (existing) · outgoing · missed
     message: chat (existing)     · incoming · sent

   This file APPENDS those extra cases onto the existing categories — it
   keeps each original arc as variant 0 and never reassigns a whole
   category, so no KEYS order changes. Loaded after the scene packs.

   Each appended case is its own short mini-story (distinct props, motion,
   emotion and caption) so nothing repeats another case.
*/

const {
  W, H, STATUS_H, CY, LX, RX, EYE_W, EYE_H,
  TAU, lerp, clamp, ease, arcPath,
} = window.EmotionCore;
const { EmotionFace } = window.SceneArc;
const cCats = window.EMOTION_CATEGORIES;

function cPhases(t, list) {
  let acc = 0;
  for (const [name, len] of list) {
    if (t < acc + len || name === list[list.length - 1][0]) {
      return { name, p: clamp((t - acc) / len, 0, 1) };
    }
    acc += len;
  }
}
function CFace({ cx, cy, scale, emotion, t }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-W / 2} ${-CY})`}>
      <EmotionFace emotion={emotion} t={t} />
    </g>
  );
}
function CLabel({ text }) {
  return (
    <text x={W / 2} y={H - 12} textAnchor="middle"
          fontFamily="ui-monospace, Menlo, monospace"
          fontSize={11} fontWeight={700}
          fill="var(--eye)" letterSpacing={3} opacity={0.85}>{text}</text>
  );
}

/* a small handset glyph centred at (cx,cy), height ~h */
function Handset(cx, cy, h = 110, shake = 0) {
  const w = h * 0.56;
  return (
    <g transform={`translate(${cx + shake} ${cy})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={10}
            fill="none" stroke="var(--eye)" strokeWidth={4} />
      <rect x={-w / 2 + 7} y={-h / 2 + 12} width={w - 14} height={h - 30} rx={4}
            fill="var(--eye)" opacity={0.18} />
      <circle cx={0} cy={h / 2 - 9} r={4} fill="var(--eye)" />
    </g>
  );
}

const CORNER_X = W - 40, CORNER_Y = STATUS_H + 24;

/* ============================================================
   CALL · OUTGOING — the robot places the call (green)
   raise phone → outgoing ring arcs pulse out → connect →
   talk (voice bars) → hang up → phone drops
============================================================ */
const callOutgoing = {
  id: 'call-outgoing', label: 'Outgoing call', tone: 'green', duration: 13000,
  render: (t) => {
    const ph = cPhases(t, [
      ['idle',    0.08],
      ['raise',   0.10],
      ['shrink',  0.06],
      ['dialing', 0.22],
      ['connect', 0.06],
      ['talk',    0.28],
      ['hangup',  0.05],
      ['drop',    0.09],
      ['done',    0.06],
    ]);
    let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'eager';
    if (ph.name === 'shrink') {
      const e = ease.inOut(ph.p);
      eyeCx = lerp(W / 2, CORNER_X, e); eyeCy = lerp(CY, CORNER_Y, e);
      eyeScale = lerp(1, 0.32, e); eyeEmo = 'curious';
    } else if (['dialing'].includes(ph.name)) { eyeCx = CORNER_X; eyeCy = CORNER_Y; eyeScale = 0.32; eyeEmo = 'curious'; }
    else if (['connect', 'talk'].includes(ph.name)) { eyeCx = CORNER_X; eyeCy = CORNER_Y; eyeScale = 0.32; eyeEmo = 'happy'; }
    else if (ph.name === 'hangup' || ph.name === 'drop') { eyeCx = CORNER_X; eyeCy = CORNER_Y; eyeScale = 0.32; eyeEmo = 'satisfied'; }
    else if (ph.name === 'done') eyeEmo = 'satisfied';

    let phoneY = CY + 6;
    if (ph.name === 'idle') phoneY = H + 80;
    else if (ph.name === 'raise') phoneY = lerp(H + 80, CY + 6, ease.out(ph.p));
    else if (ph.name === 'drop') phoneY = lerp(CY + 6, H + 80, ease.in(ph.p));
    const showPhone = ph.name !== 'done';

    return (
      <g>
        {/* outgoing ring arcs radiate from the phone */}
        {ph.name === 'dialing' && [0, 1, 2].map((i) => {
          const p = ((t * 1.3) + i * 0.33) % 1;
          return (
            <g key={i} opacity={(1 - p) * 0.7}>
              <path d={arcPath(W / 2 + 30, CY - 24, 30 + p * 50, 18 + p * 30, false)}
                    fill="none" stroke="var(--accent)" strokeWidth={3} />
            </g>
          );
        })}
        {/* voice bars while talking */}
        {ph.name === 'talk' && [0, 1, 2, 3, 4].map((i) => {
          const hh = 8 + Math.abs(Math.sin(t * TAU * 3 + i)) * 26;
          return (
            <rect key={i} x={W / 2 - 44 + i * 20} y={CY + 50 - hh}
                  width={10} height={hh} rx={4} fill="var(--accent)" opacity={0.8} />
          );
        })}
        {showPhone && Handset(W / 2, phoneY, 110)}
        {/* connect spark */}
        {ph.name === 'connect' && (
          <circle cx={W / 2} cy={CY + 6} r={20 + ph.p * 40}
                  fill="none" stroke="var(--accent)" strokeWidth={3}
                  opacity={1 - ph.p} />
        )}
        <CFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
        <CLabel text={
          ph.name === 'idle'    ? 'CALL THEM' :
          ph.name === 'raise'   ? 'DIALING…' :
          ph.name === 'shrink'  ? 'RINGING…' :
          ph.name === 'dialing' ? 'RINGING…' :
          ph.name === 'connect' ? 'CONNECTED' :
          ph.name === 'talk'    ? 'TALKING' :
          ph.name === 'hangup'  ? 'BYE!' :
                                  'CALL ENDED'
        } />
      </g>
    );
  },
};

/* ============================================================
   CALL · MISSED — the robot is distracted, rings go unanswered (red)
   phone rings + vibrates → eyes drift away (didn't notice) →
   rings stop → big MISSED CALL ×1 badge → guilty look
============================================================ */
const callMissed = {
  id: 'call-missed', label: 'Missed call', tone: 'red', duration: 12000,
  render: (t) => {
    const ph = cPhases(t, [
      ['quiet',   0.08],
      ['ringIn',  0.10],
      ['ringing', 0.30],
      ['stop',    0.08],
      ['badge',   0.28],
      ['notice',  0.10],
      ['done',    0.06],
    ]);
    const ringing = ph.name === 'ringing';
    const shake = ringing ? Math.sin(t * TAU * 14) * 5 : 0;

    // eyes stay centred but look the WRONG way during ringing
    let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'steady';
    let pupil = 0;
    if (ph.name === 'ringing') { eyeEmo = 'sleepy'; pupil = -16; }    // looking away
    else if (ph.name === 'stop') eyeEmo = 'steady';
    else if (ph.name === 'badge') eyeEmo = 'surprised';
    else if (ph.name === 'notice' || ph.name === 'done') eyeEmo = 'sad';

    let phoneY = CY + 6, showPhone = false;
    if (ph.name === 'ringIn') { phoneY = lerp(H + 80, CY + 6, ease.out(ph.p)); showPhone = true; }
    else if (ph.name === 'ringing') { showPhone = true; }
    else if (ph.name === 'stop') { phoneY = lerp(CY + 6, H + 80, ease.in(ph.p)); showPhone = true; }

    return (
      <g>
        {/* incoming ring arcs (both sides) while ringing */}
        {ringing && [0, 1].map((i) => {
          const p = ((t * 1.6) + i * 0.5) % 1;
          return (
            <g key={i} opacity={(1 - p) * 0.7}
               stroke="var(--accent)" strokeWidth={3} fill="none">
              <path d={`M ${W / 2 - 46 - p * 16} ${CY - 8} q -10 14 0 28`} />
              <path d={`M ${W / 2 + 46 + p * 16} ${CY - 8} q 10 14 0 28`} />
            </g>
          );
        })}
        {showPhone && Handset(W / 2, phoneY, 104, shake)}

        {/* MISSED CALL badge */}
        {(ph.name === 'badge' || ph.name === 'notice' || ph.name === 'done') && (
          <g transform={`translate(${W / 2} ${CY})`}>
            <rect x={-86} y={-26} width={172} height={52} rx={10}
                  fill="var(--accent)" opacity={0.92} />
            <text x={0} y={-4} textAnchor="middle"
                  fontFamily="ui-monospace, Menlo, monospace"
                  fontSize={14} fontWeight={800} fill="var(--bg)" letterSpacing={1}>MISSED CALL</text>
            <text x={0} y={15} textAnchor="middle"
                  fontFamily="ui-monospace, Menlo, monospace"
                  fontSize={11} fontWeight={700} fill="var(--bg)" opacity={0.8}>× 1 · just now</text>
          </g>
        )}

        <CFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
        {/* pupils glance away during ringing */}
        {ph.name === 'ringing' && (
          <g>
            <circle cx={LX + pupil} cy={CY - 6} r={13} fill="var(--bg)" />
            <circle cx={RX + pupil} cy={CY - 6} r={13} fill="var(--bg)" />
          </g>
        )}
        <CLabel text={
          ph.name === 'quiet'   ? '— — —' :
          ph.name === 'ringIn'  ? 'INCOMING…' :
          ph.name === 'ringing' ? 'RING… RING…' :
          ph.name === 'stop'    ? '…NO ANSWER' :
          ph.name === 'badge'   ? 'MISSED CALL ×1' :
                                  'OOPS — MISSED IT'
        } />
      </g>
    );
  },
};

/* ============================================================
   MESSAGE · INCOMING — one ping arrives, gets read (cyan)
   bubble flies in from left + ping rings + unread badge →
   the robot reads (pupils scan) → badge clears to READ ✓
============================================================ */
const messageIncoming = {
  id: 'message-incoming', label: 'New message', tone: 'cyan', duration: 11000,
  render: (t) => {
    const ph = cPhases(t, [
      ['idle',    0.10],
      ['ping',    0.12],
      ['shrink',  0.06],
      ['read',    0.42],
      ['mark',    0.16],
      ['grow',    0.07],
      ['done',    0.07],
    ]);
    let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'steady';
    let scan = 0;
    if (ph.name === 'ping') eyeEmo = 'curious';
    else if (ph.name === 'shrink') {
      const e = ease.inOut(ph.p);
      eyeCx = lerp(W / 2, CORNER_X, e); eyeCy = lerp(CY, CORNER_Y, e);
      eyeScale = lerp(1, 0.3, e); eyeEmo = 'curious';
    } else if (ph.name === 'read') {
      eyeCx = CORNER_X; eyeCy = CORNER_Y; eyeScale = 0.3; eyeEmo = 'happy';
      scan = Math.sin(t * TAU * 2) * 4;
    } else if (ph.name === 'mark') { eyeCx = CORNER_X; eyeCy = CORNER_Y; eyeScale = 0.3; eyeEmo = 'happy'; }
    else if (ph.name === 'grow') {
      const e = ease.inOut(ph.p);
      eyeCx = lerp(CORNER_X, W / 2, e); eyeCy = lerp(CORNER_Y, CY, e);
      eyeScale = lerp(0.3, 1, e); eyeEmo = 'happy';
    } else if (ph.name === 'done') eyeEmo = 'happy';

    const bx = ph.name === 'ping' ? lerp(-150, 30, ease.out(ph.p)) : 30;
    const showBubble = ['ping', 'shrink', 'read', 'mark'].includes(ph.name);
    const unread = ['ping', 'shrink', 'read'].includes(ph.name);

    return (
      <g>
        {/* ping rings on arrival */}
        {ph.name === 'ping' && [0, 1].map((i) => {
          const p = ((t * 1.4) + i * 0.5) % 1;
          return (
            <circle key={i} cx={50} cy={STATUS_H + 56} r={10 + p * 28}
                    fill="none" stroke="var(--accent)" strokeWidth={2}
                    opacity={(1 - p) * 0.7} />
          );
        })}
        {/* the message bubble */}
        {showBubble && (
          <g transform={`translate(${bx} ${STATUS_H + 44})`}>
            <rect x={0} y={0} width={210} height={66} rx={12} fill="var(--eye)" />
            <circle cx={22} cy={20} r={10} fill="var(--bg)" />
            <text x={22} y={24} textAnchor="middle"
                  fontFamily="ui-monospace, Menlo, monospace" fontSize={11}
                  fontWeight={800} fill="var(--eye)">@</text>
            <rect x={40} y={13} width={120} height={5} rx={2} fill="var(--bg)" opacity={0.85} />
            {[0, 1, 2].map((i) => (
              <rect key={i} x={16} y={34 + i * 10}
                    width={i === 2 ? 110 : 178} height={4} rx={2}
                    fill="var(--bg)" opacity={0.55} />
            ))}
          </g>
        )}
        {/* unread / read badge top-right */}
        <g transform={`translate(${W - 30} ${STATUS_H + 24})`}>
          {unread ? (
            <g>
              <circle cx={0} cy={0} r={11} fill="var(--accent)" />
              <text x={0} y={4} textAnchor="middle"
                    fontFamily="ui-monospace, Menlo, monospace" fontSize={12}
                    fontWeight={800} fill="var(--bg)">1</text>
            </g>
          ) : (ph.name === 'mark' || ph.name === 'grow' || ph.name === 'done') ? (
            <text x={0} y={4} textAnchor="middle"
                  fontFamily="ui-monospace, Menlo, monospace" fontSize={12}
                  fontWeight={800} fill="var(--accent)">✓</text>
          ) : null}
        </g>
        <CFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
        {ph.name === 'read' && (
          <g>
            <circle cx={CORNER_X - 8 + scan} cy={CORNER_Y - 1} r={4} fill="var(--bg)" />
            <circle cx={CORNER_X + 8 + scan} cy={CORNER_Y - 1} r={4} fill="var(--bg)" />
          </g>
        )}
        <CLabel text={
          ph.name === 'idle'   ? '— — —' :
          ph.name === 'ping'   ? 'PING! · 1 NEW' :
          ph.name === 'shrink' ? 'LET ME SEE' :
          ph.name === 'read'   ? 'READING…' :
          ph.name === 'mark'   ? 'READ ✓' :
                                 'GOT IT'
        } />
      </g>
    );
  },
};

/* ============================================================
   MESSAGE · SENT — the robot composes & fires one off (rose)
   typing dots build a bubble → it WHOOSHES off to the right with
   speed lines → DELIVERED ✓✓
============================================================ */
const messageSent = {
  id: 'message-sent', label: 'Sent message', tone: 'rose', duration: 11000,
  render: (t) => {
    const ph = cPhases(t, [
      ['think',   0.10],
      ['shrink',  0.06],
      ['typing',  0.34],
      ['whoosh',  0.14],
      ['delivered', 0.22],
      ['grow',    0.07],
      ['done',    0.07],
    ]);
    let eyeCx = W / 2, eyeCy = CY, eyeScale = 1, eyeEmo = 'thinking';
    if (ph.name === 'shrink') {
      const e = ease.inOut(ph.p);
      eyeCx = lerp(W / 2, 42, e); eyeCy = lerp(CY, CORNER_Y, e);
      eyeScale = lerp(1, 0.3, e); eyeEmo = 'thinking';
    } else if (ph.name === 'typing') { eyeCx = 42; eyeCy = CORNER_Y; eyeScale = 0.3; eyeEmo = 'focused'; }
    else if (ph.name === 'whoosh') { eyeCx = 42; eyeCy = CORNER_Y; eyeScale = 0.3; eyeEmo = 'excited'; }
    else if (ph.name === 'delivered') { eyeCx = 42; eyeCy = CORNER_Y; eyeScale = 0.3; eyeEmo = 'satisfied'; }
    else if (ph.name === 'grow') {
      const e = ease.inOut(ph.p);
      eyeCx = lerp(42, W / 2, e); eyeCy = lerp(CORNER_Y, CY, e);
      eyeScale = lerp(0.3, 1, e); eyeEmo = 'satisfied';
    } else if (ph.name === 'done') eyeEmo = 'satisfied';

    const compose = ph.name === 'typing';
    const bubbleW = compose ? lerp(40, 150, ease.out(ph.p)) : 150;
    let bx = W / 2 - 30;
    if (ph.name === 'whoosh') bx = lerp(W / 2 - 30, W + 160, ease.in(ph.p));

    return (
      <g>
        {/* compose / outgoing bubble (mine = accent) */}
        {['typing', 'whoosh'].includes(ph.name) && (
          <g transform={`translate(${bx} ${CY - 12})`}>
            <rect x={0} y={-16} width={bubbleW} height={32} rx={16} fill="var(--accent)" />
            {compose ? (
              [0, 1, 2].map((i) => {
                const dp = ((t * 2) + i * 0.3) % 1;
                return (
                  <circle key={i} cx={18 + i * 16} cy={0} r={3.5} fill="var(--bg)"
                          opacity={0.4 + Math.sin(dp * TAU) * 0.4} />
                );
              })
            ) : (
              [0, 1].map((i) => (
                <rect key={i} x={14} y={-6 + i * 8} width={bubbleW - 40} height={4} rx={2}
                      fill="var(--bg)" opacity={0.7} />
              ))
            )}
          </g>
        )}
        {/* whoosh speed lines */}
        {ph.name === 'whoosh' && [0, 1, 2].map((i) => (
          <line key={i} x1={bx - 30 - i * 22} y1={CY - 12 + (i - 1) * 8}
                x2={bx - 60 - i * 22} y2={CY - 12 + (i - 1) * 8}
                stroke="var(--accent)" strokeWidth={3} strokeLinecap="round"
                opacity={0.6 - i * 0.15} />
        ))}
        {/* delivered receipt */}
        {(ph.name === 'delivered' || ph.name === 'grow' || ph.name === 'done') && (
          <g transform={`translate(${W / 2} ${CY})`}>
            <text x={0} y={0} textAnchor="middle"
                  fontFamily="ui-monospace, Menlo, monospace" fontSize={26}
                  fontWeight={800} fill="var(--accent)" letterSpacing={2}>✓✓</text>
          </g>
        )}
        <CFace cx={eyeCx} cy={eyeCy} scale={eyeScale} emotion={eyeEmo} t={t} />
        <CLabel text={
          ph.name === 'think'     ? 'REPLY…' :
          ph.name === 'shrink'    ? 'COMPOSING' :
          ph.name === 'typing'    ? 'TYPING…' :
          ph.name === 'whoosh'    ? 'SENT! WHOOSH' :
          ph.name === 'delivered' ? 'DELIVERED ✓✓' :
                                    'MESSAGE SENT'
        } />
      </g>
    );
  },
};

/* --- append the extra cases (keep each original arc as variant 0) --- */
if (cCats.call) {
  if (cCats.call.variants[0]) cCats.call.variants[0].label = 'Incoming call';
  cCats.call.variants.push(callOutgoing, callMissed);
  cCats.call.desc = 'One case per call state: incoming · outgoing · missed.';
}
if (cCats.message) {
  if (cCats.message.variants[0]) cCats.message.variants[0].label = 'Chat thread';
  cCats.message.variants.push(messageIncoming, messageSent);
  cCats.message.desc = 'One case per message state: chat · incoming · sent.';
}
