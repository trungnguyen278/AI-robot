# software/ — robot software on the Raspberry Pi 5

> **Status:** skeleton. Every port has a simulated adapter, so the whole robot already runs on any computer; real adapters are added as the hardware arrives. Platform: [ADR-0005](../docs/decisions/0005-pi-software-platform.md) (proposed).

Python 3.11 or later (asyncio), with an optional C++ extension. No runtime dependencies yet.

## How it fits together

```
modules    system · motion · voice · vision · face · behavior
             │  talk to each other only through messages on the bus
             │  each one owns some ports
ports      audio_in · audio_out · camera · display · ai_backend
           drive · joints · range · power · lights · safety
             │  implemented by
adapters   sim (any computer, CI)  |  real (on the robot), chosen per profile
```

| Module | Owns ports | Responsibility (planned) |
|---|---|---|
| `system` | `power`, `lights` | Battery reports, status light, clean shutdown on low battery |
| `motion` | `drive`, `joints`, `range`, `safety` | Tracks, neck and arms; obstacle and emergency-stop checks |
| `voice` | `audio_in`, `audio_out`, `ai_backend` | Wake word, voice activity detection, echo cancellation, conversation |
| `vision` | `camera` | People and object detection, face tracking |
| `face` | `display` | Expressive eyes |
| `behavior` | — | Decides what the robot does; publishes the interaction state |

- **Module:** one function of the robot (`core/module.py`). It owns some ports and talks to the other modules only through the bus.
- **Message:** what a module tells the others; a frozen dataclass in `messages.py`, whose class is the topic.
- **Port:** the interface to one piece of hardware or one service (`ports/`).
- **Adapter:** an implementation of a port, simulated or real (`adapters/`).
- **Profile:** which adapter each port uses, and its settings (`config/profiles/`).

Lifecycle: open every adapter → `start()` each module in the configured order → run all the modules' `run()` together → on Ctrl+C, SIGTERM or a failing module, `stop()` the modules in reverse order → close the adapters.

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
│   ├── adapters/           Adapter registry; sim/ holds the simulated adapters
│   └── modules/            Module registry and the modules
├── native/                 Optional C++ extension (pybind11 + scikit-build-core)
└── tests/
```

## Run and test

On any computer with Python 3.11 or later (Raspberry Pi OS "Trixie" ships 3.13):

```sh
cd software
python3 -m venv .venv
. .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

ai-robot --profile desktop        # Ctrl+C to stop
pytest
ruff check . && ruff format --check .
```

On the Raspberry Pi, use `--profile pi` or set `AI_ROBOT_PROFILE=pi`; until real adapters exist it behaves like `desktop`. `ai-robot --help` lists the options; `--duration SECONDS` stops the robot after a while, which is handy for quick checks.

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

[ports.display.sim]      # passed only to the "sim" adapter
width = 1024

[modules.system]
battery_interval = 5.0   # passed to the module
```

Settings become keyword arguments of the adapter's or module's constructor, so a misspelt or missing key stops the robot at startup with a message that names the table. Secrets such as API keys never go into these files: read them from environment variables.

## Extending

- **A module:** create `src/ai_robot/modules/<name>.py` with a `Module` subclass that lists its ports in `owns`; register it in `MODULES` (`modules/__init__.py`); add it to `[modules] enabled` in `config/base.toml`; add tests. When the file grows, turn it into a package (`modules/<name>/__init__.py` importing the class); the registry entry stays the same.
- **A message:** add a frozen dataclass that derives from `Message` to `messages.py`.
- **A port:** add an abstract class that derives from `Port` under `ports/` and register it in `PORT_TYPES`; add a simulated adapter; give the port to one module; configure it in `config/base.toml`.
- **An adapter:** implement the port in `adapters/<technology>/` (for example `adapters/alsa/`), register it in `ADAPTERS` (`adapters/__init__.py`) and select it in a profile. Import its libraries only inside that folder, so that the other profiles keep working without them.

## Rules

- Each port has exactly one owner; modules talk only through the bus; hardware and services are reached only through ports.
- Never block the event loop: run blocking library calls with `asyncio.to_thread`, and heavy computation in C++ or in another process.
- Motion commands expire (`ttl`), so a hung caller can never leave the robot moving.
- Every C++ function has a pure-Python fallback with the same behavior, and a test that compares them.
- The robot's display name lives only in `config/base.toml` ([ADR-0003](../docs/decisions/0003-neutral-repo-naming.md)).
