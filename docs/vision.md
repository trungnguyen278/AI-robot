# Vision

> First draft (2026-10-15), assembled from concept v0 and from what the previous generation already did. Edit freely. The short version is in the [README](../README.md#what-it-should-do).

A companion robot for the home: it moves on its own, sees, listens and talks, shows emotions on its "face", and uses two arms to interact with objects.

## Desired capabilities (initial ideas)

| Area | Capability | Notes |
|---|---|---|
| Talk | Wake word and spoken conversation with an AI assistant | The previous generation already had a wake word and cloud-based dialogue |
| | Interrupting the robot while it speaks (barge-in) | Needs acoustic echo cancellation (AEC) |
| Express | Animated eyes and emotions on the 7" face display | Builds on the previous generation's emotion design language ([legacy.md](legacy.md)) |
| | Full-screen scenes for everyday information: time, weather, timers, reminders, music | The previous generation had scene designs for these |
| | Status screens: start-up, connection, updates, battery | |
| | Touch input on the display | Capacitive touch panel ([display notes](../hardware/components/waveshare-7inch-dsi-lcd-c.md)) |
| | Settings and other interactive screens on the display, opened by a tap or by voice | The 7" touch screen is a full user interface, not only a face |
| See | Noticing people, faces and objects | Models can run on the camera's sensor ([camera notes](../hardware/components/raspberry-pi-ai-camera.md)) |
| | Showing the AI what it sees | |
| Move | Driving on tracks, avoiding obstacles, following a person | Encoders + distance sensor + camera |
| | Turning the head towards the speaker | 2-DOF neck + camera |
| | Gestures (waving, pointing), perhaps picking up light objects | Two 3-DOF arms; the arm design may change |
| Sense | Distance ahead, battery level; more sensors as needed | |
| Connect | AI service: speech recognition, conversation, speech synthesis | In the cloud, `ai-cloud` ([requirements](https://github.com/trungnguyen278/ai-platform/blob/main/protocols/cloud/requirements.md)) |
| | Software updates over the air | |
| | Set-up and settings on the robot's touch screen, or from a phone app over Bluetooth LE; remote control from the app | `ai-app` |
| Stay safe | Emergency stop; safe stop if the Pi goes silent | Design rule 4 in [CONTRIBUTING.md](../CONTRIBUTING.md) |
| | Status lights; clean shutdown before the battery runs out | [hardware/README.md](../hardware/README.md), open issue 6 |

## More ideas

<!-- Add ideas here, or open an issue with the "Feature or idea" template. -->
