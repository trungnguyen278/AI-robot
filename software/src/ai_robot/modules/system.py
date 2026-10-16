# SPDX-License-Identifier: MIT
"""System: the robot's own health."""

from __future__ import annotations

import asyncio

from ai_robot.core.checks import positive
from ai_robot.core.module import Module, ModuleContext
from ai_robot.messages import BatteryReport, SceneRequest
from ai_robot.ports import Color, Lights, Power
from ai_robot.ports.image import check_color

OFF: Color = (0, 0, 0)

CHARGING_SCENE = "charging"


class SystemModule(Module):
    """Looks after the robot itself: battery reports and the status light.

    It also shows the charging scene for ``charging_scene_seconds`` when the robot is
    plugged in:
    on a change from not charging to charging, not merely on a report that says
    charging (the robot may start on its charger), and an unknown reading changes
    nothing.

    Planned: a clean shutdown on low battery (hardware/README.md, open issue 6), the
    Pi's temperature and throttling.
    """

    owns = ("power", "lights")

    def __init__(
        self,
        ctx: ModuleContext,
        *,
        battery_interval: float,
        charging_scene_seconds: float,
        ready_color: list[int],
    ) -> None:
        super().__init__(ctx)
        self.battery_interval = positive("battery_interval", battery_interval)
        self.charging_scene_seconds = positive("charging_scene_seconds", charging_scene_seconds)
        self.ready_color = check_color(ready_color)  # the status light while the robot runs
        self.power = self.port("power", Power)
        self.lights = self.port("lights", Lights)
        self._charging: bool | None = None  # the last known charging state

    async def start(self) -> None:
        await self.lights.fill(self.ready_color)

    async def run(self) -> None:
        while True:
            status = await self.power.battery()
            self.bus.publish(BatteryReport(status))
            self._watch_charger(status.charging)
            await asyncio.sleep(self.battery_interval)

    async def stop(self) -> None:
        await self.lights.fill(OFF)

    def _watch_charger(self, charging: bool | None) -> None:
        if charging is None:
            return
        if charging and self._charging is False:
            self.bus.publish(
                SceneRequest(self.name, CHARGING_SCENE, duration=self.charging_scene_seconds)
            )
        elif not charging and self._charging:
            self.bus.publish(SceneRequest(self.name, None))
        self._charging = charging
