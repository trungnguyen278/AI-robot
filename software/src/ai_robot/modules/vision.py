# SPDX-License-Identifier: MIT
"""Vision: what the camera sees."""

from __future__ import annotations

from ai_robot.core.module import Module, ModuleContext
from ai_robot.ports import Camera


class VisionModule(Module):
    """Looks through the camera.

    Planned: people and object detection on the AI camera, tracking a face with the
    neck, and messages describing what is seen.
    """

    owns = ("camera",)

    def __init__(self, ctx: ModuleContext) -> None:
        super().__init__(ctx)
        self.camera = self.port("camera", Camera)
        self.frames = 0

    async def run(self) -> None:
        while True:
            await self.camera.capture()
            self.frames += 1
