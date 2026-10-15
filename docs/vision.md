# Vision

> First draft (2026-10-15), assembled from concept v0 and from what the previous generation already did. Edit freely.

A companion robot for the home: it moves on its own, sees, listens and talks, shows emotions on its "face", and uses two arms to interact with objects.

## Desired capabilities (initial ideas)

| Area | Capability | Notes |
|---|---|---|
| Conversation | Wake word and spoken conversation | The previous generation already had a wake word and cloud-based dialogue |
| | Interrupting the robot while it speaks (barge-in) | Needs acoustic echo cancellation (AEC) |
| Expression | Expressive eyes on the 7" face display | Builds on Luni's emotion design language |
| | Turning the head toward the speaker | 2-DOF neck + camera |
| Vision | Recognizing people, faces and objects | The IMX500 runs models on the sensor |
| Mobility | Driving on tracks, avoiding obstacles, following a person | Encoders + ToF sensor + camera |
| Manipulation | Waving, pointing, picking up light objects | Two 3-DOF arms; the arm design may change |
| Connectivity | Phone app: pairing, settings, remote control | `ai-robot-app` |
| | AI backend: STT/LLM/TTS, device management | `ai-robot-server` |

## More ideas

<!-- Add ideas here, or open an issue with the "Feature or idea" template. -->
