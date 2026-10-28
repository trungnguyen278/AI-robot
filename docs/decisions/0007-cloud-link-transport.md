# 0007 — Cloud link transport: one WebSocket over TLS, opened by the robot

- **Status:** Superseded by [0009](0009-cloud-link-webrtc.md)
- **Date:** 2026-10-16

## Context

- The robot's core AI runs in `ai-robot-server`. The link between them carries speech both ways, control messages and capability calls. Its requirements are in [`protocol/cloud/requirements.md`](https://github.com/trungnguyen278/ai-platform/blob/main/protocols/cloud/requirements.md), and this is their decision 1:
  - the robot opens the connection, outbound only (SES-1);
  - everything is encrypted (SEC-1);
  - both sides detect a dead connection (SES-3), and the robot reconnects with backoff (SES-4).
- The robot moves around a home on Wi-Fi, so the quality of the link changes from room to room.
- The two directions of a turn behave differently:
  - The user's speech is streamed as it is spoken, so any delay on the way up delays the answer.
  - The answer can be sent faster than it plays, and the robot buffers it (PERF-5), so short delays on the way down are hidden.
- How voice devices and clients reach their AI service:

| Project | Transport | Notes |
|---|---|---|
| Previous generation | One WebSocket per device | JSON control messages and binary Opus frames; a 30 s heartbeat. |
| xiaozhi-esp32 | A WebSocket, or MQTT plus UDP | The UDP audio is encrypted with AES-CTR, with keys sent over MQTT. Its documentation rates this option lower for reliability and for getting through firewalls, in exchange for lower latency. |
| Gemini Live API | A stateful WebSocket | Raw 16-bit PCM: 16 kHz in, 24 kHz out. |
| OpenAI Realtime API | WebRTC, a WebSocket, or SIP | A WebSocket is "a great choice for connecting to the OpenAI Realtime API in server-to-server applications"; "For browser and mobile clients, we recommend connecting via WebRTC". |
| Pipecat | WebRTC or a WebSocket | WebRTC for any client-to-server voice application. Over TCP, a lost packet holds up everything behind it; Opus's loss recovery is built for UDP; WebRTC handles timestamps and jitter buffering, and browsers wire echo cancellation into it. |
| FreeSWITCH Verto | JSON-RPC over a WebSocket, for signalling | The media flows separately, over SRTP negotiated with ICE (WebRTC). |

## Decision

1. **One WebSocket ([RFC 6455](https://www.rfc-editor.org/rfc/rfc6455)) over TLS, opened by the robot.**
   - The server's address comes from the robot's configuration (`wss://`, port 443).
   - One connection per robot carries the JSON messages and the audio frames of [ADR-0008](0008-cloud-link-messages.md).
   - How the robot proves its identity during the opening handshake is decision 5 of the requirements.
2. **WebSocket pings tell whether the connection is alive.** The robot pings when nothing has arrived for a while, and closes the connection if no pong comes back; the server does the same on its side. Starting value, in configuration: 10 s.
3. **No per-message compression.** Audio is already compressed and control messages are small, so compression would only cost CPU on the Pi.
4. **Audio stays separable.**
   - On the robot, audio packets go through an interface of their own. For now they become binary frames on the same WebSocket.
   - Each packet carries the RTP-like fields of ADR-0008 (stream, format, sequence, timestamp). Neither the robot's jitter buffer nor the server's pipeline then depends on how packets travel.
   - If measurements call for it, a WebRTC connection carries the audio instead. It is negotiated over the WebSocket, which keeps the control messages, as Verto does.
5. **Measure before changing.** On the robot, with [`tc netem`](https://man7.org/linux/man-pages/man8/tc-netem.8.html) adding loss and delay, and while it drives around a home, measure:
   - playback stalls;
   - how late the user's speech reaches the server;
   - PERF-2.

   WebRTC takes over the audio if these miss the requirements.
6. **aiohttp's WebSocket client on the robot.** It is already a dependency ([ADR-0006](0006-screen-renderer.md)). The server chooses its own stack.

## Alternatives considered

| Alternative | Why not, for now |
|---|---|
| WebRTC from the start: a direct peer-to-peer connection between robot and server, like Pipecat's SmallWebRTC transport, with aiortc in Python | The best fit for lossy networks: UDP, no head-of-line blocking, Opus's loss recovery, jitter buffers. Its costs: a signalling channel all the same, ICE, DTLS and SRTP on both sides, a TURN server for networks that block UDP, and harder debugging. It is the next step for the audio (point 4). |
| A WebRTC platform: the LiveKit server with LiveKit Agents | Open source (Apache-2.0): rooms, an agent framework with speech pipelines, and remote procedure calls between participants; its documentation covers robots. But the server would be built around a media server and its rooms before we know we need them, and the robot would join as a participant through LiveKit's SDK. To reconsider when the server is designed. |
| SIP and RTP to a FreeSWITCH media server | Mature media handling, such as jitter buffers and transcoding, and known to the team. But it needs a SIP stack on the robot, RTP through NAT, and a second channel for capabilities and events. It also models a phone call, which a robot session is not. |
| MQTT plus encrypted UDP, xiaozhi's alternative | Low-latency audio, but a broker to run, two channels, and audio encryption of its own design rather than DTLS and SRTP. Its own documentation rates it lower for reliability and firewalls. |
| QUIC or WebTransport | No head-of-line blocking between streams, datagrams for audio, and TLS 1.3 built in. But they are young in Python and on servers, and some networks block UDP. |
| gRPC streaming over HTTP/2 | Schemas and generated code. But it is still TCP, and it uses Protocol Buffers rather than the JSON that MCP and language models use. |

## Consequences

- Positive:
  - simple on both sides, with no new dependency on the robot;
  - works on any network that lets HTTPS through;
  - one connection to secure, authenticate and watch;
  - the server can be written in any language.
- Negative / accepted trade-offs:
  - TCP holds back everything behind a lost packet until it is resent. The robot's buffer hides this for the answer, but the user's speech reaches the server late. That is one reason the robot ends turns itself (decision 4 of the requirements).
  - Opus's forward error correction has nothing to repair over TCP.
  - Echo cancellation has to be done on the robot whatever the transport.
- Follow-up:
  - the protocol in `protocol/cloud/` ([ADR-0008](0008-cloud-link-messages.md));
  - the robot's cloud adapter, with a simulated cloud for tests (TEST-2);
  - the measurements of point 5, on a Pi 5.

## References

Retrieved 2026-10-16:

- Pipecat: [choosing a transport](https://docs.pipecat.ai/client/concepts/choosing-a-transport) and [transports](https://docs.pipecat.ai/pipecat/learn/transports).
- [OpenAI Realtime API with WebSocket](https://developers.openai.com/api/docs/guides/realtime-websocket).
- [Gemini Live API](https://ai.google.dev/gemini-api/docs/live).
- xiaozhi-esp32: [WebSocket protocol](https://github.com/78/xiaozhi-esp32/blob/main/docs/websocket.md) and [MQTT + UDP protocol](https://github.com/78/xiaozhi-esp32/blob/main/docs/mqtt-udp.md).
- Previous generation: [Luni_Robot network notes](https://github.com/trungnguyen278/Luni_Robot/blob/main/docs/modules/network.md).
- [FreeSWITCH Verto](https://developer.signalwire.com/freeswitch/users-and-endpoints/verto/).
- [aiohttp client reference](https://docs.aiohttp.org/en/stable/client_reference.html) (`ws_connect`: `heartbeat`, `compress`, `max_msg_size`), 3.14.5.
- [aiortc](https://github.com/aiortc/aiortc) 1.15.0 (BSD-3-Clause).
- [LiveKit](https://github.com/livekit/livekit) and [LiveKit Agents](https://github.com/livekit/agents) (Apache-2.0), with the Python SDK `livekit` 1.1.21; [remote procedure calls for robots](https://docs.livekit.io/robotics/media/data/rpc/).
- [Pipecat](https://github.com/pipecat-ai/pipecat) (BSD-2-Clause).

Versions are the latest on PyPI on 2026-10-16.
