// SPDX-License-Identifier: MIT
/* The renderer's side of the screen protocol (protocol/screen/README.md): it receives
   what to show from the robot software over a WebSocket, and reports the screen and
   its taps. When the connection drops, the face keeps playing the last state and the
   link reconnects; when the software serves a new revision of these files, the page
   reloads itself to run it. */

import { EXPRESSIONS } from './expressions.js';
import { SCENES } from './scenes/index.js';

export const PROTOCOL = 1;

/** Apply one message from the software to `player` (player.js). Returns whether the
    message was understood; unknown types and fields are ignored, as the protocol
    requires. */
export function apply(message, player) {
  const animator = player.animator;
  // The software's clock, so that the times it sends (a timer's end) read right.
  if (Number.isFinite(message?.time)) player.offset = message.time - Date.now() / 1000;
  switch (message?.type) {
    case 'hello':
      return true;
    case 'state': {
      const face = message.face ?? {};
      const status = message.status ?? {};
      const scene = message.scene ?? null;
      const expression = typeof face.expression === 'string' ? face.expression : '';
      animator.set(expression, typeof face.tone === 'string' ? face.tone : null, player.now());
      const data = scene && typeof scene.data === 'object' && scene.data !== null ? scene.data : {};
      animator.setScene(scene && typeof scene.name === 'string' ? scene.name : null, data, player.now());
      player.status = {
        battery: Number.isFinite(status.battery) ? status.battery : null,
        charging: typeof status.charging === 'boolean' ? status.charging : null,
      };
      return true;
    }
    case 'look': {
      const target = message.target;
      animator.look(target && Number.isFinite(target.x) && Number.isFinite(target.y) ? target : null);
      return true;
    }
    case 'voice':
      animator.voice(Number.isFinite(message.level) ? message.level : 0, player.now());
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
  constructor(player, { url = defaultUrl(), onChange = () => {}, reload = () => location.reload() } = {}) {
    this.player = player;
    this.url = url;
    this.onChange = onChange;
    this.reload = reload;
    this.revision = null; // of the renderer's files, as the software served them
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
        scenes: Object.keys(SCENES),
      });
    };
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message?.type === 'hello') this.hello(message);
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

  /** Check the software's greeting: its protocol, and the revision of the files it
      serves. A new revision means this page is out of date: it reloads. */
  hello(message) {
    if (message.protocol !== PROTOCOL) {
      console.warn(`screen protocol ${message.protocol} from the software; this page speaks ${PROTOCOL}`);
    }
    if (typeof message.revision !== 'string' || !message.revision) return;
    if (this.revision && message.revision !== this.revision) this.reload();
    this.revision = message.revision;
  }

  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  /** Report a tap at `x`, `y`: fractions of the screen's width and height. */
  touch(x, y) {
    this.send({ type: 'touch', x, y });
  }
}
