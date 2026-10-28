# Robot ⇄ cloud: requirements

> **Status:** draft for discussion, 2026-10-16. It states what the link between the robot and `ai-robot-server` must do. How it does so is decided later, in the ADRs listed in [§13](#13-decisions-to-make); until they are agreed, every design hint below is a proposal.

Requirement levels follow [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119): **MUST**, **SHOULD**, **MAY**. Each requirement has an identifier (`IO-3`, `SEC-7`…) so that designs, tests and reviews can refer to it.

## 1. Purpose and scope

The robot's core AI runs in the cloud, in `ai-robot-server`: understanding speech, deciding what to say and do, the voice, and probably moods such as sleepiness. That server will be built anew, like the robot: the previous generation's server (`Luni_Cloud`) is a reference, not a starting point. The robot (the Pi 5 software in `software/`) captures, plays, shows and moves, and keeps everything safe. This document covers the link between the two:

- what goes up and what comes down;
- how a conversation flows, including interruptions;
- **how the cloud can control more and more of the robot without the protocol changing** (§5);
- security, privacy, reliability, performance, provisioning, updates and testing.

Out of scope here: the Pi ⇄ body link ([`protocol/body/`](../body/README.md)), the software ⇄ screen link ([`protocol/screen/`](../screen/README.md)), and the app ⇄ cloud interface. Bluetooth set-up is covered only where it touches the cloud (§10).

## 2. Context and principles

```text
 ┌──────────── robot (Raspberry Pi 5) ────────────┐            ┌──── ai-robot-server ────┐
 │ modules ── bus ── cloud link ── TLS, outbound ─┼───────────▶│ gateway · AI pipeline   │
 │   screen, voice, motion, vision, system…       │◀───────────┼ device registry ·       │
 │   each declares the capabilities it offers     │            │ updates                 │
 └──────────────────────┬─────────────────────────┘            └────────────▲────────────┘
                        │ body link (never reaches the cloud)               │ account,
                  body controller                                       ai-robot-app
```

1. **The cloud decides what to say and do; the robot decides whether it is safe and how to do it.** Safety (motion limits, the emergency stop, the body controller's heartbeat) never depends on the cloud.
2. **The robot stays alive without the cloud.** The face, the screen, timers already set and safety keep working offline.
3. **Everything the robot can do for the cloud is a declared capability.** A new capability needs no change to the protocol, and the cloud can do nothing the robot has not declared (§5).
4. **Nothing leaves the robot without a reason people can see:** a wake word, a tap, an on-screen indicator.
5. **Least privilege, defence in depth:** each layer checks what it receives, even from the other side.
6. **One source of truth:** the protocol is defined here, in `protocol/cloud/`, and both `software/` and `ai-robot-server` test against it.

What the previous generation did, kept as a reference: one WebSocket per device, `auth` with a provisioned device token and the MAC address, Opus 16 kHz mono in 60 ms frames, JSON control messages (`set_emotion`, `set_scene`, `sync_data`, `ota_available` with `sha256`), a 30 s heartbeat, and re-pairing over Bluetooth after an authentication failure ([Luni_Robot network notes](https://github.com/trungnguyen278/Luni_Robot/blob/main/docs/modules/network.md)). Its fixed list of commands is what §5 replaces.

## 3. What the robot sends

| ID | Data | When | Notes |
|---|---|---|---|
| IO-1 | **Hello**: device identifier, protocol version, software version, locale, time zone, the media formats it offers (§6.3); then the capability catalogue (§5) | At the start of every session | No personal data beyond what identifies the device |
| IO-2 | **User speech**, as compressed audio | Only during a turn (§6): after the wake word, a tap or an expected follow-up | Never before the trigger (PRIV-1) |
| IO-3 | **Turn events**: turn started (with the trigger), end of speech, cancelled, barge-in (the user interrupted, with how much of the answer had been played) | As they happen | The cloud needs the played position to forget the unheard part of its answer, as `conversation.item.truncate` does in the OpenAI Realtime API |
| IO-4 | **Context** with each turn: interaction state, what the screen shows, volume and mute, battery and charging, connectivity, local time | At turn start and on request | A snapshot, so that the AI knows the situation; the context sent with events in Alexa Voice Service works this way ([AVS context](https://web.archive.org/web/20240612194441/https://www.developer.amazon.com/en-US/docs/alexa/alexa-voice-service/context.html)) |
| IO-5 | **Events** from the robot's modules: taps, a person seen or gone, battery low, charger plugged, emergency stop pressed, errors | As they happen, if the cloud subscribed | Extensible like capabilities (EXT-6); summaries, never raw sensor streams (PRIV-3) |
| IO-6 | **Results** of capability calls, including progress of long actions | In reply to each call | Structured, with success or error (EXT-3) |
| IO-7 | **Images** from the camera | Only as the result of an explicit call, if the owner allowed it | With an on-screen indicator (PRIV-2); size-limited JPEG |
| IO-8 | **Health and diagnostics**: temperature, throttling, memory, errors, update progress | Periodically, and on error | No audio, images or conversation content (PRIV-5) |

## 4. What the cloud sends

| ID | Data | Notes |
|---|---|---|
| IO-9 | **Speech** for the robot to say, as compressed audio streamed in pieces, with its text | Playback starts before the whole answer has arrived (PERF-2); the text feeds the screen and the logs |
| IO-10 | **Response control**: answer started and ended; stop now; keep listening for a follow-up | "Stop now" acts even mid-sentence |
| IO-11 | **Capability calls**: anything in the robot's catalogue, such as an expression, a scene with its data, the volume, the gaze, a gesture, a timer, a setting, a photo | One generic message for all of them (EXT-2) |
| IO-12 | **Settings** for the robot, versioned | Validated by the robot before use (SEC-14) |
| IO-13 | **Update notices**: version, size, where to download, signature | The robot verifies before installing (SEC-11) |
| IO-14 | **The server's time** | To detect clock skew; the robot keeps its own clock (NTP) |

## 5. Extensibility: the cloud drives capabilities the robot declares

The cloud will learn to do more over time: new expressions and scenes, gestures, driving, reminders, smart-home actions. None of this may require a new protocol version or a change on both sides at once.

| ID | Requirement |
|---|---|
| EXT-1 | The robot **MUST** publish a catalogue of capabilities at the start of each session. Each entry has a namespaced name (`screen.show_expression`, `motion.look_at`, `timer.set`), a description, a JSON Schema for its arguments and one for its result, a version, a safety class (SEC-8) and limits (rate, duration). |
| EXT-2 | The cloud **MUST** be able to call any catalogue capability through one generic call message, and receive one generic result message. The result is one of three kinds:<br>• a result;<br>• an error in the capability: it ran and failed, or its arguments were invalid, worded so that a language model can correct itself, as MCP advises;<br>• a protocol error: an unknown capability, or a malformed call.<br>A capability the robot's owner does not allow is not in the catalogue (SEC-9). |
| EXT-3 | Results **MUST** be structured data that matches the declared result schema, so that the AI can use them. |
| EXT-4 | When capabilities change during a session (a module started, hardware added, a setting changed), the robot **MUST** say so, and the cloud **MUST** read the catalogue again. |
| EXT-5 | Long actions (driving somewhere, playing music, a sequence of gestures) **MUST** report progress, be cancellable, and end with a result, as ROS 2 actions do. |
| EXT-6 | Events the robot can emit **MUST** be declared the same way (name, schema). The cloud subscribes to those it wants, so that new events need no protocol change either. |
| EXT-7 | Each capability **MUST** carry its own version. Adding an optional argument keeps it; changing the meaning makes a new version, or a new name, and the robot may offer both for a while. The core protocol version changes only when the session itself changes. |
| EXT-8 | The cloud **MUST NOT** be able to do anything outside the catalogue: no shell, no code to run, no file access, no free-form commands. |
| EXT-9 | On the robot, capabilities **MUST** be registered by the module that owns them and turned into bus messages. For example, `screen.show_expression` becomes an `ExpressionRequest` from a `cloud.*` source, at a priority the robot chooses. A new robot feature then adds a capability in its own module, with no change to the cloud link. |
| EXT-10 | The cloud **SHOULD** be able to hand the catalogue to its language model as tool definitions unchanged: name, description and input schema. |

Proposed shape (decision 2 in §13, [ADR-0008](../../docs/decisions/0008-cloud-link-messages.md)): the tools of the [Model Context Protocol](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), in JSON-RPC 2.0 messages: `tools/list`, `tools/call` with `inputSchema`/`outputSchema`, results with `isError`, and `notifications/tools/list_changed`. That is the format language models already use for tools, and the open-source xiaozhi-esp32 devices use MCP over their WebSocket for exactly this kind of control ([xiaozhi protocol](https://github.com/78/xiaozhi-esp32/blob/main/docs/websocket.md)). In MCP terms the robot is the server that offers tools, and the cloud is the client that calls them.

## 6. Sessions and conversations

### 6.1 The session

| ID | Requirement |
|---|---|
| SES-1 | The robot **MUST** open the connection: outbound only, with no port open to the internet on the robot (SEC-16). |
| SES-2 | The session **MUST** start with authentication (SEC-4), then a hello exchange (versions, the media offer and answer of §6.3, the event subscriptions) and the catalogue (§5). A side that receives no valid hello within a few seconds closes the connection. |
| SES-3 | Both sides **MUST** detect a dead connection within a bounded time (heartbeats) and close it. |
| SES-4 | The robot **MUST** reconnect after a loss with exponential backoff and jitter, up to a ceiling, so that a server outage does not end in every robot reconnecting at once (ETSI 5.9). |
| SES-5 | A session **SHOULD** survive a short disconnection: the robot resumes it, and the cloud continues the conversation and resends results it had not had acknowledged. A connection that lives for minutes inside a session that lives for hours is how the Gemini Live API works ([session management](https://ai.google.dev/gemini-api/docs/live-session)). |
| SES-6 | Every call and result **MUST** carry an identifier; duplicates **MUST** be ignored, so that a resend never acts twice. |
| SES-7 | When the software stops or updates, the robot **SHOULD** close the session cleanly, saying why. |

### 6.2 A turn

1. **Trigger**, on the robot: the wake word, a tap, or a follow-up the cloud asked for. The face shows "listening" at once (PERF-1).
2. **Turn start**: an event with the trigger and the context (IO-3, IO-4), then the user's speech as a stream (IO-2).
3. **End of speech**: decided by the cloud or by the robot (decision 4), and reported (IO-3). A turn **MUST** also end after a maximum duration. The previous generation had no voice activity detection: listening ended when its button was released, or after 30 s.
4. **Answer**: the cloud streams speech with its text (IO-9) and capability calls (IO-11), for example `screen.show_expression` with `happy` while it speaks. It ends the answer, or asks for a follow-up (IO-10).
5. **Barge-in**: if the user speaks while the robot talks, the robot stops playback at once, on its own (PERF-3). It reports how much was played (IO-3) and starts a new turn.

| ID | Requirement |
|---|---|
| SES-8 | A session **MUST NOT** have more than one turn active at a time. Calls **MAY** arrive outside turns: a reminder, a mood, an update notice. |
| SES-9 | The robot **MUST** keep working if a turn fails half-way. It ends the turn with an error event and shows it, without restarting anything. |

### 6.3 Negotiating media

Neither side assumes the other's formats: they agree on them, the way SIP endpoints such as FreeSWITCH agree on codecs. One side offers what it supports in its order of preference, and the other answers with what will be used. This is the offer/answer model of SDP ([RFC 3264](https://www.rfc-editor.org/rfc/rfc3264)). A robot with a better codec, a server that adds one, or a slow network then changes nothing in the protocol.

| ID | Requirement |
|---|---|
| NEG-1 | When a session opens, the robot **MUST** offer, for each stream, the formats it supports, in its order of preference. The streams are the user's speech, the robot's voice, and later images and video. A format is a codec with its parameters: sample rate, channels, frame duration, and a bit-rate range. |
| NEG-2 | The server **MUST** answer with one format per stream, taken from the offer among those it supports, or decline a stream that has none it can use. Which side's preference wins is the server's policy. FreeSWITCH calls these "generous" (the offer's order) and "greedy" (the answerer's own order) ([FreeSWITCH codec negotiation](https://developer.signalwire.com/freeswitch/media-and-codecs/codecs/)). |
| NEG-3 | Every robot and every server **MUST** support one baseline format for speech in each direction, so that negotiation between compatible versions always succeeds. Which format is decision 3. |
| NEG-4 | Either side **MAY** negotiate again during a session: a lower bit rate on a poor network, a higher quality for music. The exchange is atomic: the current formats stay until the answer arrives, and a change applies between turns, never in the middle of an utterance. Offers that cross **MUST** be settled by a fixed rule, such as the server withdrawing its own, so that both sides end with the same formats. |
| NEG-5 | Every audio frame or stream **MUST** identify its negotiated format, so that a mismatch is detected as a protocol error rather than played as noise. |
| NEG-6 | The same offer/answer **SHOULD** settle the other optional features of a session: image formats and sizes, compression, optional protocol features. A new feature is then offered by the side that has it and used only if the other accepts it, which keeps older versions working (REL-5). |

## 7. Performance

| ID | Requirement |
|---|---|
| PERF-1 | From wake word to the "listening" face: under 200 ms. This is local, with no cloud involved. |
| PERF-2 | From the end of speech to the first sound of the answer: a target of 1.5 s on a home connection, to be measured. Speech is streamed both ways, never sent as whole files. |
| PERF-3 | From the user speaking over the robot to its playback stopping: under 200 ms, local. |
| PERF-4 | Audio **SHOULD** use, whenever the negotiation allows (§6.3), a speech codec built for low bit rates and lost packets, such as Opus, as in the previous generation and in xiaozhi. Uplink speech is at least 16 kHz mono. |
| PERF-5 | The robot **MUST** absorb network jitter with a playback buffer, and **MUST** never let a slow network delay the face, the screen or safety. |

## 8. Reliability and working offline

| ID | Requirement |
|---|---|
| REL-1 | Without the cloud, the robot **MUST** keep its face, screen, clock, local behaviours and safety. It **MUST** show that it is offline, and answer a wake word with a short local cue rather than silence (ETSI 5.9). |
| REL-2 | Timers and reminders **MUST** be scheduled on the robot once set, so that they ring offline. |
| REL-3 | Events produced offline **MAY** be queued, up to a bounded size, oldest dropped first. Audio is never queued. |
| REL-4 | A cloud that sends malformed, unknown or too many messages **MUST NOT** crash or block the robot (SEC-14, SEC-15). |
| REL-5 | Both sides **MUST** tolerate the other being on an older version: the robot announces what it supports, the cloud adapts, and unknown fields are ignored. The server **SHOULD** support at least the previous protocol version. |

## 9. Security

### 9.1 What to protect, and from whom

- **Assets:** what people say and show to the robot (audio, images, conversations); the device's credentials; its actuators, since a robot that moves can hurt; the owner's account; the home network it is on.
- **Threats:**
  - someone on the network reading or changing traffic;
  - a fake server (DNS hijack, captive portal);
  - a cloned or stolen device;
  - a compromised server or cloud account sending harmful commands;
  - a replayed message;
  - floods;
  - a tampered update.

The checklists used are [ETSI EN 303 645](https://www.etsi.org/deliver/etsi_en/303600_303699/303645/03.01.03_60/en_303645v030103p.pdf), the European baseline for consumer IoT security, and the [OWASP IoT Top 10](https://owasp.org/www-project-internet-of-things/). The requirements below cite them where they apply: "ETSI 5.5" is a clause of the standard, "ETSI 6-4" a provision of its clause 6, and "OWASP I1" an item of the list.

### 9.2 Requirements

| ID | Requirement |
|---|---|
| SEC-1 | All traffic **MUST** use TLS (1.3; 1.2 at least), with the server's certificate validated against the system's trusted authorities. There is no unencrypted fallback (ETSI 5.5). The robot **MAY** additionally pin the server's authority or key. |
| SEC-2 | Each robot **MUST** have its own identity, created on the robot, with a private key that never leaves it. There are no shared or default secrets in the software or in images (ETSI 5.1; OWASP I1). |
| SEC-3 | The identity **MUST** be registered with the server during set-up, by the owner, through the app (§10), and the owner or the server **MUST** be able to revoke it. |
| SEC-4 | The robot **MUST** prove its identity to the server on every connection, with short-lived credentials renewed automatically (decision 5). The server proves its own identity through TLS (SEC-1). |
| SEC-5 | Secrets on the robot (key, tokens, Wi-Fi password) **MUST** be readable only by the robot's service account, never committed, logged or shown, and wiped by a factory reset (ETSI 5.4). Hardware-backed key storage on the Pi is to be evaluated, from its documentation (decision 5). |
| SEC-6 | The server **MUST** accept a robot only if it is bound to an account, and **MUST** confine every request to that robot's data (OWASP I3). |
| SEC-7 | The robot **MUST** check every call against its catalogue and the call's schema, and refuse anything else (EXT-8). |
| SEC-8 | Each capability **MUST** have a safety class that the robot enforces locally, whatever the cloud asks. Proposed classes: *informational* (the screen, sounds); *privacy* (the camera; a turn the cloud starts, other than a follow-up to its answer): only if the owner allowed it, always with an indicator; *physical* (motion): only within the configured limits, with every command expiring, refused while the emergency stop is pressed; *system* (reboot, update, settings): only in the documented safe states. |
| SEC-9 | The owner **MUST** be able to switch off capability classes locally (for example "the cloud may not move the robot" or "never use the camera") with a setting the cloud cannot change. |
| SEC-10 | Physical safety **MUST NOT** depend on the cloud or the network. The motion rules already in place (commands expire, `motion` stops first) and the body controller's heartbeat apply to cloud calls too. |
| SEC-11 | Updates **MUST** be signed, verified on the robot before they are installed, and fetched over TLS. Installation **MUST** be able to roll back, and **MUST NOT** accept an older version than the installed one unless the owner says so (ETSI 5.3, 5.7; OWASP I4). |
| SEC-12 | Every message **MUST** carry a unique identifier, and credentials **MUST** expire, so that a replayed message has no effect beyond its first one (SES-6). |
| SEC-13 | The robot **SHOULD** keep a log of security events and of capability calls: name, outcome, origin. It keeps neither personal content nor secrets in it. |
| SEC-14 | Both sides **MUST** validate every message they receive: its schema, its size, its numbers (finite), its strings (length). They refuse what fails, as the screen protocol already does (ETSI 5.13). |
| SEC-15 | Both sides **MUST** limit message rates and sizes, and the robot **MUST** stay responsive under a flood (OWASP I2). |
| SEC-16 | The robot **MUST NOT** expose services to the internet. Its local servers (the screen page) stay bound to the robot itself unless the owner opens them, and Bluetooth set-up is open only on request and for a limited time (ETSI 5.6; OWASP I2, I9). |
| SEC-17 | The project **SHOULD** publish how to report a vulnerability (a `SECURITY.md`) before the first robot leaves the workshop (ETSI 5.2). |

### 9.3 Privacy

| ID | Requirement |
|---|---|
| PRIV-1 | Audio **MUST NOT** leave the robot outside a turn (§6.2). The face, or a light, **MUST** show when the robot listens, and a mute control **MUST** cut the microphones. |
| PRIV-2 | Images **MUST** leave the robot only as the result of a call the owner allowed (SEC-8, SEC-9), with an on-screen indicator while the camera is used for the cloud. |
| PRIV-3 | The robot **SHOULD** send conclusions rather than raw data: "a person is in front of me", not a video stream. |
| PRIV-4 | The owner **MUST** be able to see and delete what the cloud keeps about them and the robot (conversations, recordings, images); the server sets and states how long it keeps them (ETSI 5.11, 6-1, 6-6). |
| PRIV-5 | Health reports and logs **MUST NOT** contain audio, images or conversation content (ETSI 6-4; OWASP I6). |
| PRIV-6 | A factory reset **MUST** erase the robot's credentials, its settings and anything it stored locally. |
| PRIV-7 | The robot will talk with children. The server's policies for them (content, storage, consent) are to be defined before the first real users. |

## 10. Set-up and ownership

| ID | Requirement |
|---|---|
| PROV-1 | Set-up covers the Wi-Fi credentials, binding to the owner's account, and registering the robot's identity (SEC-3). It **MUST** be possible through the app over Bluetooth LE, and **MAY** happen on the robot's touch screen, where settings live too. |
| PROV-2 | The owner **MUST** confirm that it is the robot in front of them that joins their account, for example with a code shown on the robot's screen and typed into the app, or approved on their phone. |
| PROV-3 | Until the robot is bound, it **MUST** refuse everything but set-up, and **MUST** say so on screen. |
| PROV-4 | A robot **MUST** be transferable to a new owner only through a reset that erases the previous owner's data and binding (PRIV-6). |

## 11. Observability and operations

| ID | Requirement |
|---|---|
| OPS-1 | The server **MUST** see, for each robot: whether it is connected, its versions, its last error, and its update state. |
| OPS-2 | The robot **SHOULD** expose a diagnostics capability (versions, connectivity, recent errors) under the *system* class. |
| OPS-3 | Logs on both sides **MUST** let a session be followed across them (shared identifiers), without personal content (SEC-13). |

## 12. Conformance and tests

| ID | Requirement |
|---|---|
| TEST-1 | The protocol **MUST** be defined in `protocol/cloud/`: message schemas, the capability catalogue's format, examples. Both repositories test against it. |
| TEST-2 | The robot's software **MUST** have a simulated cloud, so that it runs and is tested without the server, as with every other port. The server **SHOULD** have a simulated robot. |
| TEST-3 | Tests **MUST** cover: refusing invalid certificates and unknown calls; the safety classes (SEC-8, SEC-9); rate limits; resuming a session; working offline (REL-1). |

## 13. Decisions to make

Each becomes an ADR, `Proposed` until agreed.

| # | Decision | Options | Leaning |
|---|---|---|---|
| 1 | Transport | WebSocket over TLS, carrying JSON and binary audio frames (the previous generation, xiaozhi, the OpenAI and Gemini realtime APIs). WebRTC (built for lossy networks, more complex). MQTT plus UDP audio. | Decided: WebRTC through a LiveKit server, for the audio and the messages ([ADR-0009](../../docs/decisions/0009-cloud-link-webrtc.md), superseding [ADR-0007](../../docs/decisions/0007-cloud-link-transport.md)) |
| 2 | Message format | JSON-RPC 2.0 with MCP-shaped capabilities (§5). A protocol of our own. | MCP for capabilities, standard and what language models already consume, inside the link's own JSON messages: [ADR-0008](../../docs/decisions/0008-cloud-link-messages.md) |
| 3 | Audio formats offered, and the baseline (§6.3) | Opus at 16 or 24 kHz, 20 or 60 ms frames, at several bit rates; 16-bit PCM at 16 kHz | Decided: Opus, negotiated by SDP, which every WebRTC endpoint supports ([ADR-0009](../../docs/decisions/0009-cloud-link-webrtc.md)) |
| 4 | End of speech | On the robot (voice activity detection), the cloud confirming. In the cloud only. | Proposed: the cloud ends the user's speech, and the robot only falls back, after a long silence or 30 s ([ADR-0012](../../docs/decisions/0012-end-of-speech.md)) |
| 5 | Device identity and credentials | A client certificate (mutual TLS). Short-lived tokens signed with the device's key. A long-lived token from set-up (the previous generation). | Decided: a key pair in a TPM on the robot, registered at set-up; short-lived tokens in exchange for signed assertions ([ADR-0010](../../docs/decisions/0010-device-identity.md)) |
| 6 | Updates | Debian packages, an image with two slots, or a container | To study with the Raspberry Pi OS update tools |
| 7 | Where moods live | In the cloud, sending expression requests, as now planned. On the robot. | In the cloud. The robot's `behavior` module keeps only local reactions (taps, offline) |
| 8 | Set-up (§10) | The app over Bluetooth LE, secured by a code on the robot's screen (a PAKE). Bluetooth's own pairing. A Wi-Fi access point on the robot. The device authorization grant. | Proposed: the app over Bluetooth LE, with SPAKE2+ on a code shown on the robot's screen; the robot signs its registration, which the app relays ([ADR-0015](../../docs/decisions/0015-set-up.md)) |

## References

Retrieved 2026-10-16:

- Previous generation: [Luni_Robot network notes](https://github.com/trungnguyen278/Luni_Robot/blob/main/docs/modules/network.md).
- [xiaozhi-esp32 WebSocket protocol](https://github.com/78/xiaozhi-esp32/blob/main/docs/websocket.md): hello with audio parameters (Opus 16 kHz, 60 ms frames), bearer token, `listen`/`tts`/`llm` emotion messages, MCP for device control.
- [Model Context Protocol, tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) (revision 2026-07-28, the latest; [ADR-0008](../../docs/decisions/0008-cloud-link-messages.md) summarises what it changed): `tools/list`, `tools/call`, schemas, errors, security considerations.
- [Gemini Live API, session management](https://ai.google.dev/gemini-api/docs/live-session): connections of about 10 minutes inside resumable sessions.
- [OpenAI Realtime API reference](https://developers.openai.com/api/reference/resources/realtime): audio buffers (`input_audio_buffer.append`), speech detected by the server (`input_audio_buffer.speech_started`), and dropping the audio the user did not hear (`conversation.item.truncate`).
- Alexa Voice Service, [context](https://web.archive.org/web/20240612194441/https://www.developer.amazon.com/en-US/docs/alexa/alexa-voice-service/context.html) and [API overview](https://web.archive.org/web/20240520071257/https://www.developer.amazon.com/en-US/docs/alexa/alexa-voice-service/api-overview.html), archived copies from 2024, since the pages are offline: interfaces made of directives and events, the interfaces and versions each device reports, context with each event.
- [ETSI EN 303 645](https://www.etsi.org/deliver/etsi_en/303600_303699/303645/03.01.03_60/en_303645v030103p.pdf) V3.1.3 (2024-09); [OWASP Internet of Things Top 10](https://owasp.org/www-project-internet-of-things/) (2018).
- [RFC 3264](https://www.rfc-editor.org/rfc/rfc3264), the SDP offer/answer model, and [FreeSWITCH's codec negotiation](https://developer.signalwire.com/freeswitch/media-and-codecs/codecs/): generous, greedy and scrooge.
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), requirement levels.
