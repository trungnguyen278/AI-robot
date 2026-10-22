# SPDX-License-Identifier: MIT
"""The registries and the shipped configuration are consistent."""

from __future__ import annotations

import dataclasses
import re
import tomllib
from collections import defaultdict
from pathlib import Path

from ai_robot import messages
from ai_robot.adapters import ADAPTERS, create_adapter
from ai_robot.app import App
from ai_robot.core.bus import Message
from ai_robot.core.config import available_profiles, load_config
from ai_robot.core.factory import import_object
from ai_robot.modules import MODULES
from ai_robot.ports import PORT_TYPES


def test_every_adapter_implements_its_port() -> None:
    assert set(ADAPTERS) == set(PORT_TYPES)
    for port, adapters in ADAPTERS.items():
        for path in adapters.values():
            assert issubclass(import_object(path), PORT_TYPES[port]), path


def test_every_port_has_exactly_one_owner() -> None:
    owners: dict[str, list[str]] = defaultdict(list)
    for name, path in MODULES.items():
        for port in import_object(path).owns:
            owners[port].append(name)
    assert set(owners) == set(PORT_TYPES)
    assert {port: names for port, names in owners.items() if len(names) > 1} == {}


def test_messages_are_frozen_dataclasses() -> None:
    classes = [
        value
        for value in vars(messages).values()
        if isinstance(value, type) and issubclass(value, Message) and value is not Message
    ]
    assert classes
    for cls in classes:
        assert dataclasses.is_dataclass(cls), cls.__name__
        assert cls.__dataclass_params__.frozen, cls.__name__  # type: ignore[attr-defined]


def test_shipped_profiles_build(shipped_config: Path) -> None:
    profiles = available_profiles(shipped_config)
    assert {"desktop", "pi"} <= set(profiles)
    for profile in profiles:
        App(load_config(profile, shipped_config)).build()


# What the configuration cannot ship, because it belongs to one robot or one machine.
MACHINE_SPECIFIC = {
    ("cloud", "livekit"): {"url": "https://cloud.example"},
    ("identity", "file"): {"path": "identity.json"},
    ("daylight", "solar"): {"latitude": 21.03, "longitude": 105.85},
}


def test_every_adapter_builds_from_the_shipped_configuration(shipped_config: Path) -> None:
    """The configuration holds every setting of every adapter, even of those no profile
    selects yet: nothing has a default hidden in the code."""
    ports = load_config("desktop", shipped_config)["ports"]
    for port, adapters in ADAPTERS.items():
        for name in adapters:
            table = {**ports[port], "adapter": name}
            extra = MACHINE_SPECIFIC.get((port, name))
            if extra is not None:
                table[name] = {**table.get(name, {}), **extra}
            create_adapter(port, table)


def uncommented(text: str) -> str:
    """An example configuration with its commented-out settings switched on: lines such
    as "# [table]" and "# key = value", not the prose around them."""
    setting = re.compile(r"\[[\w.]+\]$|[A-Za-z_]\w* = ")
    return "\n".join(
        line[2:] if line.startswith("# ") and setting.match(line[2:]) else line
        for line in text.splitlines()
    )


def test_the_local_example_works_as_a_local_toml(shipped_config: Path) -> None:
    """Every setting in local.example.toml exists, with a value of the right type, so
    that the template never leads anyone astray."""
    local = uncommented((shipped_config / "local.example.toml").read_text(encoding="utf-8"))
    assert sum(len(table) for table in tomllib.loads(local).values()) >= 5  # found some
    (shipped_config / "local.toml").write_text(local, encoding="utf-8")
    App(load_config("desktop", shipped_config)).build()
