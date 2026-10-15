# SPDX-License-Identifier: MIT
"""The registries and the shipped configuration are consistent."""

from __future__ import annotations

import dataclasses
from collections import defaultdict
from pathlib import Path

from ai_robot import messages
from ai_robot.adapters import ADAPTERS
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
