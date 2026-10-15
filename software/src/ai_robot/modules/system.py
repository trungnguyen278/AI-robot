# SPDX-License-Identifier: MIT
"""System: the robot's own health."""

from __future__ import annotations

import asyncio

from ai_robot.core.module import Module, ModuleContext
from ai_robot.messages import BatteryReport
from ai_robot.ports import Color, Lights, Power

READY: Color = (0, 40, 0)  # dim green
OFF: Color = (0, 0, 0)


class SystemModule(Module):
    """Looks after the robot itself: battery reports and the status light.

    Planned: a clean shutdown on low battery (hardware/README.md, open issue 6), the
    Pi's temperature and throttling.
    """

    owns = ("power", "lights")

    def __init__(self, ctx: ModuleContext, *, battery_interval: float = 5.0) -> None:
        super().__init__(ctx)
        if battery_interval <= 0:
            raise ValueError("battery_interval must be positive")
        self.battery_interval = battery_interval
        self.power = self.port("power", Power)
        self.lights = self.port("lights", Lights)

    async def start(self) -> None:
        await self.lights.fill(READY)

    async def run(self) -> None:
        while True:
            self.bus.publish(BatteryReport(await self.power.battery()))
            await asyncio.sleep(self.battery_interval)

    async def stop(self) -> None:
        await self.lights.fill(OFF)
