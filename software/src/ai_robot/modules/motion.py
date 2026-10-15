# SPDX-License-Identifier: MIT
"""Motion: the tracks, the neck and the arms."""

from __future__ import annotations

from ai_robot.core.module import Module, ModuleContext
from ai_robot.ports import DriveBase, Joints, RangeSensor, Safety


class MotionModule(Module):
    """Moves the body.

    Every drive command expires (see ``DriveBase.drive``), and the body controller stops
    the robot on its own when the Pi goes silent; this module adds the checks the Pi can
    make. Planned: motion requests from behavior, gestures, turning the head towards a
    person, stopping for obstacles and while the emergency stop is pressed.
    """

    owns = ("drive", "joints", "range", "safety")

    def __init__(self, ctx: ModuleContext) -> None:
        super().__init__(ctx)
        self.drive = self.port("drive", DriveBase)
        self.joints = self.port("joints", Joints)
        self.range_sensor = self.port("range", RangeSensor)
        self.safety = self.port("safety", Safety)

    async def start(self) -> None:
        await self.drive.stop()

    async def stop(self) -> None:
        try:
            await self.drive.stop()
        finally:
            await self.joints.hold()
