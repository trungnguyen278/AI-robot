# SPDX-License-Identifier: MIT
"""Simulated settings: kept in memory, forgotten on stop."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from ai_robot.ports.settings import SettingsStore


class SimSettingsStore(SettingsStore):
    """Starts with nothing kept: the robot runs with its settings as shipped."""

    def __init__(self) -> None:
        self.values: dict[str, Any] = {}

    async def load(self) -> dict[str, Any]:
        return dict(self.values)

    async def save(self, values: Mapping[str, Any]) -> None:
        self.values = dict(values)
