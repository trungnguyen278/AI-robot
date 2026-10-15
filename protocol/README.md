# protocol/ — Pi 5 ⇄ body protocol

> Empty — the wire format and transport are not decided yet.

The machine-readable implementation of the [robot-body contract](https://github.com/trungnguyen278/ai-robot-design/blob/main/interfaces/robot-body.md) (capabilities, behavior and versioning are specified there). This folder will hold the message definitions and framing that both the Pi software and the body firmware generate from or share — never hand-copied into two places.

## Requirements

- States which contract version it implements.
- Framed packets with a CRC, robust to lost or corrupted bytes.
- Works over the transport chosen later (UART, USB, …) without changes to the message definitions.

## Candidate formats

- A schema with code generation, e.g. Protocol Buffers (nanopb on microcontrollers).
- A custom binary format with framing (e.g. COBS) and a CRC, described in one spec file that generates the C/C++ and Python definitions.
