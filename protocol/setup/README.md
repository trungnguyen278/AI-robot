# Set-up — the app ⇄ the robot, over Bluetooth LE

> **Moved:** this protocol is maintained in [ai-platform](https://github.com/trungnguyen278/ai-platform) (`protocols/setup/`) from 2026-10-28. This copy is frozen until this repository pins ai-platform at `platform/` ([ai-platform ADR-0001](https://github.com/trungnguyen278/ai-platform/blob/main/docs/decisions/0001-repositories.md)).

How the owner's app sets up a robot: its Wi-Fi network, and its registration with the owner's account on `ai-robot-server`.
- On the robot (`software/`), it is the `setup` module, with its `setup_link` and `network` ports.
- The app (`ai-robot-app`) does not exist yet.

Version **1.0**:
- It follows [ADR-0015](../../docs/decisions/0015-set-up.md), proposed, and registers the key of [ADR-0010](../../docs/decisions/0010-device-identity.md).
- It meets the [requirements](../cloud/requirements.md) on set-up and ownership (PROV-1 to PROV-4), and SEC-3, SEC-5 and SEC-16.
- [`schema.json`](schema.json) defines every message, in JSON Schema 2020-12.
- [`examples/`](examples/) holds a whole session, in the clear, with what an app needs to replay its exchange byte for byte: the code, the salt, both sides' random scalars, the intermediate values and the session keys. The robot's tests check it against the schema, and replay it (`software/tests/test_setup_protocol.py`).

> **Implemented by the robot so far:** everything below. The `setup` module holds set-up, with BlueZ for Bluetooth LE and NetworkManager for the Wi-Fi; the `cloud` module signs the registration with the robot's key, and keeps its binding. The app does not exist yet, nor the server's side of the registration.

## How it goes

```
robot                                                   app
shows a code and a QR code;
advertises the set-up service
                                                        the owner scans the QR code,
                                                        or types the code
          <────────────── connects ────────────────────
          <────────────── hello ───────────────────────
          ─────────────── hello: discriminator, salt ──>
          <────────────── share (SPAKE2+) ─────────────
          ─────────────── share, confirm ──────────────>
          <────────────── confirm ─────────────────────
                     from here on, everything is encrypted
          <────────────── info, networks, join ────────
          <────────────── register: challenge, server ─    from ai-robot-server
          ─────────────── registration (signed) ───────>   to ai-robot-server
          <────────────── finish ──────────────────────
closes set-up, asks the server for its
tokens: once they come, it is bound
```

## When set-up is open

The robot is open to set-up only on request, and for a limited time (SEC-16).

| | |
|---|---|
| **Opens** | From start, while the robot is not bound (PROV-3), and when the owner asks on its screen. Each time, the robot draws a new discriminator, code and salt. |
| **Closes** | After `window` (15 minutes as shipped), on `finish`, when the owner cancels on the screen, or after `attempts` failed attempts (20). |
| **Advertising** | Only while set-up is open and no session runs. One session at a time: a second app gets the error `busy`. |
| **A failed attempt** | A session that sent a `share` but did not confirm. The robot then shows a new code, with a new salt. |
| **An idle session** | The robot ends a session that has sent nothing for `idle` seconds (120). |

These durations and counts are the robot's settings, in `[modules.setup]` of `software/config/base.toml`; the values above are those shipped.

## Finding the robot

- **The service.** While set-up is open, the robot advertises the set-up service's UUID (below), and its display name if there is room.
- **The discriminator.** 4 hexadecimal digits, drawn each time set-up opens. The screen shows it beside the code, the QR code carries it, and the robot's `hello` gives it. When several robots are in set-up, the app connects to each one, and keeps the one whose discriminator matches.

## The code

- **8 decimal digits**, drawn uniformly, shown as two groups of four (`1234 5678`). The PAKE's password is the 8 digits in ASCII, without the space.
- **The QR code** holds the set-up string: `setup:1:<discriminator>:<code>`, for example `setup:1:3F7A:12345678`.
  - The `1` is this protocol's major version.
  - The robot's setting `link` can wrap it in an address, so that a phone's camera opens the app. `{setup}` in `link` stands for the string, and `"{setup}"`, as shipped, is the string alone.
- The code is a secret for the few minutes it lives. The robot shows it only on its screen, never in its logs (SEC-5).

## The Bluetooth service

| | UUID | Properties |
|---|---|---|
| Service | `eaf35dcb-e774-4881-b0c6-4990127a1289` | Primary |
| Request | `eaf35dcc-e774-4881-b0c6-4990127a1289` | Write, with a response: from the app |
| Answer | `eaf35dcd-e774-4881-b0c6-4990127a1289` | Indicate: from the robot |

- **No Bluetooth pairing.** The characteristics ask nothing of Bluetooth's own security: the session protects the messages, as Matter's does.
- **First, indications.** The app enables Answer's indications, then writes its first fragment: the robot counts it as connected from that write.
- **Fragments.** A message is split into fragments, one per write or indication, each at most the ATT MTU minus 3 bytes. The smallest MTU, 23, leaves 20 bytes.
  - Byte 0 holds flags: `0x80` on a message's first fragment, `0x40` on its last; the other bits are 0.
  - The first fragment then holds the message's length in bytes, on 2 bytes, big-endian, then the message's first bytes.
  - A message has at most **8192** bytes.
- **Order.** The app makes one write at a time, and the robot sends one indication at a time, each confirmed before the next: no other flow control is needed.
- **Errors.** Either side ends the session on a fragment that does not fit: a continuation with no first fragment, a first fragment within a message, or more or fewer bytes than announced.

## The session

### Before the exchange, in the clear

Messages are JSON objects, in UTF-8. Each has a `type` and an `id`; an answer also has `reply_to`, the `id` it answers.

| From | Message | Fields |
|---|---|---|
| App | `hello` | `protocol`: the version it speaks, `"1.0"` |
| Robot | `hello` | `protocol`; `discriminator`; `salt`: 16 random bytes, in base64url |
| App | `share` | `share`: SPAKE2+'s shareP |
| Robot | `share` | `share`: shareV; `confirm`: confirmV |
| App | `confirm` | `confirm`: confirmP |

- **Versions.** If the app's major version is not the robot's, the robot answers the error `version` and ends the session. A newer minor version only adds optional fields and messages.
- **Points and tags** are in base64url, without padding: a point in SEC1's uncompressed form, 65 bytes, and a tag of 32 bytes.
- **A wrong code.** If confirmP is wrong, the robot answers the error `code` and ends the session. The app sees a wrong confirmV first, and ends it itself. Either way, the robot then shows a new code.
- Then the robot accepts nothing in the clear any more.

### SPAKE2+

[RFC 9383](https://www.rfc-editor.org/rfc/rfc9383), with:

| | |
|---|---|
| Ciphersuite | P256-SHA256-HKDF-SHA256-HMAC-SHA256, with M and N from RFC 9383, §4 |
| Roles | The app is the Prover; the robot is the Verifier |
| w0 and w1 | scrypt ([RFC 7914](https://www.rfc-editor.org/rfc/rfc7914)), with N = 32768, r = 8, p = 1, as RFC 9383 recommends. Its password is `len(pw) ‖ pw ‖ len(idProver) ‖ idProver ‖ len(idVerifier) ‖ idVerifier`, its salt the robot's `salt`, and its output 80 bytes. w0 is the first 40 bytes, and w1 the last 40, each as a big-endian integer modulo the order of P-256. |
| Identities | Both empty, as in Matter: the context names the session |
| Context | SHA-256 of `ai-robot/setup/1` ‖ the app's `hello` ‖ the robot's `hello`, the hellos as the exact bytes sent |
| `len()` | 8 bytes, little-endian, as in RFC 9383 |

- The transcript, the confirmation keys and K_shared are those of RFC 9383, §3.3 and §3.4.
- Each side checks that the other's share is a point of P-256, other than the point at infinity.
- **Session keys.** HKDF-SHA256 ([RFC 5869](https://www.rfc-editor.org/rfc/rfc5869)) of K_shared, with an empty salt and the info `ai-robot/setup/1 keys`, gives 32 bytes. The first 16 are the app's key, and the last 16 the robot's.

### After the exchange, encrypted

- Each message is the JSON message's UTF-8 bytes, encrypted with AES-128-GCM under its sender's key: the ciphertext, then the 16-byte tag. It is split into fragments as above.
- The nonce is 4 zero bytes, then the sender's message counter on 8 bytes, big-endian. The counter starts at 0 for the first encrypted message, and counts each one. There is no associated data.
- The receiver keeps the same count. A message that does not decrypt ends the session.

## Requests and answers

The app sends one request at a time, and waits for its answer.

| Request | Fields | Answer |
|---|---|---|
| `info` | | `info`: `robot` (`id`, `name`, `software`), `bound`, `network` |
| `networks` | | `networks`: the networks the robot sees, after a scan, the strongest first, at most 50 |
| `join` | `ssid` or `ssid_hex`; `password`, for a protected network; `hidden` and `security`, for a network that does not announce itself | `joined`: `network`, once connected |
| `register` | `challenge`; `server` | `registration`: the robot's signed registration |
| `finish` | | `finished`. The robot then ends the session and closes set-up. |

- **A network**, in `networks`:
  - `ssid`, its name; or `ssid_hex`, its name's bytes in hexadecimal, if they are not UTF-8;
  - `security`: `open` (no password, encrypted or not), `wpa2` (WPA2 Personal, or WPA2 and WPA3 mixed), `wpa3` (WPA3 Personal only), or `other` (a security the robot does not join, such as WPA Enterprise);
  - `signal`, from 0 to 100;
  - `saved`: whether the robot already has the network's password.
- **The network the robot is on**, in `info` and `joined`:
  - `state`: `connected`, `connecting` or `disconnected`;
  - when connected, also `ssid` or `ssid_hex`, `address` (its IP address), and `internet` (whether it reaches the Internet, or `null` if not known yet).
- **Joining** adds the network to those the robot knows and keeps the others, so that a wrong password does not lose a network that worked. A saved network needs no `password`.
- **`register`** is refused with the error `bound` by a robot that is already bound: a new owner needs a reset (PROV-4). The robot uses `server` from then on, as the server it was registered with.
- **`finish`** on a robot that is not registered leaves it unbound: its screen then offers set-up again.

### Errors

An error is a message of type `error`, with `reply_to` when it answers a message, a `code`, and a `message` for people.

| `code` | When |
|---|---|
| `version` | No common major version |
| `busy` | Another session runs |
| `code` | The confirmation is wrong: a wrong code, or someone in between |
| `protocol` | A message out of place, or one that breaks the schema |
| `unknown` | A request the robot does not know, of a newer minor version |
| `wrong_password` | The network refused the password |
| `not_found` | The network is out of reach |
| `no_address` | Joined, but no IP address came |
| `network` | Joining failed otherwise, or took more than `join_timeout` |
| `bound` | `register` on a robot already bound |
| `server` | `server` is not an address the robot accepts |
| `identity` | The robot could not sign |

## The registration

A JWT ([RFC 7519](https://www.rfc-editor.org/rfc/rfc7519)), signed with ES256 by the robot's key, in its TPM ([ADR-0010](../../docs/decisions/0010-device-identity.md)).

| Part | Content |
|---|---|
| Header | `alg`: `ES256`. `typ`: `robot-registration+jwt`, so that it cannot pass for another JWT ([RFC 8725](https://www.rfc-editor.org/rfc/rfc8725), §3.11). `jwk`: the robot's public key ([RFC 7517](https://www.rfc-editor.org/rfc/rfc7517)): `kty` `EC`, `crv` `P-256`, `x`, `y`. |
| `iss`, `sub` | The robot's identifier |
| `aud` | The server's address, as `register` gave it |
| `nonce` | The challenge |
| `jti` | A random identifier |

- **No `iat` or `exp`.** Before it first connects, the robot's clock may not be set. The challenge makes the registration fresh: the server issues it for one registration, and lets it expire.
- **What the server checks**, before it binds:
  1. `alg` is `ES256`, `typ` is `robot-registration+jwt`, `jwk` is a P-256 key, and the signature verifies with it;
  2. `nonce` is a challenge it issued to the owner who sends the registration, unexpired and unused, which it then forgets;
  3. `aud` is its own address;
  4. `iss` equals `sub`, and no robot has this key yet, unless it is already this owner's: a robot that lost its state registers again, and so learns its server again.
- **What it binds** to the owner's account (SEC-3, SEC-6): the robot's identifier, and its key with the key's thumbprint ([RFC 7638](https://www.rfc-editor.org/rfc/rfc7638)), which the robot's assertions name as `kid` ([the cloud protocol](../cloud/README.md#tokens-from-the-server)).
- **The robot learns that it is bound** when the token endpoint of `server` first accepts its assertion. It keeps that, to work offline. An answer of `invalid_client` makes it unbound again: it then offers set-up on its screen (PROV-3).

## Limits

| Field | Limit |
|---|---|
| A message | 8192 bytes |
| `ssid` | 1 to 32 bytes in UTF-8; `ssid_hex`, 2 to 64 hexadecimal digits (IEEE 802.11) |
| `password` | 1 to 128 characters. WPA2 Personal takes 8 to 63 characters, or 64 hexadecimal digits; WPA3 Personal, any length (NetworkManager's `psk`) |
| `challenge` | 16 to 128 base64url characters |
| `server` | Up to 2048 characters: `https://`, or `http://` to the robot itself only, for development, as in the cloud protocol |
| `id`, `reply_to` | 1 to 64 characters |
| An error's `message` | Up to 256 characters |
