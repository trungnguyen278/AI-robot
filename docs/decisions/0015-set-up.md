# 0015 — Set-up: the app over Bluetooth LE, secured by a code on the robot's screen

- **Status:** Accepted
- **Date:** 2026-10-24

## Context

- What set-up must do (the [requirements](../../protocol/cloud/requirements.md), §10):
  - give the robot a Wi-Fi network, and register its key with the owner's account (PROV-1, SEC-3);
  - prove that the robot joining the account is the one in front of the owner (PROV-2). [ADR-0010](0010-device-identity.md) chose a code shown on its screen, and left the protocol to this decision;
  - until then, the robot refuses all but set-up and says so (PROV-3), and only a reset gives it to a new owner (PROV-4);
  - Bluetooth set-up is open only on request and for a limited time (SEC-16), and the Wi-Fi password is never shown or logged (SEC-5).
- What it must withstand:
  - **someone listening within Bluetooth range.** The Wi-Fi password and the registration cross the air;
  - **a nearby device posing as the robot**, to receive the password;
  - **someone binding a robot that is not theirs**, or getting an owner to bind theirs. Such a robot would then receive the owner's data.
- The robot has Bluetooth 5.0 with LE, driven by BlueZ ([Raspberry Pi 5](../../hardware/components/raspberry-pi-5.md)). Raspberry Pi OS manages networks with NetworkManager since Bookworm. On Ubuntu, which [ADR-0017](0017-ros-2.md) proposes instead, the robot's image makes NetworkManager netplan's renderer; Ubuntu 26.04's NetworkManager (1.54) and BlueZ (5.85) keep the same polkit and D-Bus policies (checked 2026-10-27). Both are driven through D-Bus.
- **The previous generation** showed a 6-digit PIN on the robot's screen ([legacy](../legacy.md)). The app wrote that PIN, the Wi-Fi password and a long-lived device token to Bluetooth characteristics in clear, so anyone listening nearby got all three.
- How others do it:

| System | Transport | What protects it |
|---|---|---|
| Matter | BLE (also Wi-Fi, Thread) | PASE: SPAKE2+ with a 27-bit setup code, from a QR code or an 11-digit manual code. A 12-bit discriminator finds the device. The window lasts 3 to 15 minutes and closes after 20 failed attempts. A fail-safe undoes a commissioning that does not complete. Then come device attestation, an operational certificate, the network, and sessions with that certificate. |
| Apple HomeKit | BLE or IP | SRP (3072-bit) with an 8-digit code. The two sides then exchange Ed25519 long-term keys, which authenticate every later session. |
| ESP-IDF provisioning | BLE, or a Wi-Fi access point | Security 2: SRP-6a and AES-GCM, with a password given out of band, such as a QR code. |
| Improv (ESPHome; Home Assistant Voice) | BLE | No encryption in the protocol; an optional physical authorization, such as a button, that times out. |
| BerryLan (`nymea-networkmanager`, Raspberry Pi) | BLE, in front of NetworkManager | None: JSON with the password, in 20-byte packets. It opens while offline, for 3 minutes after start, or on a button. |
| Reachy Mini (Wireless) | Its own Wi-Fi access point | The app joins it, then gives the home network. |
| TVs; `gh auth login` (RFC 8628) | The device's own Internet connection | A code on the device's screen, approved on a phone that is signed in. |

## Decision

1. **Set-up goes through the app, over Bluetooth LE.** One session sets the Wi-Fi network, then registers the robot (PROV-1, SEC-3).
   - The touch screen may set the Wi-Fi network itself, in its settings. Registration always goes through the app.
2. **A code on the robot's screen secures the session, through SPAKE2+.** This is [RFC 9383](https://www.rfc-editor.org/rfc/rfc9383), on P-256 with SHA-256, HKDF and HMAC: the PAKE that Matter uses for the same purpose.
   - The robot shows a random 8-digit code, and a QR code that carries it. The owner scans it or types it into the app (PROV-2).
   - The code never crosses the air. Someone listening learns nothing from the exchange, and someone guessing gets one guess per attempt.
   - Every message after the exchange is encrypted and authenticated, with AES-GCM and keys that come from it.
   - A failed attempt brings a new code. After 20 failures, as in Matter, set-up closes until it is asked for again.
3. **Set-up is open only when asked, and for a limited time** (SEC-16).
   - The robot advertises over Bluetooth only while set-up is open: from start while it is not bound (PROV-3), or when the owner asks on its screen.
   - Set-up closes after 15 minutes (Matter's longest window), when it is complete, or when it is cancelled. One session at a time.
4. **The app relays a registration that the robot signs**, as a browser relays a security key's registration in WebAuthn.
   1. The app asks `ai-robot-server` for a challenge, with the owner's credentials.
   2. The robot signs a registration with its TPM key ([ADR-0010](0010-device-identity.md)). It carries the robot's identifier, its public key, the challenge and the server's address.
   3. The app sends the registration to the server. The server checks the signature and the challenge, then binds the key to the owner's account (SEC-6).
   4. From then on, the robot uses the server it was registered with.
5. **The robot learns that it is bound from the server only.** It is bound once the token endpoint first accepts its assertion, and it keeps that, so as to work offline.
   - It is unbound again when the endpoint answers `invalid_client`, for a key that is unknown or revoked.
   - While unbound, it shows the set-up screen and refuses all but set-up (PROV-3).
   - A bound robot refuses a new registration. A new owner needs a factory reset, which clears the TPM and so gives the robot a new key (PROV-4, [ADR-0014](0014-updates.md)).
6. **The Wi-Fi network goes to NetworkManager**, the system's network service, through its D-Bus interface. It keeps the password readable by root only, and reconnects by itself.
7. **The protocol is defined in [`protocol/setup/`](../../protocol/setup/README.md).** That covers the Bluetooth service, how messages are split to fit it, the exchange, and the messages.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Bluetooth's own pairing, LE Secure Connections with a passkey or numeric comparison | Standard, with no cryptography of ours. But each phone's system runs it differently, and the bond belongs to the phone, not to the app or its user. The Method Confusion attack (IEEE S&P 2021) defeats it when one side compares numbers while the other enters a passkey. Matter, HomeKit and ESP-IDF all protect set-up above Bluetooth instead. |
| No protection on the air, only a button or a time limit (Improv; BerryLan; the previous generation, with its PIN) | Anyone within range can read the Wi-Fi password, and the previous generation's token. |
| A Wi-Fi access point on the robot (Reachy Mini; balena's WiFi Connect) | The phone must leave its own network for the robot's, which has no Internet. The requirements ask for Bluetooth LE (PROV-1). |
| Binding through the device authorization grant ([RFC 8628](https://www.rfc-editor.org/rfc/rfc8628)): the robot, once online, shows a code that the owner approves in the app | A standard, and one flow for the touch screen and the app. But a code can be approved from anywhere. Someone can send theirs to an owner, who then binds a stranger's robot to their account (RFC 8628, §5.4). A Bluetooth session needs the owner's phone next to the robot. The grant also needs the robot online before anything is checked. |
| A long random key in the QR code, with ECDH and no PAKE | Only standard primitives. But the code must also be possible to type (PROV-2's own example), and a code short enough to type needs a PAKE. |
| SRP-6a (HomeKit, ESP-IDF) | Proven, but with 3072-bit numbers and an older design. SPAKE2+ is an RFC from 2023, on P-256, with test vectors, and it is Matter's choice. |
| SPAKE2 ([RFC 9382](https://www.rfc-editor.org/rfc/rfc9382)), or CPace | A balanced PAKE would do for a code that changes each time. SPAKE2+ costs one more point. In return the robot keeps only a verifier, should a printed code ever be needed. CPace is still a draft, in IESG review as of April 2026. |
| Making the robot a Matter device | Phones would commission it themselves. But that means certification, attestation certificates listed on the Connectivity Standards Alliance's ledger, and the Matter stack, for a robot that is not a smart-home accessory. |

## Consequences

- Positive:
  - nothing secret crosses the air, and binding needs both the owner's phone next to the robot and the code on its screen;
  - the server has no open endpoint where a robot claims an owner: the owner registers the robot, and the robot signs;
  - one session sets up the Wi-Fi and the registration, and the same session changes the Wi-Fi later;
  - the owner chooses the server, through the app;
  - a flow known from Matter, built from standard parts: an RFC PAKE, AES-GCM, JWT, BlueZ and NetworkManager.
- Negative / accepted trade-offs:
  - **A PAKE to implement on both sides**, checked against RFC 9383's test vectors. Python's `cryptography` has no point arithmetic, so the robot uses PyCryptodome for it. Its scalar multiplications are constant-time and blinded;
  - the app must implement SPAKE2+ too;
  - the code also shows on any screen page that the owner has opened to the network;
  - a robot cannot be registered without the app.
- Follow-up:
  - the protocol, in `protocol/setup/`;
  - on the robot, a `setup` module with two ports and their simulated adapters. One port is Bluetooth (BlueZ, through `dbus-fast`), the other the network (NetworkManager, through `dbus-fast`);
  - the screen's set-up scene, with the code as a QR code;
  - the server: the challenge and the registration, for the app;
  - the image: NetworkManager's connections and the robot's state go on the data partition ([ADR-0014](0014-updates.md)), encrypted with a key that the TPM seals;
  - device attestation with the TPM's endorsement key, if the server must know that a key is in a real TPM;
  - later sessions from the owner's phone, for settings and remote control over Bluetooth. They need long-term keys, as HomeKit's pair verify or Matter's operational sessions use.

## References

Retrieved 2026-10-24:

- [RFC 9383](https://www.rfc-editor.org/rfc/rfc9383), SPAKE2+; [RFC 9382](https://www.rfc-editor.org/rfc/rfc9382), SPAKE2; [CPace](https://datatracker.ietf.org/doc/draft-irtf-cfrg-cpace/), draft 21.
- Matter commissioning: [Google's primer](https://developers.home.google.com/matter/primer/commissioning) (the steps, the fail-safe); [Silicon Labs](https://docs.silabs.com/matter/2.5.1/matter-overview-guides/matter-commissioning) (the 27-bit passcode and 12-bit discriminator); [`CommissioningWindowManager`](https://github.com/project-chip/connectedhomeip/blob/master/src/app/server/CommissioningWindowManager.cpp) in the Matter SDK (20 failed attempts, from the specification's section 13.3; a window of 3 to 15 minutes, from section 5.4.2.3).
- [HomeKit communication security](https://support.apple.com/guide/security/sec3a881ccb1/web), Apple Platform Security.
- [Unified Provisioning](https://docs.espressif.com/projects/esp-idf/en/v5.1/esp32/api-reference/provisioning/provisioning.html), ESP-IDF.
- [Improv over BLE](https://www.improv-wifi.com/ble/); [`nymea-networkmanager`](https://github.com/nymea/nymea-networkmanager) (BerryLan).
- [Reachy Mini, getting started](https://huggingface.co/docs/reachy_mini/platforms/reachy_mini/get_started); [balena WiFi Connect](https://github.com/balena-os/wifi-connect).
- [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628), §5.4, remote phishing.
- Method Confusion: [the Bluetooth SIG's notice](https://www.bluetooth.com/learn-about-bluetooth/bluetooth-technology/bluetooth-security/method-vulnerability/); von Tschirschnitz et al., "Method Confusion Attack on Bluetooth Pairing", IEEE Symposium on Security and Privacy 2021.
- [WebAuthn Level 3](https://www.w3.org/TR/webauthn-3/#sctn-registering-a-new-credential), registering a new credential.
- BlueZ's [`GattManager1`](https://github.com/bluez/bluez/blob/master/doc/org.bluez.GattManager.rst); [`dbus-fast`](https://github.com/bluetooth-devices/dbus-fast); [NetworkManager on Raspberry Pi OS Bookworm](https://www.jeffgeerling.com/blog/2023/nmcli-wifi-on-raspberry-pi-os-12-bookworm/) (Jeff Geerling, 2023).
- PyCryptodome: [changes](https://github.com/Legrandin/pycryptodome/blob/master/Changelog.rst) (4.0.0, constant-time arithmetic) and [`ec_nat.c`](https://github.com/Legrandin/pycryptodome/blob/master/src/ec_nat.c).
