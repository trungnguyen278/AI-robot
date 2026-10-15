// SPDX-License-Identifier: MIT
/* The renderer's side of the screen protocol (protocol/screen/README.md): it receives
   what to show from the robot software over a WebSocket, and reports the screen and
   its taps. When the connection drops, the face keeps playing the last state and the
   link reconnects. */

import { EXPRESSIONS } from './expressions.js';

export const PROTOCOL = 1;

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

/** Apply one message from the software to `player` (player.js). Returns whether the
    message was understood; unknown types and fields are ignored, as the protocol
    requires. */
export function apply(message, player) {
  const animator = player.animator;
  switch (message?.type) {
    case 'hello':
      return true;
    case 'state': {
      const face = message.face ?? {};
      const status = message.status ?? {};
      const expression = typeof face.expression === 'string' ? face.expression : '';
      animator.set(expression, typeof face.tone === 'string' ? face.tone : null, player.now());
      player.status = {
        battery: finite(status.battery) ? status.battery : null,
        charging: typeof status.charging === 'boolean' ? status.charging : null,
      };
      return true;
    }
    case 'look': {
      const target = message.target;
      animator.look(target && finite(target.x) && finite(target.y) ? target : null);
      return true;
    }
    case 'voice':
      animator.voice(finite(message.level) ? message.level : 0, player.now());
      return true;
    default:
      return false;
  }
}

/** Where the page was loaded from, with the protocol's path. */
export function defaultUrl() {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}/ws`;
}

export class Link {
  constructor(player, { url = defaultUrl(), onChange = () => {} } = {}) {
    this.player = player;
    this.url = url;
    this.onChange = onChange;
    this.connected = false;
    this.delay = 0.5;
    this.socket = null;
  }

  connect() {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.delay = 0.5;
      this.connected = true;
      this.onChange(true);
      const { width, height, shape } = this.player.layout;
      this.send({
        type: 'ready',
        protocol: PROTOCOL,
        width: Math.round(width),
        height: Math.round(height),
        shape,
        expressions: Object.keys(EXPRESSIONS),
      });
    };
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message?.type === 'hello' && message.protocol !== PROTOCOL) {
        console.warn(`screen protocol ${message.protocol} from the software; this page speaks ${PROTOCOL}`);
      }
      apply(message, this.player);
    };
    socket.onclose = () => {
      if (this.connected) this.onChange(false);
      this.connected = false;
      setTimeout(() => this.connect(), this.delay * 1000);
      this.delay = Math.min(this.delay * 2, 5);
    };
    socket.onerror = () => socket.close();
  }

  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  /** Report a tap at `x`, `y`: fractions of the screen's width and height. */
  touch(x, y) {
    this.send({ type: 'touch', x, y });
  }
}
