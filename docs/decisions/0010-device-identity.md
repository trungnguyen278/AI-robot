# 0010 — Device identity: a key in a TPM, short-lived tokens from signed assertions

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

- This is decision 5 of the [requirements](../../protocol/cloud/requirements.md): how a robot proves who it is to `ai-robot-server`. They ask for:
  - an identity per robot, made on the robot, whose private key never leaves it, with no shared or default secrets (SEC-2);
  - registration by the owner during set-up, through the app, and revocation by the owner or the server (SEC-3);
  - proof on every connection with short-lived credentials, renewed automatically (SEC-4);
  - secrets readable only by the robot's service account and wiped by a factory reset (SEC-5, PRIV-6).
- Today the robot sends a bearer token from an environment variable. It is provisional, a stopgap that [design rule 5](../../CONTRIBUTING.md#design-rules) asks to replace.
- [ADR-0009](0009-cloud-link-webrtc.md) has the robot ask `ai-robot-server` over HTTPS for a short-lived LiveKit token. This decision is what that request proves.
- The threats to cover (requirements §9.1):
  - **A cloned device.** A key that can be read can be copied, and the copy then speaks as the robot.
  - **A stolen device.** It must be revocable.
- The Raspberry Pi 5 has no secure element. It can store a 256-bit private key in its OTP memory, but root can read it back through the firmware mailbox (`rpi-otp-private-key`). TPM 2.0 modules for the Pi exist as HATs on SPI, such as the LetsTrust TPM and Infineon's evaluation board, both with Infineon's SLB 9672. LetsTrust notes that with the Pi 5's Active Cooler, the module needs a stacking header.
- How others do it:

| System | How a device proves itself |
|---|---|
| Matter | Commissioning over BLE: the phone and the device open a channel with the setup code (PASE, SPAKE2+), check the device's factory certificate, then install an operational certificate and key pair. Everything after uses that certificate. |
| AWS IoT Core, Azure IoT | An X.509 certificate per device: mutual TLS on every connection. |
| Google Cloud IoT Core (retired in 2023) | The device signs a short-lived JWT (ES256 or RS256), at most 24 hours long, with its private key. The cloud checks it against the public key registered for the device. A secure element (ATECC608A) can hold the key. |
| OAuth 2.0 (RFC 7523, `private_key_jwt`) | A client authenticates to a token endpoint with a JWT it signs, and receives short-lived access tokens. |
| Previous generation | A long-lived device token from set-up, and the MAC address. |

## Decision

1. **Each robot has a key pair made inside a TPM 2.0 on the robot**, an elliptic-curve key (P-256), that the TPM never lets out. It also has a random identifier, made on first start.
   - A TPM module on the Pi's SPI bus joins the hardware. The part, its pins and its stacking with the other boards are chosen in a hardware change.
   - The TPM also seals the robot's other secrets, such as its Wi-Fi password and tokens, and a factory reset clears it (SEC-5, PRIV-6).
2. **The owner registers the robot during set-up, on the robot's touch screen or through the app over Bluetooth LE.**
   - The robot hands over its identifier and public key. The owner confirms that it is the robot in front of them, with a code shown on its screen (PROV-2), much as Matter does with its setup code.
   - `ai-robot-server` binds the public key to the owner's account (SEC-3, SEC-6). Revoking the robot deletes the key.
   - The set-up protocol is decided with the touch screen's settings and with the app.
3. **On every connection, the robot signs an assertion and exchanges it for short-lived tokens** (SEC-4, SEC-12).
   - The assertion is a JWT signed with ES256 by the TPM, following RFC 7523. It names the robot and the token endpoint, lives a few minutes and has a unique `jti`.
   - `ai-robot-server`'s token endpoint checks it against the registered key, over TLS (SEC-1).
   - It answers with short-lived tokens, renewed automatically before they expire: the LiveKit token of the robot's room, and a token for the server's API.
4. **On development computers, a software key in a file** readable only by its user stands in for the TPM, behind the same signing interface. It is a development adapter, like the simulated ones, never a robot's key.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Mutual TLS with a certificate per robot, from a CA of the project (AWS IoT; Matter's operational certificates) | As strong, and checked by TLS itself. But it needs a certificate authority to run, certificate renewal, and load balancers that pass client certificates through. A key kept in a TPM is also awkward to use from Python's `ssl` module. Signed assertions prove the same key with ordinary HTTPS and OAuth tooling. |
| A long-lived token from set-up (the previous generation, and the robot today) | A copied token impersonates the robot until it is noticed, and it never expires (SEC-4). |
| The OAuth device authorization grant (RFC 8628), with a refresh token | Made for devices without a keyboard to sign in. But the device then holds a long-lived refresh token, a copyable secret, rather than a key that cannot leave it. Its sign-in flow may still suit set-up on the touch screen: a code on the robot's screen, approved on the owner's phone, that registers the robot's public key. |
| A key in a file, or derived from the Pi's OTP | No extra hardware. But root can read either, so a copy works anywhere until the robot is revoked. Writing OTP is also irreversible, and only secure boot makes it meaningful. |
| A secure element such as the ATECC608 on I2C | Cheap, and its keys cannot leave it. But it has a vendor library and a few fixed operations. A TPM is Linux's standard, with a kernel driver, `tpm2-tss` and PKCS#11, and it can seal the other secrets too. |

## Consequences

- Positive:
  - a cloned robot cannot speak as the original: the key never leaves the TPM;
  - nothing long-lived travels on the network, and tokens expire within minutes;
  - revoking a robot is one deletion on the server;
  - standard pieces: JWT, OAuth 2.0 (RFC 7523), TPM 2.0.
- Negative / accepted trade-offs:
  - one more board on the robot, and its cost;
  - a robot must be set up, and the server must have its token endpoint, before the robot can use the cloud;
  - the robot's clock must be roughly right for assertions to be accepted (it uses NTP).
- Follow-up:
  - a hardware change: the TPM module, in `hardware/` (BOM, pin map, stacking with the ReSpeaker HAT and the cooler);
  - on the robot, an identity port, with a TPM adapter (`tpm2-pytss`) and a file adapter for development;
  - protocol 2.0: the token endpoint, the assertion's claims, and the tokens it returns;
  - the set-up protocol, on the touch screen and over Bluetooth LE with the app;
  - the server: the device registry and the token endpoint.

## References

Retrieved 2026-10-22:

- Matter commissioning: [Silicon Labs](https://docs.silabs.com/matter/2.7.0/matter-overview-guides/matter-commissioning) and [Espressif, the Matter security model](https://developer.espressif.com/blog/matter-security-model/).
- Google Cloud IoT Core's device JWTs, as documented by its successor [ClearBlade](https://clearblade.atlassian.net/wiki/x/AgAEh), and [with an ATECC608A](https://www.digikey.com/en/articles/an-easier-solution-for-securely-connecting-iot-devices-to-the-cloud).
- [RFC 7523](https://www.rfc-editor.org/rfc/rfc7523), JWT profile for OAuth 2.0 client authentication; [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628), the device authorization grant.
- TPM modules for the Pi: [LetsTrust TPM](https://thepihut.com/collections/other-raspberry-pi-hats/products/letstrust-tpm-for-raspberry-pi) and [Infineon's SLB 9672 evaluation board](https://www.infineon.com/assets/row/public/documents/30/49/infineon-board-description-optiga-tpm-slb-9672-rpi-evaluation-board-datasheet-en.pdf).
- The Pi's OTP private key: [`rpi-otp-private-key`](https://linuxcommandlibrary.com/man/rpi-otp-private-key) and the [`rpi-otp-ec-private-key`](https://aptpeek.dev/raspberrypi/bookworm/main/arm64/rpi-otp-ec-private-key/0.1.1) package.
- [ETSI EN 303 645](https://www.etsi.org/deliver/etsi_en/303600_303699/303645/03.01.03_60/en_303645v030103p.pdf) V3.1.3, provisions 5.1 and 5.4.
