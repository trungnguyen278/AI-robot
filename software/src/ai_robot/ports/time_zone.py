# SPDX-License-Identifier: MIT
"""The time zone."""

from __future__ import annotations

from abc import abstractmethod

from ai_robot.ports.base import Port


class TimeZone(Port):
    """The robot's time zone: the operating system's, which every program on the robot
    follows, the browser that draws its face included. Zones are IANA names
    (``Asia/Ho_Chi_Minh``)."""

    @abstractmethod
    async def current(self) -> str:
        """The time zone now."""

    @abstractmethod
    async def set(self, zone: str) -> None:
        """Make ``zone`` the robot's time zone. ``ValueError`` if it is not a zone the
        system knows; ``OSError`` if the system refuses."""
