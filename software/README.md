# software/ — main application on the Raspberry Pi 5

> Empty — waiting for the platform decisions (OS, ROS 2 or not, language); see the open questions in [`docs/architecture.md`](../docs/architecture.md).

Planned modules, each behind a defined interface so it can be added, replaced or removed independently:

| Module | Responsibility |
|---|---|
| audio | Microphone, speaker, wake word, VAD, AEC, conversation with the server |
| vision | AI camera (IMX500): people and object detection, face tracking |
| face | Expressive face on the 7" display |
| body link | Talks to the ESP32-S3 using [`protocol/`](../protocol/README.md) |
| behavior | Orchestration: robot state, reactions to events |
| net | Connection to `ai-robot-server`, BLE with `ai-robot-app`, software updates |

The folder layout will follow the platform decision (ADR). The robot's display name lives in a single configuration file and is never hard-coded ([ADR-0003](../docs/decisions/0003-neutral-repo-naming.md)).
