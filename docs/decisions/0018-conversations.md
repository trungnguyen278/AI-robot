# 0018 — Conversations on the robot: one wake word, many turns

- **Status:** Accepted
- **Date:** 2026-10-28
- **Amends:** [ADR-0012](0012-end-of-speech.md), whose fallbacks give way to the conversation's own limits, and [ADR-0013](0013-listening-on-the-robot.md), whose wake word now opens a conversation

## Context

- The cloud link 3.0 makes a conversation the unit of talking ([ai-platform ADR-0006](https://github.com/trungnguyen278/ai-platform/blob/main/docs/decisions/0006-two-channels.md), [the cloud link 3.0](https://github.com/trungnguyen278/ai-platform/blob/main/protocols/cloud/README.md#conversations)):
  - a wake word, a touch or a button opens it, and the device streams what it hears for the whole conversation;
  - the cloud takes the turns, and says so in the room: `turn.start`, `turn.speech_end`, and `turn.cancel` for a turn it drops, such as speech not meant for the device;
  - the device ends it after `idle` seconds in which nobody speaks, or after `longest` seconds, whatever the cloud does (PRIV-1);
  - what the device hears before the agent joins goes to the agent as LiveKit's pre-connect audio.
- Today's voice module holds turns, as the cloud link 2.2 has them:
  - it streams from a trigger to the end of the user's speech;
  - it ends that speech itself after `end_silence` (2 s as shipped) or 30 s ([ADR-0012](0012-end-of-speech.md));
  - it cancels a turn with no voice within `nothing_heard` (6 s);
  - it opens a new turn for a follow-up, or after a barge-in.
- The voice processor cancels the echo of everything the robot plays ([ADR-0011](0011-audio-voice-processor.md)). The robot can then stream while it speaks, without the cloud hearing the robot's own voice. A computer used for development has no such processor.
- The robot's AI camera is planned, not in use yet ([BOM](../../hardware/bom.csv)). The voice processor already gives the direction of a voice.
- How others hold more than one request:

| System | After an answer |
|---|---|
| Alexa, Follow-Up Mode | Listens about 5 seconds more, its light on. It is an option for each device, and stays off during music and calls (reported at its launch). |
| Google Assistant, Continued Conversation | Listens about 8 seconds more for a follow-up; an option (Google's help) |
| Home Assistant Voice | Listens again only when the language model asks a question (from 2025.4, reported on its forum) |
| Gemini Live API | A session stays open for many turns, and the user may interrupt the model |

- How others tell speech meant for them from the rest:

| System | How |
|---|---|
| Alexa, Follow-Up Mode | A model of device-directed speech, from the sound and from the speech recognizer's own features |
| Alexa, Conversation Mode (Echo Show 10) | On the device, the camera's estimate of where each person's head turns, fused with the sound. Amazon reports 80 % fewer false wakes from the room's noise. It leaves the mode when nobody interacts for a short while. |
| Google, Look and Talk (Nest Hub Max) | On the device, six models and more than a hundred signals from the camera and the microphones: distance, head orientation, gaze, lip movement, intent. No video leaves it. |
| Gemini Live API | Proactive audio: the model may decide not to answer what is not relevant. Not every Live model has it: Gemini 3.1 Flash Live does not. |

## Decision

1. **The voice module holds conversations, not turns.** A conversation opens on the wake word, a touch or a button, or when the cloud opens one. It ends:
   - when the cloud ends it (`done`, `user`, `limit_reached`…);
   - after `nothing_heard` seconds without voice from its opening, as after a false wake;
   - after `idle` seconds in which nobody speaks to the robot and the robot does not speak. Speech that the cloud drops as not meant for the robot (`turn.cancel`) does not count;
   - after `longest` seconds;
   - when the microphones go off (`muted`), or the user touches the screen to stop it (`user`).
2. **It listens for the whole conversation.**
   - From the wake word, it keeps what it hears, and the `cloud` module hands that to the agent as pre-connect audio.
   - It then streams every chunk until the conversation ends.
   - The face shows that it listens throughout: the listening face is the privacy indicator (PRIV-1).
3. **The turns are the cloud's.**
   - The module shows them on the face: listening (`turn.start`), thinking (from `turn.speech_end` to the answer), speaking (while it plays), and attentive between turns.
   - It no longer ends the user's speech itself, nor cancels a turn. ADR-0012's fallbacks give way to `nothing_heard`, `idle` and `longest`, which bound the conversation instead.
4. **Barge-in stays the robot's own** (PERF-3): `barge_in` seconds of voice over an answer stop it at once, and send `response.interrupted`. The stream goes on, so the cloud already has the words that interrupted.
5. **Echo.** The audio port says whether it cancels the echo of what the robot plays.
   - With the voice processor it does, and the robot streams while it speaks: full duplex.
   - Without one, the robot does not stream while it plays, and only a touch interrupts: half duplex, for development computers and devices without an echo canceller.
6. **What the cloud opens.**
   - With `listen: true`, the robot streams from the start, if its owner allows the `privacy` class and its microphones are on; otherwise it refuses with `not_allowed`.
   - With `listen: false`, it only plays. A wake word ends that conversation and opens a new one.
7. **Speech not meant for the robot is told in two layers,** as Alexa's Conversation Mode does:
   - **The cloud judges what is said, from the start.** It drops such a turn with `turn.cancel`, so that the robot neither answers it nor stays open for it. It may end a conversation that holds nothing else.
   - **The robot judges what it sees and hears, once its camera is in use:** whether someone looks at it, and where the voice comes from. At first, speech it judges not meant for it only counts as silence for `idle`. Not streaming that speech at all waits for measurements on the robot of how often it would then miss its owner.
8. **Settings** ([ADR-0016](0016-settings.md)):
   - `idle` is the owner's, in the settings panel, from 5 to 30 seconds (10 as shipped), since it trades privacy for ease;
   - `nothing_heard`, `longest`, `barge_in` and the voice threshold stay in the configuration.
9. **Who does what:**
   - `voice` holds the conversation: the audio, the face's state, the limits;
   - `cloud` holds the link: it asks for the conversation and ends it on the control channel, joins and leaves the room, and carries the audio and the room's messages;
   - `vision`, once the camera is in use, gives the cues of decision 7.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Turns with a short window after each answer (Alexa, Google) | The owner wants a conversation (ai-platform ADR-0006). A window of a few seconds cuts off people who think before they answer, and the robot would still end each turn's speech without hearing it as the cloud does. |
| Listening again only when the model asks a question (Home Assistant) | The conversation would hang on the model's wording, and the user could not add a thought after an answer. |
| ADR-0012's fallbacks, kept inside a conversation | The cloud hears all of it and takes the turns. The robot's part is to bound the conversation for privacy, which `idle` and `longest` do. |
| Half duplex always: nothing streamed while the robot speaks | The cloud would not hear the words that interrupt, nor a remark made over the robot. The voice processor makes full duplex possible; half duplex stays for devices without one. |
| Streaming only what holds voice, to spare bandwidth and cost | The cloud's turn detection needs the silences too. If cost calls for it, the cloud can leave silence out itself, before its model. |
| Only the cloud tells speech meant for the robot | It keeps the robot from answering, but what is not meant for the robot has left it by then. The robot's own cues keep more of it at home, once its camera is in use. |
| The robot holds back what it judges not meant for it, from the start | Without its camera the robot has only the voice's direction, and understanding Vietnamese speech is too heavy for the Pi. It would miss its owner whenever they speak without facing it. |

## Consequences

- Positive:
  - people talk to the robot as to a person: one wake word, then as many turns as they like;
  - fewer guesses on the robot: the cloud, which hears everything, takes the turns, and tells what is meant for the robot;
  - privacy stays bounded on the robot itself (`nothing_heard`, `idle`, `longest`, the microphones' switch), and shown on its face.
- Negative / accepted trade-offs:
  - more audio leaves the robot than with turns: the silences, and remarks not meant for it, until `idle` passes. The face shows it, the owner sets `idle`, and the camera's cues later shorten it;
  - speech that never stops, such as a television's, keeps a conversation open only if the cloud takes it for speech meant for the robot; `longest` bounds even that;
  - full duplex depends on the voice processor's echo cancelling. Echo left over could make the cloud hear the robot itself.
- Follow-up:
  - the voice and `cloud` modules rewritten for the cloud link 3.0, with the move to ai-platform's pin;
  - in ai-cloud's pipeline, telling turns not meant for the device: the Live model's proactive audio where it has it, or a check of what was said;
  - the settings panel gains `idle`;
  - measured on the robot: the echo left while it speaks, false barge-ins, and false wakes against `nothing_heard`;
  - the vision module's cues, once the camera is in use, and then the measurements that holding speech back needs;
  - once this is accepted, ADR-0012 and ADR-0013 say that it amends them.

## References

Retrieved 2026-10-28:

- [The cloud link 3.0](https://github.com/trungnguyen278/ai-platform/blob/main/protocols/cloud/README.md) and [ai-platform ADR-0006](https://github.com/trungnguyen278/ai-platform/blob/main/docs/decisions/0006-two-channels.md).
- Google: [Continued Conversation](https://support.google.com/googlenest/answer/7685981), "about 8 seconds"; [another of its pages](https://support.google.com/assistant/answer/10004407) says about 10. Look and Talk: [Google's announcement](https://vietnamese.googleblog.com/2022/05/tro-chuyen-tu-nhien-hon-cung-voi-google.html), and [9to5Google](https://9to5google.com/2022/07/27/google-assistant-look-and-talk/) on its signals.
- Amazon's Follow-Up Mode, as reported at its launch: [TechRadar](https://www.techradar.com/how-to/what-is-amazon-follow-up-mode-and-how-it-makes-conversing-with-alexa-easier), [How-To Geek](https://www.howtogeek.com/345447/how-to-use-alexa%E2%80%99s-new-follow-up-commands/). Device-directed speech: Amazon Science, [Alexa, do I need to use your wake word?](https://www.amazon.science/blog/alexa-do-i-need-to-use-your-wake-word-how-about-now), [Device-directed Utterance Detection](https://www.amazon.science/publications/device-directed-utterance-detection), and [natural turn-taking](https://amazon.science/blog/change-to-alexa-wake-word-process-adds-natural-turn-taking); Conversation Mode, [TechCrunch](https://techcrunch.com/2021/11/18/amazon-officially-launches-its-more-natural-conversation-mode-option-for-echo-show-10).
- Home Assistant: [continued conversation on Voice PE](https://community.home-assistant.io/t/what-is-continued-conversation-for-voice-assistant-pe/864058), on its forum.
- Gemini Live API: [session management](https://ai.google.dev/gemini-api/docs/live-session), and [proactive audio](https://ai.google.dev/gemini-api/docs/live-guide).
