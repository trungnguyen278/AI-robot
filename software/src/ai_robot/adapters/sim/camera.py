# SPDX-License-Identifier: MIT
"""Simulated camera."""

from __future__ import annotations

import time

from ai_robot.adapters.sim.pacing import Pacer
from ai_robot.core.checks import positive
from ai_robot.ports.camera import Camera, Frame
from ai_robot.ports.image import Image


class SimCamera(Camera):
    """A camera that sees a plain grey image, at the configured frame rate."""

    def __init__(self, *, width: int, height: int, fps: float) -> None:
        self._image = Image.filled(width, height, (64, 64, 64))
        self._pacer = Pacer(1.0 / positive("fps", fps))

    async def capture(self) -> Frame:
        await self._pacer.wait()
        return Frame(self._image, time.monotonic())
