# SPDX-License-Identifier: MIT
"""Daylight."""

from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from datetime import date, datetime

from ai_robot.ports.base import Port


@dataclass(frozen=True, slots=True)
class SunTimes:
    """When the sun rises and sets on one day; the times carry their time zone.

    On a day when the sun neither rises nor sets (near the poles), both times are
    ``None`` and ``up_all_day`` says whether it stays above the horizon.
    """

    sunrise: datetime | None
    sunset: datetime | None
    up_all_day: bool = False


class Daylight(Port):
    """When the sun rises and sets where the robot is.

    Where the times come from is the adapter's business: fixed times, a computation
    from the robot's place, or a service.
    """

    @abstractmethod
    async def sun(self, day: date) -> SunTimes:
        """Sunrise and sunset on ``day``, a date in the robot's local time."""
