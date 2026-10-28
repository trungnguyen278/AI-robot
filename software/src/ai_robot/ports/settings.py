# SPDX-License-Identifier: MIT
"""Where the robot keeps what its owner chose in its settings
(docs/decisions/0016-settings.md)."""

from __future__ import annotations

from abc import abstractmethod
from collections.abc import Mapping
from typing import Any

from ai_robot.ports.base import Port


class SettingsStore(Port):
    """Keeps the values the owner chose, by setting name, across restarts and updates.
    A factory reset erases them (PRIV-6)."""

    @abstractmethod
    async def load(self) -> dict[str, Any]:
        """The values kept; none if nothing was, or if they cannot be read."""

    @abstractmethod
    async def save(self, values: Mapping[str, Any]) -> None:
        """Keep ``values``, replacing those kept before, whole or not at all."""
