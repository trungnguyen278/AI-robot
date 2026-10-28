# 0012 — The end of the user's speech: the cloud decides, the robot falls back

- **Status:** Accepted
- **Date:** 2026-10-23
- **Amended by:**
  - [ai-platform ADR-0006](https://github.com/trungnguyen278/ai-platform/blob/main/docs/decisions/0006-two-channels.md): in a conversation of many turns, the cloud still ends each turn, and the robot's fallback ends the conversation after a silence, not a turn;
  - [ADR-0018](0018-conversations.md): the robot no longer ends the user's speech, nor cancels a turn; the conversation's own limits, `nothing_heard`, `idle` and `longest`, take the place of its fallbacks

## Context

- This is decision 4 of the [requirements](https://github.com/trungnguyen278/ai-platform/blob/main/protocols/cloud/requirements.md): who decides that the user has finished speaking.
- Protocol 2.1 lets either side say so with `turn.speech_end`, and the first one wins: the robot stops streaming at once. The requirements leaned towards the robot ending turns with voice activity detection, the cloud ending them earlier if it wants.
- That cuts off whoever pauses in the middle of a sentence, and the cloud cannot get back what the robot never sent. Voice activity detection tells speech from silence; it cannot tell whether the speaker has finished their thought (LiveKit).
- The cloud can tell better: it hears the words, and it can run a model of turn-taking.
- How others do it:

| System | Who ends the user's speech |
|---|---|
| Alexa (AVS) | For near-field and far-field devices, the cloud: it sends `StopCapture` once it has detected the end of speech or understood the intent, even while audio still streams, and the device closes its microphone at once. |
| OpenAI Realtime API | The server, by silence (`server_vad`) or by what was said (`semantic_vad`). |
| LiveKit Agents | The agent: voice activity detection, with a turn detector model that waits longer when the user seems not to have finished. |
| Home Assistant's Linux satellite | The satellite detects the wake word and streams; Home Assistant runs the conversation. |
| Previous generation | Nobody: without voice activity detection, turns ended after 30 s. |

## Decision

1. **The cloud ends the user's speech**, with its own detection, which may use what was said. It sends `turn.speech_end`, and the robot stops streaming.
2. **The robot ends it only as a fallback**, for a cloud that is late or gone:
   - after `end_silence` seconds of silence, a setting of a few seconds;
   - or after 30 s of speech, as the protocol already says.

   Its `turn.speech_end` says how much speech it sent, as now.
3. **The robot cancels a turn in which nobody speaks** within `nothing_heard` seconds of its start (`turn.cancel`, "nothing heard"), so that its microphone does not stream silence.
4. **The robot still detects voice on its own**, for what cannot wait for the cloud:
   - barge-in, which stops its voice at once (PERF-3);
   - the fallbacks above.
5. **Protocol 2.2 says so.** The messages do not change. A 2.1 server keeps working: it only answers later if it does not end turns itself.

## Alternatives considered

| Alternative | Why not |
|---|---|
| The robot ends the speech after a short silence, the cloud earlier if it wants (protocol 2.1 as written) | The robot cuts off whoever hesitates, and the cloud cannot recover what came after the robot's end. |
| The cloud alone, with no fallback on the robot | A cloud that stalls or drops would leave the microphone streaming until the 30 s limit. The robot must bound its own listening (PRIV-1). |
| The robot proposes the end, and the cloud may extend it | More messages, and the cloud would still need its own detection to know when to extend. |

## Consequences

- Positive:
  - turns end where the words are understood, and fewer people are cut off;
  - the cloud's detection can improve without any change to the robot;
  - barge-in stays local and immediate.
- Negative / accepted trade-offs:
  - ending a turn takes a message from the cloud, so the robot streams a little longer after the user stops. The turn is still open, so PRIV-1 holds;
  - the server must detect the end of speech; LiveKit Agents provides it.
- Follow-up:
  - protocol 2.2, and the requirements' decision 4;
  - the voice module: the fallbacks, `nothing_heard`, barge-in;
  - the server's agent, with turn detection.

## References

Retrieved 2026-10-23:

- [AVS SpeechRecognizer](https://developer.amazon.com/docs/alexa-voice-service/speechrecognizer.html): `StopCapture`, cloud endpointing with the near-field and far-field profiles, `ExpectSpeech`.
- [OpenAI Realtime API, voice activity detection](https://developers.openai.com/api/docs/guides/realtime-vad): `server_vad` and `semantic_vad`.
- LiveKit: [turn detector](https://docs.livekit.io/agents/logic/turns/turn-detector) and [Using a transformer to improve end of turn detection](https://livekit.com/blog/using-a-transformer-to-improve-end-of-turn-detection).
- [linux-voice-assistant](https://github.com/OHF-Voice/linux-voice-assistant), Home Assistant's Linux satellite.
- The previous generation: [legacy.md](../legacy.md).
