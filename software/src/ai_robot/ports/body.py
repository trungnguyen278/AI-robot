# SPDX-License-Identifier: MIT
"""The body: chassis, joints, distance sensor, battery, status lights, emergency stop.

These parts sit behind the body controller, which is not chosen yet
(docs/decisions/0004); until then only simulated adapters exist.
"""

from __future__ import annotations

from abc import abstractmethod
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from ai_robot.ports.base import Port
from ai_robot.ports.image import Color


@dataclass(frozen=True, slots=True)
class Pose:
    """Position on the floor, relative to where odometry started."""

    x: float = 0.0  # metres, forward at the start
    y: float = 0.0  # metres, to the left at the start
    heading: float = 0.0  # radians, counter-clockwise, above -pi and up to pi


class DriveBase(Port):
    """The tracked chassis, driven like a differential-drive robot."""

    @abstractmethod
    async def drive(self, linear: float, angular: float, *, ttl: float) -> None:
        """Move at ``linear`` m/s (forward is positive) and ``angular`` rad/s
        (counter-clockwise is positive) for at most ``ttl`` seconds.

        The command expires: the chassis stops after ``ttl`` unless a new command
        arrives, so a caller that hangs can never leave the robot driving. Speeds beyond
        the chassis's limits are clamped, and so is a ``ttl`` beyond the longest command
        allowed (the ``max_ttl`` setting). A value that is not a finite number, or a
        ``ttl`` that is not positive, raises ``ValueError``.
        """

    @abstractmethod
    async def stop(self) -> None:
        """Stop now."""

    @abstractmethod
    async def odometry(self) -> Pose:
        """The pose estimated from the wheel encoders."""


@dataclass(frozen=True, slots=True)
class JointInfo:
    """A joint and its limits, in radians."""

    name: str
    lower: float
    upper: float
    home: float = 0.0

    def __post_init__(self) -> None:
        if not self.lower <= self.home <= self.upper:
            raise ValueError(
                f"joint {self.name!r}: expected lower <= home <= upper, "
                f"got {self.lower}, {self.home}, {self.upper}"
            )


def parse_joints(entries: Iterable[Mapping[str, Any]]) -> tuple[JointInfo, ...]:
    """The joint list from the configuration: the ``joints`` setting of [ports.joints]."""
    joints: list[JointInfo] = []
    for index, entry in enumerate(entries):
        try:
            joints.append(JointInfo(**entry))
        except TypeError as error:
            raise ValueError(f"joints[{index}]: {error}") from None
    names = [joint.name for joint in joints]
    duplicates = sorted({name for name in names if names.count(name) > 1})
    if duplicates:
        raise ValueError(f"duplicate joint names: {', '.join(duplicates)}")
    return tuple(joints)


class Joints(Port):
    """The neck and arm joints."""

    @property
    @abstractmethod
    def info(self) -> Sequence[JointInfo]:
        """Every joint, with its limits."""

    @abstractmethod
    async def move(self, targets: Mapping[str, float], duration: float) -> None:
        """Start moving joints to the angles in ``targets`` so that they arrive after
        ``duration`` seconds; returns without waiting for them.

        Angles beyond a joint's limits are clamped. An unknown joint name raises
        ``KeyError``, and a value that is not a finite number (or a negative duration)
        raises ``ValueError``; either way nothing moves.
        """

    @abstractmethod
    async def hold(self) -> None:
        """Stop every joint where it is."""

    @abstractmethod
    async def positions(self) -> dict[str, float]:
        """The current angle of every joint."""


class RangeSensor(Port):
    """Distance to the nearest obstacle ahead."""

    @abstractmethod
    async def distance(self) -> float | None:
        """Distance in metres, or ``None`` if nothing is in range."""


@dataclass(frozen=True, slots=True)
class BatteryStatus:
    voltage: float  # volts
    percent: float | None = None  # state of charge from 0 to 100, if known
    charging: bool | None = None  # if known


class Power(Port):
    """Battery monitoring."""

    @abstractmethod
    async def battery(self) -> BatteryStatus:
        """The battery's present state."""


class Lights(Port):
    """Status LEDs."""

    @abstractmethod
    async def fill(self, color: Color) -> None:
        """Set every LED to ``color``."""


class Safety(Port):
    """The emergency stop."""

    @abstractmethod
    async def estop_engaged(self) -> bool:
        """``True`` while the emergency stop is pressed."""
