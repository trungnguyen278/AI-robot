# SPDX-License-Identifier: MIT
"""The values the owner chose in the settings, in a JSON file."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from ai_robot.adapters.files import json_file
from ai_robot.ports.settings import SettingsStore

log = logging.getLogger(__name__)


class FileSettingsStore(SettingsStore):
    """Keeps the values in the JSON file at ``path`` (``~`` is the user's home), as an
    object of setting names. A file that cannot be read counts as none, and is logged:
    the robot then runs with its settings as shipped."""

    def __init__(self, *, path: str) -> None:
        if not path:
            raise ValueError("path must not be empty")
        self.path = Path(path).expanduser()

    async def load(self) -> dict[str, Any]:
        return await asyncio.to_thread(self._load)

    async def save(self, values: Mapping[str, Any]) -> None:
        await asyncio.to_thread(json_file.write, self.path, dict(values))

    def _load(self) -> dict[str, Any]:
        try:
            data = json_file.read(self.path)
        except (OSError, ValueError) as error:
            log.error("cannot read the robot's settings in %s: %s", self.path, error)
            return {}
        if data is None:
            return {}
        if not isinstance(data, dict):
            log.error("the robot's settings in %s are not an object", self.path)
            return {}
        return data
