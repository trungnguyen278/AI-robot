# 0008 — Cloud link messages: typed JSON, MCP for capabilities, binary audio frames

- **Status:** Accepted; point 3, the binary audio frames, superseded by [0009](0009-cloud-link-webrtc.md)
- **Date:** 2026-10-16
- **Amended by:**
  - [ai-platform ADR-0001](https://github.com/trungnguyen278/ai-platform/blob/main/docs/decisions/0001-repositories.md): the protocol is defined in ai-platform, in `protocols/cloud/` (point 4);
  - [ai-platform ADR-0003](https://github.com/trungnguyen278/ai-platform/blob/main/docs/decisions/0003-compatibility.md): the cloud speaks every major version that devices still use, each for at least 24 months after the next one ships, then tells the devices still on it to update (point 5);
  - [ai-platform ADR-0006](https://github.com/trungnguyen278/ai-platform/blob/main/docs/decisions/0006-two-channels.md): on the control channel, each side numbers its messages in the session (`seq`), and a reply names the number it answers (`reply_to`), so that the session can resume on a new connection; a conversation's messages travel in its room, without numbers (point 1)

## Context

- This is decision 2 of the [requirements](https://github.com/trungnguyen278/ai-platform/blob/main/protocols/cloud/requirements.md): how the messages of the robot ⇄ cloud link are written, over the WebSocket of [ADR-0007](0007-cloud-link-transport.md). The requirements say:
  - The cloud drives any capability the robot declares, with schemas and safety classes (EXT-1…10).
  - Each audio frame names its negotiated format (NEG-5).
  - Every message carries an identifier (SES-6) and is validated on arrival (SEC-14).
  - Older versions on either side keep working (REL-5).
- The robot's capabilities are what the Model Context Protocol (MCP) calls tools, and language models take tool definitions (name, description, input schema) as they are (EXT-10).
- MCP's latest revision, 2026-07-28, changed a lot:
  - It is stateless: there is no `initialize` handshake, and every request carries its protocol version and the client's capabilities in `_meta`.
  - Servers advertise their versions with `server/discover`. They send change notifications, such as `notifications/tools/list_changed`, on a `subscriptions/listen` stream.
  - Servers never send requests, and clients never send responses.
  - Long-running tasks moved to an extension.
  - Custom transports are allowed if they keep the JSON-RPC format, the message patterns and the per-request metadata.
- It is the fourth revision since March 2025, so the revision used has to be chosen, and changed, deliberately.
- How others write their messages:

| Project | Control | Audio |
|---|---|---|
| Previous generation | JSON with a `type`: `auth`, `set_emotion`, `ota_available`… | Binary frames of Opus packets, each after a 2-byte length. |
| xiaozhi-esp32 | JSON with a `type`: `hello`, `listen`, `tts`, `llm`… Devices are controlled through MCP: its JSON-RPC messages travel inside `mcp` messages. | Binary Opus frames. Over UDP, a 16-byte header: type, flags, length, source, timestamp, sequence. |
| OpenAI Realtime API | JSON events with a `type` and an `event_id` (optional from the client). | Base64 inside JSON events. |
| Gemini Live API | JSON messages named by their top-level field: `setup`, `realtimeInput`, `toolResponse`; `serverContent`, `toolCall`, `goAway`… | Inside JSON messages (`realtimeInput.audio`). |
| FreeSWITCH Verto | JSON-RPC 2.0. | WebRTC. |
| RTP (RFC 3550) | — | A 12-byte header: the payload type (the format, bound by SDP), sequence number, timestamp and source. |

## Decision

1. **Session messages are JSON objects**, one per text frame, in UTF-8.
   - Each has a `type`, and an `id` unique on its side for the session. A reply names the `id` it answers.
   - They cover:
     - the hello, which carries the versions, the media offer and answer (requirements §6.3), and the events the robot declares and the cloud subscribes to;
     - turns and barge-in;
     - context and events;
     - response control;
     - settings, update notices and time;
     - errors and the end of the session.
2. **Capabilities are MCP tools, revision 2026-07-28.**
   - An `mcp` message carries exactly one MCP JSON-RPC message, as in xiaozhi.
   - The robot is the MCP server and the cloud the client. They use `server/discover`, `tools/list`, `tools/call`, `subscriptions/listen` for `notifications/tools/list_changed`, `notifications/progress` and `notifications/cancelled`.
   - Each tool definition carries its safety class, version and limits in `_meta`, under a key prefix of our own. The robot enforces them whatever the cloud sends (SEC-8).
   - A newer MCP revision is adopted on purpose, with tests. `server/discover` lets the robot offer two revisions during the change.
3. **Audio travels in binary frames**, one codec packet per frame, after a 12-byte header modelled on RTP. The header holds:
   - the header's version;
   - the stream;
   - the format: the identifier the negotiation gave it, like RTP's payload type;
   - flags, such as the end of an utterance;
   - a sequence number;
   - a timestamp, in samples.

   The same fields would describe the packet over WebRTC (ADR-0007, point 4). Images are rare and size-limited (IO-7): they travel as MCP image content in a tool result.
4. **Defined once, in `protocol/cloud/`.** It holds a JSON Schema (2020-12, the dialect MCP uses) for every message type, the binary header, and examples. Both sides validate what they receive against the schemas (SEC-14) and test against the examples (TEST-1).
5. **Versions.** The hello carries the protocol version, `major.minor`.
   - A minor version only adds optional fields or message types. Both sides ignore, and log, the fields and types they do not know.
   - A major version may change meanings, and the server supports the previous one (REL-5).

## Alternatives considered

| Alternative | Why not |
|---|---|
| JSON-RPC 2.0 for everything, with the session's methods beside MCP's | In MCP the server, which the robot is, never sends requests, so the robot could not ask anything of the cloud in the same stream, such as a new media offer. Responses carry only an `id`, so they would have to be routed between two layers. Wrapping MCP leaves it untouched, and its SDKs usable as they are. |
| Capabilities in our own messages, shaped like MCP tools but not MCP | Immune to MCP's changes. But progress, cancellation, errors and change notifications would be ours to specify, and the cloud could not use MCP clients and agent frameworks unchanged. |
| Protocol Buffers, over the WebSocket or through gRPC | Compact, with generated code, but the logs become unreadable. Capabilities need JSON Schema anyway for language models, and control messages are few and small. |
| CBOR or MessagePack | Smaller than JSON, but with less tooling and little gain at a few messages per second. |
| Audio as base64 in JSON, as the OpenAI Realtime API does over a WebSocket | A third larger, and encoding it costs CPU on both sides. |

## Consequences

- Positive:
  - messages can be read in logs;
  - a new capability needs no protocol change, and any MCP client can call it;
  - audio frames name their format, and could move to RTP;
  - the schemas live in one place.
- Negative / accepted trade-offs:
  - Two layers to implement: the session messages and MCP.
  - MCP changes quickly, so keeping up with it is deliberate work.
  - JSON is larger than a binary format for control messages, which matters little at their rate.
- Follow-up:
  - Write the protocol in `protocol/cloud/`: schemas, header, examples.
  - Choose how the robot speaks MCP: the official Python SDK with a custom transport, or the small part of MCP it needs, tested against the SDK.
  - Evaluate MCP's tasks extension for actions that outlive a connection (EXT-5).

## References

Retrieved 2026-10-16:

- MCP revision 2026-07-28:
  - [key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog);
  - [transports](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports), including custom transports;
  - [tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools);
  - [schema](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts): `Tool._meta`, `ToolAnnotations`, `ProgressNotificationParams`.
- The [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk), `mcp` 2.3.0 (2026-10-02). Its low-level server runs on any pair of message streams (`Server.run`), and its client takes custom transports.
- xiaozhi-esp32: [WebSocket protocol](https://github.com/78/xiaozhi-esp32/blob/main/docs/websocket.md) and [MQTT + UDP protocol](https://github.com/78/xiaozhi-esp32/blob/main/docs/mqtt-udp.md).
- [OpenAI Realtime API reference](https://developers.openai.com/api/reference/resources/realtime): `type`, `event_id`, base64 `audio`.
- [Gemini Live API reference](https://ai.google.dev/api/live).
- [FreeSWITCH Verto](https://developer.signalwire.com/freeswitch/users-and-endpoints/verto/).
- Previous generation: [Luni_Robot network notes](https://github.com/trungnguyen278/Luni_Robot/blob/main/docs/modules/network.md).
- Standards:
  - [RFC 3550](https://www.rfc-editor.org/rfc/rfc3550), RTP: §5.1, the header;
  - [JSON-RPC 2.0](https://www.jsonrpc.org/specification);
  - [JSON Schema 2020-12](https://json-schema.org/draft/2020-12).
