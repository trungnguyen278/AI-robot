# SPDX-License-Identifier: MIT
"""A simulated time zone: kept in memory, for computers whose own time zone the robot
must not change."""

from __future__ import annotations

import asyncio
import zoneinfo

from ai_robot.ports.time_zone import TimeZone


class SimTimeZone(TimeZone):
    """Starts at ``zone``, and takes any zone that Python's time zone data knows."""

    def __init__(self, *, zone: str) -> None:
        self._check(zone)
        self.zone = zone

    async def current(self) -> str:
        return self.zone

    async def set(self, zone: str) -> None:
        await asyncio.to_thread(self._check, zone)  # it reads the time zone data
        self.zone = zone

    @staticmethod
    def _check(zone: str) -> None:
        if zone not in zoneinfo.available_timezones():
            raise ValueError(f"{zone!r} is not a time zone")
