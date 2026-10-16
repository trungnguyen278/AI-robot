# SPDX-License-Identifier: MIT
"""The behavior module: reactions to taps, the ambient clock, and the night."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections.abc import AsyncIterator
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import TypeVar

import pytest

from ai_robot.core.bus import Bus, Message, Subscription
from ai_robot.core.config import ConfigError
from ai_robot.core.factory import create
from ai_robot.core.module import ModuleContext, RobotInfo
from ai_robot.messages import ExpressionRequest, SceneRequest, ScreenPriority, ScreenTouched
from ai_robot.modules.behavior import (
    AMBIENT,
    MOOD,
    REACTION,
    BehaviorModule,
)
from ai_robot.ports import Daylight, SunTimes

VOCABULARY = Path(__file__).resolve().parents[2] / "protocol" / "screen" / "vocabulary.json"
TIMEOUT = 2.0
M = TypeVar("M", bound=Message)
ZONE = timezone(timedelta(hours=7))


def at(hour: int, minute: int = 0, day: int = 16) -> datetime:
    return datetime(2026, 10, day, hour, minute, tzinfo=ZONE)


NIGHT = at(23, 30)
DAY = at(9, 30)


class FakeDaylight(Daylight):
    """Sunrise at 06:00 and sunset at 18:00 every day, or a polar day or night."""

    def __init__(self, polar: bool | None = None, fail: bool = False) -> None:
        self.polar = polar  # None: an ordinary day; True: sun up all day; False: down
        self.fail = fail

    async def sun(self, day: date) -> SunTimes:
        if self.fail:
            raise ConnectionError("no answer from the service")
        if self.polar is not None:
            return SunTimes(None, None, up_all_day=self.polar)
        return SunTimes(
            datetime(day.year, day.month, day.day, 6, tzinfo=ZONE),
            datetime(day.year, day.month, day.day, 18, tzinfo=ZONE),
        )


def context(bus: Bus, daylight: Daylight) -> ModuleContext:
    return ModuleContext(
        name="behavior",
        bus=bus,
        ports={"daylight": daylight},
        robot=RobotInfo(display_name="Robot"),
        log=logging.getLogger("test"),
    )


# The settings of the behavior module, as shipped, but looking at the time of day often.
SETTINGS = {
    "happy_seconds": 2.0,
    "love_seconds": 3.0,
    "taps_for_love": 3,
    "tap_window": 2.0,
    "night_check": 0.01,
}


def make(
    idle_minutes: float = 5.0,
    now: datetime = DAY,
    sleepy_after_sunset: float = 0.0,
    daylight: Daylight | None = None,
) -> tuple[Bus, BehaviorModule]:
    bus = Bus()
    module = BehaviorModule(
        context(bus, daylight or FakeDaylight()),
        idle_minutes=idle_minutes,
        sleepy_after_sunset=sleepy_after_sunset,
        **SETTINGS,
    )
    module.clock = lambda: now
    return bus, module


@contextlib.asynccontextmanager
async def running(module: BehaviorModule) -> AsyncIterator[None]:
    await module.start()
    task = asyncio.create_task(module.run())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        await module.stop()


async def next_of(subscription: Subscription[M]) -> M:
    return await asyncio.wait_for(subscription.get(), TIMEOUT)


def tap() -> ScreenTouched:
    return ScreenTouched(0.5, 0.5)


def test_a_tap_pleases_and_quick_taps_delight() -> None:
    async def main() -> None:
        bus, module = make()
        faces = bus.subscribe(ExpressionRequest)
        async with running(module):
            happy = ExpressionRequest(REACTION, "happy", duration=SETTINGS["happy_seconds"])
            love = ExpressionRequest(REACTION, "love", duration=SETTINGS["love_seconds"])
            for expected in (happy, happy, love):
                bus.publish(tap())
                assert await next_of(faces) == expected

    asyncio.run(main())


def test_the_clock_comes_when_nobody_interacts_and_a_tap_takes_it_away() -> None:
    async def main() -> None:
        bus, module = make(idle_minutes=0.002)  # 0.12 s
        scenes = bus.subscribe(SceneRequest)
        clock = SceneRequest(AMBIENT, "clock", priority=ScreenPriority.AMBIENT)
        async with running(module):
            assert await next_of(scenes) == clock
            bus.publish(tap())
            assert await next_of(scenes) == SceneRequest(AMBIENT, None)
            assert await next_of(scenes) == clock  # once idle again

    asyncio.run(main())


def test_taps_keep_the_clock_away() -> None:
    async def main() -> None:
        bus, module = make(idle_minutes=0.012)  # 0.72 s, well above the 0.1 s between taps
        scenes = bus.subscribe(SceneRequest)
        async with running(module):
            for _ in range(5):
                await asyncio.sleep(0.1)
                bus.publish(tap())
            await asyncio.sleep(0.1)
            assert scenes.pending == 0

    asyncio.run(main())


def test_sleepy_from_sunset_to_sunrise() -> None:
    async def main() -> None:
        bus, module = make(now=NIGHT)
        faces = bus.subscribe(ExpressionRequest)
        async with running(module):
            sleepy = ExpressionRequest(MOOD, "sleepy", priority=ScreenPriority.AMBIENT)
            assert await next_of(faces) == sleepy
            module.clock = lambda: DAY
            assert await next_of(faces) == ExpressionRequest(
                MOOD, None, priority=ScreenPriority.AMBIENT
            )

    asyncio.run(main())


@pytest.mark.parametrize(
    ("delay", "now", "night"),
    [
        (0, at(17, 59), False),
        (0, at(18, 0), True),
        (0, at(23, 30), True),
        (0, at(5, 59), True),
        (0, at(6, 0), False),
        (3, at(20, 59), False),  # sleepy three hours after sunset
        (3, at(21, 0), True),
        (7, at(23, 30), False),  # the night starts at 01:00, after midnight
        (7, at(0, 30, day=17), False),
        (7, at(1, 0, day=17), True),
        (7, at(5, 59, day=17), True),
    ],
)
def test_the_night_starts_after_sunset_and_ends_at_sunrise(
    delay: float, now: datetime, night: bool
) -> None:
    _, module = make(sleepy_after_sunset=delay)
    assert asyncio.run(module.is_night(now)) is night


def test_near_the_poles() -> None:
    _, summer = make(daylight=FakeDaylight(polar=True))
    _, winter = make(daylight=FakeDaylight(polar=False))
    assert asyncio.run(summer.is_night(NIGHT)) is False
    assert asyncio.run(winter.is_night(DAY)) is True


def test_a_failing_daylight_service_is_logged_not_fatal(caplog: pytest.LogCaptureFixture) -> None:
    async def main() -> None:
        bus, module = make(idle_minutes=0.002, daylight=FakeDaylight(fail=True))
        scenes = bus.subscribe(SceneRequest)
        async with running(module):
            assert await next_of(scenes) == SceneRequest(
                AMBIENT, "clock", priority=ScreenPriority.AMBIENT
            )

    with caplog.at_level(logging.WARNING, logger="test"):
        asyncio.run(main())
    assert "cannot tell whether it is night: no answer from the service" in caplog.text


def test_nothing_happens_on_a_quiet_day() -> None:
    async def main() -> None:
        bus, module = make()
        faces = bus.subscribe(ExpressionRequest)
        scenes = bus.subscribe(SceneRequest)
        async with running(module):
            await asyncio.sleep(0.05)
        assert (faces.pending, scenes.pending) == (0, 0)

    asyncio.run(main())


def test_settings_are_checked() -> None:
    ctx = context(Bus(), FakeDaylight())
    good = {"idle_minutes": 5.0, "sleepy_after_sunset": 0.0, **SETTINGS}
    for change, message in [
        ({"sleepy_after_sunset": -1}, "sleepy_after_sunset must be from 0 to 12"),
        ({"idle_minutes": 0}, "idle_minutes must be a positive number"),
        ({"taps_for_love": 0}, "taps_for_love must be at least 1"),
        ({"tap_window": 0}, "tap_window must be a positive number"),
        ({"night_check": -1}, "night_check must be a positive number"),
    ]:
        with pytest.raises(ConfigError, match=message):
            create(BehaviorModule, "modules.behavior", ctx, **{**good, **change})


def test_the_names_used_are_in_the_protocol() -> None:
    vocabulary = json.loads(VOCABULARY.read_text(encoding="utf-8"))
    assert {"happy", "love", "sleepy"} <= set(vocabulary["expressions"])
    assert "clock" in vocabulary["scenes"]
