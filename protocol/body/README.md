# Body link — Pi 5 ⇄ body controller

> Empty — the format is not decided yet (to be recorded in an ADR).

Everything exchanged between the Pi 5 and the microcontroller modules: message types, fields, error codes and states. Both sides generate their code from, or share, the definitions here — never hand-copy them (the previous generation had to keep two copies of `StateTypes` in sync by hand).

## Requirements

- A protocol version, checked by both sides on connect.
- Framed packets with a CRC, robust to lost or corrupted bytes.
- Heartbeats in both directions; the ESP32-S3 goes to a safe state when the heartbeat is lost.
- Acknowledgements for critical commands.

## Candidate formats

- A schema with code generation, e.g. Protocol Buffers (nanopb on the ESP32).
- A custom binary format with framing (e.g. COBS) and a CRC, described in one spec file that generates the C++ and Python definitions.
