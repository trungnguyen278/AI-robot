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


def test_drives_straight_until_the_command_expires() -> None:
    clock = FakeClock()
    base = SimDriveBase(clock=clock)
    sync(base.drive(0.2, 0.0, ttl=1.0))
    clock.advance(0.5)
    assert sync(base.odometry()).x == pytest.approx(0.1)
    clock.advance(10.0)
    pose = sync(base.odometry())
    assert (pose.x, pose.y, pose.heading) == pytest.approx((0.2, 0.0, 0.0))


def test_a_new_command_extends_the_motion() -> None:
    clock = FakeClock()
    base = SimDriveBase(clock=clock)
    sync(base.drive(0.2, 0.0, ttl=1.0))
    clock.advance(0.5)
    sync(base.drive(0.2, 0.0, ttl=1.0))
    clock.advance(10.0)
    assert sync(base.odometry()).x == pytest.approx(0.3)


def test_stop_is_immediate() -> None:
    clock = FakeClock()
    base = SimDriveBase(clock=clock)
    sync(base.drive(0.2, 0.0, ttl=5.0))
    clock.advance(1.0)
    sync(base.stop())
    clock.advance(1.0)
    assert sync(base.odometry()).x == pytest.approx(0.2)


def test_speeds_are_clamped_to_the_limits() -> None:
    clock = FakeClock()
    base = SimDriveBase(max_linear=0.5, clock=clock)
    sync(base.drive(-9.0, 0.0, ttl=1.0))
    clock.advance(1.0)
    assert sync(base.odometry()).x == pytest.approx(-0.5)


def test_follows_an_arc() -> None:
    # A quarter circle of radius 1 m: 0.5 m/s and 0.5 rad/s for pi seconds.
    clock = FakeClock()
    base = SimDriveBase(clock=clock)
    sync(base.drive(0.5, 0.5, ttl=math.pi))
    clock.advance(math.pi)
    pose = sync(base.odometry())
    assert (pose.x, pose.y, pose.heading) == pytest.approx((1.0, 1.0, math.pi / 2))


def test_heading_stays_within_one_turn() -> None:
    clock = FakeClock()
    base = SimDriveBase(clock=clock)
    sync(base.drive(0.0, 2.0, ttl=2.0))
    clock.advance(2.0)
    assert sync(base.odometry()).heading == pytest.approx(4.0 - 2 * math.pi)


def test_ttl_must_be_positive() -> None:
    with pytest.raises(ValueError, match="ttl"):
        sync(SimDriveBase().drive(0.1, 0.0, ttl=0.0))


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


def test_an_unknown_joint_moves_nothing() -> None:
    joints = SimJoints(joints=JOINTS, clock=FakeClock())
    with pytest.raises(KeyError, match="elbow"):
        sync(joints.move({"neck_pan": 0.5, "elbow": 1.0}, duration=0.0))
    assert sync(joints.positions())["neck_pan"] == 0.0


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
