# SPDX-License-Identifier: MIT
"""System: the robot's own health."""

from __future__ import annotations

import asyncio

from ai_robot.core.checks import positive
from ai_robot.core.module import Module, ModuleContext
from ai_robot.messages import BatteryReport, SceneRequest
from ai_robot.ports import Color, Lights, Power

READY: Color = (0, 40, 0)  # dim green
OFF: Color = (0, 0, 0)

CHARGING_SCENE = "charging"
CHARGING_SECONDS = 4.0  # how long the charging scene stays after the robot is plugged in


class SystemModule(Module):
    """Looks after the robot itself: battery reports and the status light.

    It also shows the charging scene for a few seconds when the robot is plugged in:
    on a change from not charging to charging, not merely on a report that says
    charging (the robot may start on its charger), and an unknown reading changes
    nothing.

    Planned: a clean shutdown on low battery (hardware/README.md, open issue 6), the
    Pi's temperature and throttling.
    """

    owns = ("power", "lights")

    def __init__(self, ctx: ModuleContext, *, battery_interval: float) -> None:
        super().__init__(ctx)
        self.battery_interval = positive("battery_interval", battery_interval)
        self.power = self.port("power", Power)
        self.lights = self.port("lights", Lights)
        self._charging: bool | None = None  # the last known charging state

    async def start(self) -> None:
        await self.lights.fill(READY)

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
            self.bus.publish(SceneRequest(self.name, CHARGING_SCENE, duration=CHARGING_SECONDS))
        elif not charging and self._charging:
            self.bus.publish(SceneRequest(self.name, None))
        self._charging = charging
