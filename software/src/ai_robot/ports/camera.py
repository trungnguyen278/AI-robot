# SPDX-License-Identifier: MIT
"""Camera."""

from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass

from ai_robot.ports.base import Port
from ai_robot.ports.image import Image


@dataclass(frozen=True, slots=True)
class Frame:
    """An image from the camera and the moment it was captured."""

    image: Image
    timestamp: float  # time.monotonic(), in seconds


class Camera(Port):
    """The robot's eyes."""

    @abstractmethod
    async def capture(self) -> Frame:
        """Wait for the next frame and return it."""
