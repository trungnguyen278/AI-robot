# SPDX-License-Identifier: MIT
"""Behavior: decides what the robot does."""

from __future__ import annotations

import asyncio
import contextlib
from collections import deque
from collections.abc import Callable
from datetime import date, datetime, timedelta

from ai_robot.core.checks import positive, within
from ai_robot.core.module import Module, ModuleContext
from ai_robot.messages import (
    ExpressionRequest,
    InteractionChanged,
    InteractionState,
    SceneRequest,
    ScreenPriority,
    ScreenTouched,
)
from ai_robot.ports import Daylight, SunTimes

# The sources of this module's requests, one per concern, so that each replaces only
# its own request.
REACTION = "behavior.reaction"
MOOD = "behavior.mood"
AMBIENT = "behavior.ambient"


class BehaviorModule(Module):
    """Decides what the robot does, and announces the interaction state.

    Until the robot can talk, it:

    - reacts to taps on its screen: pleased (``happy_seconds``), and delighted
      (``love_seconds``) after ``taps_for_love`` taps within ``tap_window`` seconds;
    - shows the clock, the face watching it from a corner, once nobody has interacted
      for ``idle_minutes`` (the ambient screen of a smart display), until the next tap;
    - looks sleepy at night: from ``sleepy_after_sunset`` hours after sunset until
      sunrise, as the ``daylight`` port gives them.

    Planned: the conversation flow (wake word, listening, processing, speaking),
    reactions to what vision sees, moods.
    """

    owns = ("daylight",)

    def __init__(
        self,
        ctx: ModuleContext,
        *,
        idle_minutes: float,
        sleepy_after_sunset: float,
        happy_seconds: float,
        love_seconds: float,
        taps_for_love: int,
        tap_window: float,
        night_check: float,
    ) -> None:
        super().__init__(ctx)
        self.idle_seconds = 60 * positive("idle_minutes", idle_minutes)
        self.sleepy_delay = timedelta(
            hours=within("sleepy_after_sunset", sleepy_after_sunset, 0, 12)
        )
        self.happy_seconds = positive("happy_seconds", happy_seconds)
        self.love_seconds = positive("love_seconds", love_seconds)
        if taps_for_love < 1:
            raise ValueError(f"taps_for_love must be at least 1, got {taps_for_love}")
        self.taps_for_love = taps_for_love
        self.tap_window = positive("tap_window", tap_window)
        self.daylight = self.port("daylight", Daylight)
        # The local time, with its zone; tests replace it.
        self.clock: Callable[[], datetime] = lambda: datetime.now().astimezone()
        self.night_check = positive("night_check", night_check)
        self._suns: dict[date, SunTimes] = {}
        self._daylight_failing = False
        self.taps = self.bus.subscribe(ScreenTouched)
        self._last_interaction = 0.0
        self._interacted = asyncio.Event()
        self._ambient = False  # the clock is up because nobody interacted
        self._sleepy = False

    async def start(self) -> None:
        self._last_interaction = self._now()
        self.bus.publish(InteractionChanged(InteractionState.IDLE))

    async def run(self) -> None:
        async with asyncio.TaskGroup() as tasks:
            tasks.create_task(self._react_to_taps())
            tasks.create_task(self._ambient_screen())
            tasks.create_task(self._watch_the_night())

    async def stop(self) -> None:
        self.taps.close()

    async def _react_to_taps(self) -> None:
        recent: deque[float] = deque()
        async for _ in self.taps:
            now = self._now()
            while recent and now - recent[0] > self.tap_window:
                recent.popleft()
            recent.append(now)
            if len(recent) >= self.taps_for_love:
                self.bus.publish(ExpressionRequest(REACTION, "love", duration=self.love_seconds))
            else:
                self.bus.publish(ExpressionRequest(REACTION, "happy", duration=self.happy_seconds))
            self._interaction(now)

    def _interaction(self, now: float) -> None:
        """Someone interacted: the ambient screen goes, and its countdown starts again."""
        self._last_interaction = now
        if self._ambient:
            self.bus.publish(SceneRequest(AMBIENT, None))
            self._ambient = False
        self._interacted.set()

    async def _ambient_screen(self) -> None:
        while True:
            self._interacted.clear()
            if self._ambient:
                await self._interacted.wait()
                continue
            left = self._last_interaction + self.idle_seconds - self._now()
            if left > 0:
                with contextlib.suppress(TimeoutError):
                    await asyncio.wait_for(self._interacted.wait(), left)
                continue
            self.bus.publish(SceneRequest(AMBIENT, "clock", priority=ScreenPriority.AMBIENT))
            self._ambient = True

    async def _watch_the_night(self) -> None:
        while True:
            try:
                sleepy = await self.is_night(self.clock())
            except Exception as error:  # the times may come from a service one day
                if not self._daylight_failing:  # once per outage, not every check
                    self.log.warning("cannot tell whether it is night: %s", error)
                self._daylight_failing = True
            else:
                self._daylight_failing = False
                if sleepy != self._sleepy:
                    expression = "sleepy" if sleepy else None
                    self.bus.publish(
                        ExpressionRequest(MOOD, expression, priority=ScreenPriority.AMBIENT)
                    )
                    self._sleepy = sleepy
            await asyncio.sleep(self.night_check)

    async def is_night(self, now: datetime) -> bool:
        """Whether ``now`` (with its time zone) falls between the start of the night,
        ``sleepy_after_sunset`` after sunset, and sunrise."""
        today = await self._sun(now.date())
        if today.sunrise is None and today.sunset is None:  # near the poles
            return not today.up_all_day
        if today.sunset is not None and now >= today.sunset + self.sleepy_delay:
            return True
        if today.sunrise is not None and now < today.sunrise:
            # Before sunrise: night, once yesterday's night has started (the delay may
            # carry it past midnight).
            yesterday = await self._sun(now.date() - timedelta(days=1))
            return yesterday.sunset is None or now >= yesterday.sunset + self.sleepy_delay
        return False

    async def _sun(self, day: date) -> SunTimes:
        if day not in self._suns:
            self._suns[day] = await self.daylight.sun(day)
            for old in sorted(self._suns)[:-3]:
                del self._suns[old]
        return self._suns[day]

    @staticmethod
    def _now() -> float:
        return asyncio.get_running_loop().time()
