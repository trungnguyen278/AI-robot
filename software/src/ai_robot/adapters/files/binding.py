# SPDX-License-Identifier: MIT
"""The robot's binding in a JSON file."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from ai_robot.adapters.files import json_file
from ai_robot.ports.binding import Binding, BindingStore

log = logging.getLogger(__name__)


class FileBindingStore(BindingStore):
    """Keeps the binding in the JSON file at ``path`` (``~`` is the user's home).

    A file that cannot be read counts as no binding, and is logged: the robot then
    offers set-up, and setting it up again tells it its server once more.
    """

    def __init__(self, *, path: str) -> None:
        if not path:
            raise ValueError("path must not be empty")
        self.path = Path(path).expanduser()

    async def load(self) -> Binding:
        return await asyncio.to_thread(self._load)

    async def save(self, binding: Binding) -> None:
        value = {"server": binding.server, "bound": binding.bound}
        await asyncio.to_thread(json_file.write, self.path, value)

    def _load(self) -> Binding:
        try:
            data = json_file.read(self.path)
        except (OSError, ValueError) as error:
            log.error("cannot read the robot's binding in %s: %s", self.path, error)
            return Binding()
        if data is None:
            return Binding()
        server = data.get("server") if isinstance(data, dict) else None
        bound = data.get("bound") if isinstance(data, dict) else None
        if not (server is None or isinstance(server, str)) or not isinstance(bound, bool):
            log.error("the robot's binding in %s is not one", self.path)
            return Binding()
        return Binding(server, bound)
