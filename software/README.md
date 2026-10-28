# software/ — robot software on the Raspberry Pi 5

> **Status:** skeleton. Every port has a simulated adapter, so the whole robot already runs on any computer; real adapters are added as the hardware arrives. Platform: [ADR-0005](../docs/decisions/0005-pi-software-platform.md) (proposed).

Python 3.11 or later (asyncio), with an optional C++ extension. Runtime dependencies:
- [aiohttp](https://docs.aiohttp.org/), for the `web` adapter of the screen;
- [jsonschema](https://python-jsonschema.readthedocs.io/), to check data against the protocols' JSON Schemas;
- [LiveKit's Python SDK](https://docs.livekit.io/reference/python/) (`livekit`, `livekit-api`), for the link to the cloud over WebRTC;
- [cryptography](https://cryptography.io/), for the robot's key kept in software on a development computer;
- [pymicro-wakeword](https://github.com/OHF-Voice/pymicro-wakeword), for wake words, and [pysilero-vad](https://github.com/rhasspy/pysilero-vad), for voice ([ADR-0013](../docs/decisions/0013-listening-on-the-robot.md));
- [sounddevice](https://python-sounddevice.readthedocs.io/), for the microphones and the speaker, through PortAudio: `libportaudio2` on Debian and Raspberry Pi OS;
- [tpm2-pytss](https://github.com/tpm2-software/tpm2-pytss), the `tpm` extra, for the robot's key in its TPM. It builds against the TCG software stack's libraries: `libtss2-dev` on Debian and Raspberry Pi OS.

## How it fits together

```
modules    system · motion · voice · vision · screen · cloud · behavior
             │  talk to each other only through messages on the bus
             │  each one owns some ports
ports      audio_in · audio_out · wake_word · voice_activity · camera · screen
           cloud · identity · daylight
           drive · joints · range · power · lights · safety
             │  implemented by
adapters   sim (any computer, CI)  |  real (on the robot), chosen per profile
```

| Module | Owns ports | Responsibility (planned) |
|---|---|---|
| `system` | `power`, `lights` | Battery reports, with whether the battery is low; status light; the charging scene when plugged in; planned: clean shutdown on low battery |
| `motion` | `drive`, `joints`, `range`, `safety` | Tracks, neck and arms; obstacle and emergency-stop checks |
| `voice` | `audio_in`, `audio_out`, `wake_word`, `voice_activity` | Conversations with the cloud: the wake word, turns, the end of speech when the cloud has not decided it, answers, barge-in; where the conversation is (the interaction state). The voice processor cancels the echo ([ADR-0011](../docs/decisions/0011-audio-voice-processor.md) to [ADR-0013](../docs/decisions/0013-listening-on-the-robot.md)) |
| `vision` | `camera` | People and object detection, face tracking |
| `screen` | `screen` | What the screen shows: the expression and the scene asked with the highest priority, the gaze, the voice, the battery; taps |
| `cloud` | `cloud`, `identity` | The link to `ai-robot-server`, which the robot's identity proves: the cloud calls the capabilities the modules offer, and hears the events they declare; it carries conversations, turns and answers with their audio, for `voice` ([protocol/cloud](../protocol/cloud/README.md)) |
| `behavior` | `daylight` | Decides what the robot does: for now, reactions to taps, the clock when nobody interacts (taps and conversations count), a sleepy face from sunset to sunrise |

- **Module:** one function of the robot (`core/module.py`). It owns some ports and talks to the other modules only through the bus.
- **Message:** what a module tells the others; a frozen dataclass in `messages.py`, whose class is the topic.
- **Port:** the interface to one piece of hardware or one service (`ports/`).
- **Adapter:** an implementation of a port, simulated or real (`adapters/`).
- **Profile:** which adapter each port uses, and its settings (`config/profiles/`).

Lifecycle: open every adapter → `start()` each module in the configured order → run all the modules' `run()` together → on Ctrl+C, SIGTERM or a failing module (also during startup), `stop()` the modules in reverse order → close the adapters. Each shutdown step gets at most `[app] shutdown_step_timeout` seconds; a second Ctrl+C forces the exit.

## Layout

```
software/
├── pyproject.toml          Package, development tools, pytest and ruff settings
├── config/
│   ├── base.toml           Settings shared by every profile, including the robot's display name
│   ├── profiles/           desktop.toml (everything simulated), pi.toml (Raspberry Pi 5)
│   └── local.example.toml  Template for local.toml: settings for one machine (git-ignored)
├── src/ai_robot/
│   ├── __main__.py         Command line (ai-robot)
│   ├── app.py              Builds the robot from the configuration and runs it
│   ├── messages.py         Messages between modules
│   ├── native.py           C++ functions, with pure-Python fallbacks
│   ├── core/               Configuration, bus, module base class, factory
│   ├── ports/              Port interfaces
│   ├── adapters/           Adapter registry; sim/ (simulated), portaudio/ (microphones and speaker), microwakeword/ (wake words), silero/ (voice), web/ (aiohttp: the screen served to a browser), livekit/ (the cloud link), keys/ (keys kept in software), tpm/ (keys in the robot's TPM), sun/ (sunrise and sunset)
│   └── modules/            Module registry and the modules
├── native/                 Optional C++ extension (pybind11 + scikit-build-core)
└── tests/
```

## Run and test

On any computer with Python 3.11 or later (Raspberry Pi OS "Trixie" ships Python 3.13, as of October 2026):

```sh
cd software
python3 -m venv .venv
. .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

ai-robot --profile desktop        # Ctrl+C to stop
pytest
ruff check . && ruff format --check .
```

On the Raspberry Pi, use `--profile pi` or set `AI_ROBOT_PROFILE=pi`. It keeps the robot's identity in its TPM, and runs the simulated adapters for the ports without a real one yet. It needs:
- the TCG software stack's libraries and the `tpm` extra: `sudo apt install libtss2-dev`, then `pip install -e ".[dev,tpm]"`;
- the TPM's overlay in `/boot/firmware/config.txt`: `dtoverlay=tpm-slb9670` ([TPM notes](../hardware/components/letstrust-tpm.md));
- PortAudio, for the microphones and the speaker: `sudo apt install libportaudio2`;
- the voice processor as PipeWire's default input and output, so that everything the robot plays reaches its echo canceller: find its two devices with `wpctl status`, then `wpctl set-default <id>` for each;
- access to `/dev/tpmrm0` for the user who runs the robot, through the `tss` group: `sudo usermod -aG tss "$USER"`, then log in again.

On a Pi without its TPM, select the `file` identity in `config/local.toml` (see `local.example.toml`).

`ai-robot --help` lists the options; `--duration SECONDS` stops the robot after a while, which is handy for quick checks. The environment variables are listed in [`.env.example`](.env.example).

Install with `-e` from this checkout: the configuration is then read from `software/config`, and the protocols' definitions from `protocol/`. With any other kind of install, point:
- `--config-dir` or `AI_ROBOT_CONFIG_DIR` at a configuration directory;
- `AI_ROBOT_PROTOCOL_DIR` at the `protocol` folder;
- the screen's `ui_dir` setting at the `ui` folder.

### The screen

While the robot runs, its screen is at <http://127.0.0.1:8770/>: open it in a browser to watch the face follow the robot. On the robot, Chromium shows that page full screen (kiosk mode). The page is the renderer in [`ui/`](../ui/README.md); the `screen` module decides what it shows, over the [screen protocol](../protocol/screen/README.md).

### Voice

The `voice` module holds the robot's conversations ([ADR-0012](../docs/decisions/0012-end-of-speech.md), [ADR-0013](../docs/decisions/0013-listening-on-the-robot.md)):
- **A turn** starts with the wake word, when the cloud takes conversations; without the cloud, the face shows that the robot cannot talk. The robot streams what it hears until the cloud ends the speech. It ends the speech itself only after a silence (`end_silence`) or 30 s, and cancels a turn in which nobody speaks (`nothing_heard`).
- **Answers** play as they come; one that asks for a follow-up opens a new turn once played.
- **Barge-in:** voice over an answer (`barge_in`) stops it at once and opens a turn, which starts with the words that interrupted.

On a computer the simulated adapters hear silence, so no turn starts. To talk to the robot on a computer with a microphone, select `portaudio` for `audio_in` and `audio_out`, `micro` for `wake_word` and `silero` for `voice_activity` in `config/local.toml`; without a voice processor, its own voice is not cancelled, so use headphones. The wake word is a model of `[ports.wake_word.micro] models`; the robot's own is trained for its name, once the name is chosen.

### The cloud

By default the robot talks to a simulated cloud (the `sim` adapter of the `cloud` port). It opens a session at once and asks for nothing, so the robot runs without a server.

The real link goes through a LiveKit server (the `livekit` adapter, [ADR-0009](../docs/decisions/0009-cloud-link-webrtc.md)). The robot asks `ai-robot-server` for the token that lets it join its room, and proves who it is with its `identity` port: an identifier, and a key that signs for it ([ADR-0010](../docs/decisions/0010-device-identity.md)).
- **Its key.** On the robot, the `tpm` adapter keeps it in the robot's TPM, which makes the key and never lets it out. A factory reset clears the TPM, which gives the robot a new identity, to be set up again. On a development computer, the `file` adapter keeps it in a file of your choosing, made on first use and readable only by you; like SSH, it refuses a key file that others can open. The `sim` adapter, the default, makes a new key at each start, which no server knows.
- **A server.** `ai-robot-server` does not exist yet. To try the link without it, use a development LiveKit server on this computer:
  1. Run [LiveKit's server](https://github.com/livekit/livekit) in development mode: `livekit-server --dev`. Its key is `devkey` and its secret `secret`.
  2. Give the robot that key and secret, with which it makes its own token: `AI_ROBOT_LIVEKIT_API_KEY=devkey` and `AI_ROBOT_LIVEKIT_API_SECRET=secret`, in the environment.
  3. In `config/local.toml`, select the `livekit` adapter, with `tokens = "development"` and the server's address, `ws://127.0.0.1:7880` (see `local.example.toml`).

  The cloud's agent then joins the same room.

The link follows the [cloud protocol](../protocol/cloud/README.md). The cloud sees only the capabilities whose safety class is listed in `[modules.cloud] allowed_classes`, a setting the cloud cannot change. The tests of the link run against a real LiveKit server when one is found: the path to `livekit-server` in `LIVEKIT_SERVER`, or the program on the `PATH`. The tests of the `tpm` adapter run against a software TPM, with the `tpm` extra installed: the path to `swtpm` in `SWTPM`, or the program on the `PATH` (`sudo apt install swtpm`).

### C++ extension

```sh
pip install ./native              # needs a C++17 compiler; pip fetches CMake, pybind11 and scikit-build-core if needed
```

Run it again after changing the C++ code. `ai_robot.native.AVAILABLE` tells whether the extension is in use; without it, the pure-Python fallbacks give the same results (`tests/test_native.py`).

## Configuration

Files are merged in order: `config/base.toml`, then `config/profiles/<profile>.toml`, then `config/local.toml` if present. Tables merge key by key; any other value, lists included, is replaced. `--config-dir` or `AI_ROBOT_CONFIG_DIR` selects another configuration directory.

```toml
[ports.camera]
adapter = "sim"          # the adapter that implements this port
fps = 15.0               # passed to every adapter of this port

[ports.screen.web]       # passed only to the "web" adapter
port = 8770

[modules.system]
battery_interval = 5.0   # passed to the module
```

Settings become keyword arguments of the adapter's or module's constructor, so a misspelt or missing key, or a value of the wrong type, stops the robot at startup with a message that names the table. Secrets such as API keys never go into these files: read them from environment variables.

**Every value worth tuning is in `config/base.toml`**, with a comment: timings, rates, limits, thresholds, colours, hardware values, and what the simulated hardware reports. The code takes each one as a required setting, with no default, so the file shows the values the robot really uses, and a test builds every module and every adapter from it (`tests/test_registry.py`). To change one value on one machine, copy its key into `local.toml`, which git ignores; `local.example.toml` shows how.

What stays in the code, named once at the top of its file:
- values a protocol fixes, with a pointer to its spec in `protocol/`;
- facts, with their source;
- details nobody needs to tune, such as how many message ids the cloud link remembers.

## Extending

- **A module:** create `src/ai_robot/modules/<name>.py` with a `Module` subclass that lists its ports in `owns`; register it in `MODULES` (`modules/__init__.py`); add it to `[modules] enabled` in `config/base.toml`; add tests. When the file grows, turn it into a package (`modules/<name>/__init__.py` importing the class); the registry entry stays the same.
- **A message:** add a frozen dataclass that derives from `Message` to `messages.py`.
- **A port:** add an abstract class that derives from `Port` under `ports/` and register it in `PORT_TYPES`; add a simulated adapter; give the port to one module; configure it in `config/base.toml`.
- **A capability or an event for the cloud:** do it in the module that owns what it touches.
  1. Create a `CapabilityHost` (`core/capabilities.py`) in `__init__`.
  2. `add` each `Capability` with its handler. A capability has a name that starts with the module's name, JSON Schemas for its arguments and its result, and a safety class.
  3. `add_event` each `EventKind`.
  4. `offer()` them in `start`.
  5. Run `serve()` in `run`, and `emit()` the events.

  The cloud module passes them on, and the protocol does not change.
- **An adapter:** implement the port in `adapters/<technology>/` (for example `adapters/alsa/`), register it in `ADAPTERS` (`adapters/__init__.py`) and select it in a profile. Import its libraries only inside that folder, so that the other profiles keep working without them.

## Rules

- Each port has exactly one owner; modules talk only through the bus; hardware and services are reached only through ports.
- Never block the event loop: run blocking library calls with `asyncio.to_thread`, and heavy computation in C++ or in another process.
- No hard-coded values: anything worth tuning lives only in the configuration, and the code takes it as a required setting, with no default (see [Configuration](#configuration)). The full rule is in [AGENTS.md](../AGENTS.md).
- Motion commands expire (`ttl`, at most `max_ttl`), so a hung caller can never leave the robot moving; `motion` is the first module to stop.
- Every C++ function has a pure-Python fallback with the same behavior, and a test that compares them.
- The robot's display name lives only in `config/base.toml` ([ADR-0003](../docs/decisions/0003-neutral-repo-naming.md)).
