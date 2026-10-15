# SPDX-License-Identifier: MIT
"""Display."""

from __future__ import annotations

from abc import abstractmethod

from ai_robot.ports.base import Port
from ai_robot.ports.image import Image


class Display(Port):
    """The screen that shows the robot's face."""

    @property
    @abstractmethod
    def size(self) -> tuple[int, int]:
        """Width and height in pixels; known once the port is open."""

    @abstractmethod
    async def show(self, image: Image) -> None:
        """Show ``image`` on the whole screen; it must have the display's size."""
