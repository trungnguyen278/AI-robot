# SPDX-License-Identifier: MIT
"""Simulated body: chassis, joints, distance sensor, battery, lights, emergency stop."""

from __future__ import annotations

import math
import time
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from ai_robot.core.checks import finite, positive
from ai_robot.ports.body import (
    BatteryStatus,
    DriveBase,
    JointInfo,
    Joints,
    Lights,
    Pose,
    Power,
    RangeSensor,
    Safety,
    parse_joints,
)
from ai_robot.ports.image import Color, check_color

Clock = Callable[[], float]


class SimDriveBase(DriveBase):
    """Integrates the commanded speeds into a pose, with speed limits and command expiry."""

    def __init__(
        self,
        *,
        max_linear: float,
        max_angular: float,
        max_ttl: float,
        clock: Clock = time.monotonic,
    ) -> None:
        self.max_linear = positive("max_linear", max_linear)
        self.max_angular = positive("max_angular", max_angular)
        self.max_ttl = positive("max_ttl", max_ttl)
        self._clock = clock
        self._pose = Pose()
        self._linear = 0.0
        self._angular = 0.0
        self._expires = 0.0
        self._updated = clock()

    async def drive(self, linear: float, angular: float, *, ttl: float) -> None:
        linear = _clamp(finite("linear", linear), self.max_linear)
        angular = _clamp(finite("angular", angular), self.max_angular)
        ttl = min(positive("ttl", ttl), self.max_ttl)
        self._advance()
        self._linear, self._angular = linear, angular
        self._expires = self._updated + ttl

    async def stop(self) -> None:
        self._advance()
        self._linear = self._angular = 0.0

    async def odometry(self) -> Pose:
        self._advance()
        return self._pose

    def _advance(self) -> None:
        """Bring the pose up to the present, stopping when the command expired."""
        now = self._clock()
        moving_until = min(now, self._expires)
        if moving_until > self._updated and (self._linear or self._angular):
            self._pose = _integrate(
                self._pose, self._linear, self._angular, moving_until - self._updated
            )
        if now >= self._expires:
            self._linear = self._angular = 0.0
        self._updated = now


def _clamp(value: float, limit: float) -> float:
    return max(-limit, min(limit, value))


def _integrate(pose: Pose, linear: float, angular: float, dt: float) -> Pose:
    """Exact pose after moving at constant speeds for ``dt`` seconds."""
    heading = pose.heading + angular * dt
    if abs(angular) < 1e-9:
        x = pose.x + linear * dt * math.cos(pose.heading)
        y = pose.y + linear * dt * math.sin(pose.heading)
    else:
        radius = linear / angular
        x = pose.x + radius * (math.sin(heading) - math.sin(pose.heading))
        y = pose.y - radius * (math.cos(heading) - math.cos(pose.heading))
    return Pose(x, y, _wrap(heading))


def _wrap(angle: float) -> float:
    """``angle`` brought into the range above -pi and up to pi."""
    wrapped = math.remainder(angle, math.tau)
    return math.pi if wrapped == -math.pi else wrapped


class SimJoints(Joints):
    """Joints that move at a constant speed so as to reach their targets on time."""

    def __init__(
        self, *, joints: Sequence[Mapping[str, Any]], clock: Clock = time.monotonic
    ) -> None:
        self._info = parse_joints(joints)
        self._by_name = {joint.name: joint for joint in self._info}
        self._clock = clock
        now = clock()
        # joint name -> (start angle, target angle, start time, duration)
        self._motion = {joint.name: (joint.home, joint.home, now, 0.0) for joint in self._info}

    @property
    def info(self) -> Sequence[JointInfo]:
        return self._info

    async def move(self, targets: Mapping[str, float], duration: float) -> None:
        unknown = sorted(set(targets) - self._by_name.keys())
        if unknown:
            raise KeyError(f"unknown joints: {', '.join(unknown)}")
        if finite("duration", duration) < 0:
            raise ValueError(f"duration must not be negative, got {duration!r}")
        for name, target in targets.items():
            finite(name, target)
        now = self._clock()
        for name, target in targets.items():
            joint = self._by_name[name]
            clamped = max(joint.lower, min(joint.upper, target))
            self._motion[name] = (self._angle(name, now), clamped, now, duration)

    async def hold(self) -> None:
        now = self._clock()
        for name in self._motion:
            angle = self._angle(name, now)
            self._motion[name] = (angle, angle, now, 0.0)

    async def positions(self) -> dict[str, float]:
        now = self._clock()
        return {name: self._angle(name, now) for name in self._motion}

    def _angle(self, name: str, now: float) -> float:
        start, target, began, duration = self._motion[name]
        if now >= began + duration:
            return target
        return start + (target - start) * (now - began) / duration


class SimRangeSensor(RangeSensor):
    """Always sees the same distance; tests may change ``value``."""

    def __init__(self, *, distance: float) -> None:
        self.value: float | None = distance

    async def distance(self) -> float | None:
        return self.value


class SimPower(Power):
    """A battery that never drains; tests may change ``status``."""

    def __init__(self, *, voltage: float, percent: float, charging: bool) -> None:
        self.status = BatteryStatus(voltage, percent, charging)

    async def battery(self) -> BatteryStatus:
        return self.status


class SimLights(Lights):
    """Remembers the last colour set."""

    def __init__(self) -> None:
        self.color: Color = (0, 0, 0)

    async def fill(self, color: Color) -> None:
        self.color = check_color(color)


class SimSafety(Safety):
    """An emergency stop that stays released unless a test presses it."""

    def __init__(self, *, engaged: bool) -> None:
        self.engaged = engaged

    async def estop_engaged(self) -> bool:
        return self.engaged
