# 0009 — Cloud link transport: WebRTC through a LiveKit server

- **Status:** Accepted
- **Date:** 2026-10-22
- **Supersedes:** [ADR-0007](0007-cloud-link-transport.md), and point 3 of [ADR-0008](0008-cloud-link-messages.md)

## Context

- [ADR-0007](0007-cloud-link-transport.md) chose one WebSocket for everything. It planned to move the audio to WebRTC "if measurements call for it". [Design rule 5](../../CONTRIBUTING.md#design-rules) rules out such stopgaps: when the lasting choice is not clear, it is settled first.
- The robot is on home Wi-Fi and drives from room to room, so losses come and go. Over TCP, a lost packet holds back everything behind it, and Opus's loss recovery has nothing to repair (ADR-0007, consequences).
- Over the robot's life, the link will carry:
  - speech both ways, with barge-in, which needs echo cancellation on the robot (PERF-3);
  - images for the AI (IO-7), perhaps live video;
  - remote control from the app ([README](../../README.md)), with the camera;
  - capability calls and events ([ADR-0008](0008-cloud-link-messages.md)).
- How others connect devices and voice agents:

| Project | How |
|---|---|
| OpenAI Realtime API | WebRTC for clients: audio as media tracks, JSON events over a data channel, the SDP exchanged in one HTTPS request. |
| ChatGPT's voice mode | The app streams through LiveKit to OpenAI's voice agent, by LiveKit's account. |
| OpenAI's embedded SDK; Espressif's `esp_webrtc` | WebRTC on an ESP32-S3 (libpeer, and Espressif's `esp_peer` derived from it). Espressif's version adds Opus and echo cancellation. |
| LiveKit | An open-source WebRTC server (Apache-2.0). Rooms of participants with audio and video tracks; reliable data packets of up to 15 KiB; text and byte streams, chunked; RPC; an agents framework. Its robotics guides cover teleoperation, a Raspberry Pi rover and a bridge to ROS. A TURN server is built in, over TLS on port 443. The Python SDK has wheels for 64-bit Arm Linux and WebRTC's audio processing: echo cancellation, noise suppression, gain control. |
| Pipecat | WebRTC for client-server voice. Its peer-to-peer transport, built on aiortc, is meant for development and testing; for production it routes through Daily's servers. |
| xiaozhi-esp32, Gemini Live API | A WebSocket (or MQTT plus UDP for xiaozhi). Gemini Live takes video as JPEG frames, at most 1 per second, on the same WebSocket. |
| Alexa Voice Service | Long audio, such as music, is a URL the device streams itself (AudioPlayer), on a content channel separate from the dialog. |

## Decision

1. **WebRTC carries the link, through a LiveKit server that `ai-robot-server` runs.**
   - Each robot joins a room of its own. The cloud's AI joins it as an agent (LiveKit Agents, on the server).
   - Later, the app joins the same room for remote control and the camera.
2. **Audio travels as WebRTC tracks, in Opus.**
   - The robot publishes its microphone as a track, muted outside turns (PRIV-1). The agent publishes the robot's voice.
   - SDP negotiates the formats by offer and answer, as FreeSWITCH does, which meets §6.3 of the requirements. Every WebRTC endpoint supports Opus and G.711 ([RFC 7874](https://www.rfc-editor.org/rfc/rfc7874)). That settles decision 3 of the requirements: Opus, with no baseline of our own.
3. **The session messages of ADR-0008 stay, on a LiveKit text stream** between the robot and the agent, reliable and ordered. The stream cuts long messages, such as a tool list, into chunks.
   - Points 1, 2, 4 and 5 of ADR-0008 are unchanged.
   - Its binary audio frames (point 3) give way to the tracks.
4. **Access goes through `ai-robot-server`.**
   - The robot asks it over HTTPS for a short-lived LiveKit access token, proving its identity (decision 5 of the requirements).
   - LiveKit's signaling (a WebSocket over TLS) and WebRTC (DTLS-SRTP) follow.
   - LiveKit's TURN, over TLS on port 443, reaches robots on networks that block UDP.
5. **On the robot, the LiveKit Python SDK (`livekit`)**, in a `livekit` adapter of the `cloud` port.
   - WebRTC's audio processing module gives echo cancellation, noise suppression and gain control.
   - The simulated cloud stays, for tests and for running without a server.
6. **Barge-in stays local.** The robot stops playing at once on its own (PERF-3), and says how much it played, so that the agent drops the rest.

## Alternatives considered

| Alternative | Why not |
|---|---|
| One WebSocket for everything ([ADR-0007](0007-cloud-link-transport.md)) | Built to be replaced. TCP holds everything back behind a lost packet on a moving robot's Wi-Fi. The jitter buffer, loss recovery, negotiation and echo cancellation would be ours to build, and the app and video would need another system later. |
| WebRTC straight to `ai-robot-server`, as the OpenAI API does: SDP over HTTPS, a data channel for the messages, aiortc on the robot | No media server to run. But aiortc lags on the Pi: piwheels offers 1.11.0 while PyPI has 1.15.0. It has no echo cancellation of its own, as far as we found, and Pipecat keeps its aiortc transport for development. The app and the camera would need a server like LiveKit later anyway. |
| A WebSocket for the messages and WebRTC for the audio, as FreeSWITCH Verto does | Two transports to secure, keep alive and reconnect, for nothing gained over messages on the WebRTC connection. |
| GStreamer's `webrtcbin` on the robot, with `webrtcdsp` for echo cancellation | A complete stack, but a lower-level API, and the signaling and the server side would be ours to build. Kept as the fallback if the LiveKit SDK falls short on the Pi. |
| A hosted service only (LiveKit Cloud, Daily) | No server to run, but a recurring cost and a vendor between the robot and its owner. LiveKit Cloud runs the same protocol, so it stays an option for deployment. |
| MQTT plus UDP, as xiaozhi does | A broker to run, and audio encryption of our own design. |
| QUIC, WebTransport, Media over QUIC | Young in Python and on servers, and some networks block UDP. |

## Consequences

- Positive:
  - built for lossy networks: UDP, Opus's loss recovery, jitter buffers, congestion control;
  - formats negotiated by SDP, the FreeSWITCH way, rather than by a scheme of our own;
  - echo cancellation from WebRTC, on the robot;
  - the app, the camera and more agents join the same room;
  - the server can build on LiveKit Agents, and on LiveKit's robotics tools (teleoperation, ROS).
- Negative / accepted trade-offs:
  - `ai-robot-server` runs a LiveKit server and its TURN service, besides its own code;
  - the link depends on LiveKit's protocol and SDKs: open source, but led by one company;
  - a native dependency on the robot, the SDK's Rust core: wheels and CPU load to check on a Pi;
  - protocol 1.0's connection, media offer and audio frames are replaced, so the protocol becomes 2.0, and the WebSocket audio frames written for it are dropped.
- Follow-up:
  - protocol 2.0 in `protocol/cloud/`: rooms, tracks, the text stream, tokens;
  - the robot's `livekit` adapter, tested against a LiveKit server in development mode, and with the simulated cloud;
  - decision 5 (device identity): how the robot proves itself to get its token;
  - measurements on a Pi 5: CPU, latency, and a lossy link (`tc netem`);
  - ADR-0007 is marked superseded, and point 3 of ADR-0008.

## References

Retrieved 2026-10-22:

- OpenAI: [Realtime API with WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc).
- LiveKit: [OpenAI and LiveKit partnership](https://livekit.com/blog/openai-livekit-partnership-advanced-voice-realtime-api) (the ChatGPT voice mode, by LiveKit's account).
- Espressif: [`esp_peer`](https://components.espressif.com/components/espressif/esp_peer/versions/1.5.6/readme), derived from libpeer.
- LiveKit documentation:
  - [data](https://docs.livekit.io/transport/data/) and [data packets](https://docs.livekit.io/transport/data/packets/);
  - [robotics](https://docs.livekit.io/robotics/);
  - [self-hosted deployment](https://docs.livekit.io/transport/self-hosting/deployment/) (TURN over TLS);
  - [agent dispatch](https://docs.livekit.io/agents/server/agent-dispatch/);
  - [audio processing module, Python](https://docs.livekit.io/reference/python/livekit/rtc/apm.html).
- The `livekit` Python package on [PyPI](https://pypi.org/project/livekit) and [piwheels](https://www.piwheels.org/project/livekit/).
- Pipecat: [SmallWebRTC transport](https://docs.pipecat.ai/server/services/transport/small-webrtc).
- aiortc on [piwheels](https://www.piwheels.org/project/aiortc), and 1.15.0, released 2026-07-13, on a [PyPI mirror](https://simple-repository.app.cern.ch/project/aiortc).
- Google: [Gemini Live API, audio and video streams](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/send-audio-video-streams).
- Amazon: [Alexa Voice Service focus management](https://developer.amazon.com/docs/alexa-voice-service/focus-management.html).
- [RFC 7874](https://www.rfc-editor.org/rfc/rfc7874), the audio codecs every WebRTC endpoint supports.
