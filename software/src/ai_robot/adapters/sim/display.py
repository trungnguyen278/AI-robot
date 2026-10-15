# SPDX-License-Identifier: MIT
"""Simulated display."""

from __future__ import annotations

from ai_robot.ports.display import Display
from ai_robot.ports.image import Image


class SimDisplay(Display):
    """A display without a screen: it keeps the last image shown."""

    def __init__(self, *, width: int, height: int) -> None:
        if width <= 0 or height <= 0:
            raise ValueError(f"invalid display size {width}x{height}")
        self._size = (width, height)
        self.last_image: Image | None = None
        self.frames_shown = 0

    @property
    def size(self) -> tuple[int, int]:
        return self._size

    async def show(self, image: Image) -> None:
        if (image.width, image.height) != self._size:
            width, height = self._size
            raise ValueError(
                f"image is {image.width}x{image.height}, the display is {width}x{height}"
            )
        self.last_image = image
        self.frames_shown += 1
