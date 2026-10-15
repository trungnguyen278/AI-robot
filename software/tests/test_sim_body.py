# SPDX-License-Identifier: MIT
from __future__ import annotations

import asyncio
import math
from collections.abc import Coroutine
from typing import Any, TypeVar

import pytest

from ai_robot.adapters.sim.body import SimDriveBase, SimJoints
from ai_robot.ports.body import parse_joints

T = TypeVar("T")


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def sync(coroutine: Coroutine[Any, Any, T]) -> T:
    return asyncio.run(coroutine)


def drive_base(clock: FakeClock, max_ttl: float = 10.0) -> SimDriveBase:
    return SimDriveBase(max_linear=0.5, max_angular=2.0, max_ttl=max_ttl, clock=clock)


def test_drives_straight_until_the_command_expires() -> None:
    clock = FakeClock()
    base = drive_base(clock)
    sync(base.drive(0.2, 0.0, ttl=1.0))
    clock.advance(0.5)
    assert sync(base.odometry()).x == pytest.approx(0.1)
    clock.advance(10.0)
    pose = sync(base.odometry())
    assert (pose.x, pose.y, pose.heading) == pytest.approx((0.2, 0.0, 0.0))


def test_a_new_command_extends_the_motion() -> None:
    clock = FakeClock()
    base = drive_base(clock)
    sync(base.drive(0.2, 0.0, ttl=1.0))
    clock.advance(0.5)
    sync(base.drive(0.2, 0.0, ttl=1.0))
    clock.advance(10.0)
    assert sync(base.odometry()).x == pytest.approx(0.3)


def test_stop_is_immediate() -> None:
    clock = FakeClock()
    base = drive_base(clock)
    sync(base.drive(0.2, 0.0, ttl=5.0))
    clock.advance(1.0)
    sync(base.stop())
    clock.advance(1.0)
    assert sync(base.odometry()).x == pytest.approx(0.2)


def test_speeds_are_clamped_to_the_limits() -> None:
    clock = FakeClock()
    base = drive_base(clock)
    sync(base.drive(-9.0, 0.0, ttl=1.0))
    clock.advance(1.0)
    assert sync(base.odometry()).x == pytest.approx(-0.5)


def test_ttl_is_clamped_to_the_longest_command() -> None:
    clock = FakeClock()
    base = drive_base(clock, max_ttl=1.0)
    sync(base.drive(0.2, 0.0, ttl=60.0))
    clock.advance(60.0)
    assert sync(base.odometry()).x == pytest.approx(0.2)


@pytest.mark.parametrize(
    ("linear", "angular", "ttl"),
    [
        (0.2, 0.0, math.nan),
        (0.2, 0.0, math.inf),
        (0.2, 0.0, 0.0),
        (math.nan, 0.0, 1.0),
        (0.0, math.inf, 1.0),
    ],
)
def test_invalid_commands_are_rejected(linear: float, angular: float, ttl: float) -> None:
    clock = FakeClock()
    base = drive_base(clock)
    with pytest.raises(ValueError):
        sync(base.drive(linear, angular, ttl=ttl))
    clock.advance(1.0)
    assert sync(base.odometry()).x == 0.0


def test_follows_an_arc() -> None:
    # A quarter circle of radius 1 m: 0.5 m/s and 0.5 rad/s for pi seconds.
    clock = FakeClock()
    base = drive_base(clock)
    sync(base.drive(0.5, 0.5, ttl=math.pi))
    clock.advance(math.pi)
    pose = sync(base.odometry())
    assert (pose.x, pose.y, pose.heading) == pytest.approx((1.0, 1.0, math.pi / 2))


def test_heading_stays_within_one_turn() -> None:
    clock = FakeClock()
    base = drive_base(clock)
    sync(base.drive(0.0, 2.0, ttl=2.0))
    clock.advance(2.0)
    assert sync(base.odometry()).heading == pytest.approx(4.0 - 2 * math.pi)


JOINTS = [
    {"name": "neck_pan", "lower": -1.0, "upper": 1.0},
    {"name": "neck_tilt", "lower": -0.5, "upper": 0.5, "home": 0.2},
]


def test_joints_start_at_home() -> None:
    joints = SimJoints(joints=JOINTS, clock=FakeClock())
    assert sync(joints.positions()) == {"neck_pan": 0.0, "neck_tilt": 0.2}


def test_joints_move_at_constant_speed_within_their_limits() -> None:
    clock = FakeClock()
    joints = SimJoints(joints=JOINTS, clock=clock)
    sync(joints.move({"neck_pan": 0.8, "neck_tilt": 3.0}, duration=2.0))
    clock.advance(1.0)
    assert sync(joints.positions()) == pytest.approx({"neck_pan": 0.4, "neck_tilt": 0.35})
    clock.advance(5.0)
    assert sync(joints.positions()) == pytest.approx({"neck_pan": 0.8, "neck_tilt": 0.5})


def test_hold_stops_the_joints_where_they_are() -> None:
    clock = FakeClock()
    joints = SimJoints(joints=JOINTS, clock=clock)
    sync(joints.move({"neck_pan": 0.8}, duration=2.0))
    clock.advance(1.0)
    sync(joints.hold())
    clock.advance(5.0)
    assert sync(joints.positions())["neck_pan"] == pytest.approx(0.4)


@pytest.mark.parametrize(
    ("targets", "duration", "error"),
    [
        ({"neck_pan": 0.5, "elbow": 1.0}, 0.0, KeyError),
        ({"neck_pan": 0.5, "neck_tilt": math.nan}, 0.0, ValueError),
        ({"neck_pan": 0.5}, math.nan, ValueError),
        ({"neck_pan": 0.5}, -1.0, ValueError),
    ],
)
def test_an_invalid_move_moves_nothing(
    targets: dict[str, float], duration: float, error: type[Exception]
) -> None:
    joints = SimJoints(joints=JOINTS, clock=FakeClock())
    with pytest.raises(error):
        sync(joints.move(targets, duration=duration))
    assert sync(joints.positions()) == {"neck_pan": 0.0, "neck_tilt": 0.2}


@pytest.mark.parametrize(
    "entries",
    [
        pytest.param(
            [{"name": "a", "lower": 0, "upper": 1}, {"name": "a", "lower": 0, "upper": 1}],
            id="duplicate name",
        ),
        pytest.param([{"name": "a", "lower": 0, "upper": 1, "min": 0}], id="unknown key"),
        pytest.param([{"name": "a", "lower": 0, "upper": 1, "home": 2}], id="home off limits"),
    ],
)
def test_invalid_joint_lists_are_rejected(entries: list[dict[str, Any]]) -> None:
    with pytest.raises(ValueError):
        parse_joints(entries)
