# SPDX-License-Identifier: MIT
"""Adapters: the implementations of the ports.

The configuration selects one adapter per port (``adapter = "sim"``). Adapters are
grouped by technology (``sim/``, ``web/``; ALSA, Picamera2 or the body link later), so the
libraries of a technology are imported only when one of its adapters is selected.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from ai_robot.core.config import ConfigError
from ai_robot.core.factory import create, import_object
from ai_robot.ports import PORT_TYPES, Port

# port -> adapter name -> "package.module:Class"
ADAPTERS: dict[str, dict[str, str]] = {
    "audio_in": {"sim": "ai_robot.adapters.sim.audio:SimAudioIn"},
    "audio_out": {"sim": "ai_robot.adapters.sim.audio:SimAudioOut"},
    "camera": {"sim": "ai_robot.adapters.sim.camera:SimCamera"},
    "screen": {
        "sim": "ai_robot.adapters.sim.screen:SimScreen",
        "web": "ai_robot.adapters.web.screen:WebScreen",
    },
    "ai_backend": {"stub": "ai_robot.adapters.sim.ai:StubAIBackend"},
    "drive": {"sim": "ai_robot.adapters.sim.body:SimDriveBase"},
    "joints": {"sim": "ai_robot.adapters.sim.body:SimJoints"},
    "range": {"sim": "ai_robot.adapters.sim.body:SimRangeSensor"},
    "power": {"sim": "ai_robot.adapters.sim.body:SimPower"},
    "lights": {"sim": "ai_robot.adapters.sim.body:SimLights"},
    "safety": {"sim": "ai_robot.adapters.sim.body:SimSafety"},
}


def create_adapter(port: str, table: Mapping[str, Any]) -> Port:
    """Create the adapter selected by ``table``, the ``[ports.<port>]`` table.

    The adapter receives the table's keys as keyword arguments, except ``adapter`` and
    the sub-tables named after adapters; the keys of the sub-table named after the
    selected adapter are added on top.
    """
    adapters = ADAPTERS.get(port)
    if adapters is None:
        raise ConfigError(f"unknown port {port!r}")
    name = table.get("adapter")
    if not isinstance(name, str) or name not in adapters:
        raise ConfigError(
            f"ports.{port}.adapter: expected one of {', '.join(sorted(adapters))}, got {name!r}"
        )
    settings = {
        key: value for key, value in table.items() if key != "adapter" and key not in adapters
    }
    specific = table.get(name, {})
    if not isinstance(specific, Mapping):
        raise ConfigError(f"[ports.{port}.{name}] must be a table")
    settings.update(specific)
    adapter = create(import_object(adapters[name]), f"ports.{port} ({name})", **settings)
    if not isinstance(adapter, PORT_TYPES[port]):
        raise TypeError(f"{adapters[name]} does not implement {PORT_TYPES[port].__name__}")
    return adapter
