# Cloud link — robot ⇄ ai-robot-server

> **Status:** requirements drafted ([requirements.md](requirements.md)); no protocol yet. The decisions listed in [requirements §13](requirements.md#13-decisions-to-make) come first, as ADRs.

The robot's core AI runs in the cloud, in `ai-robot-server`, which will be built anew (not created yet). The robot captures, plays, shows and moves, and keeps everything safe. This link carries speech both ways, the context of each turn, events, and the calls through which the cloud drives the robot.

The two sides agree on media formats rather than assume them: one offers its codecs in order of preference and the other answers, as SIP endpoints do (requirements §6.3).

The cloud can control more of the robot over time without a new protocol. The robot publishes a catalogue of capabilities, each with a JSON Schema and a safety class, and the cloud calls them through one generic message (requirements §5). The robot checks every call locally, and physical safety never depends on the cloud.

The protocol will be defined here: message schemas, the catalogue's format and examples. Both `software/` and `ai-robot-server` will test against it.
