# SPDX-License-Identifier: MIT
"""Screen: what the robot shows on its display."""

from __future__ import annotations

import asyncio
import contextlib
import math
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

from ai_robot.core.bus import Message, Subscription
from ai_robot.core.checks import finite
from ai_robot.core.module import Module, ModuleContext
from ai_robot.messages import (
    BatteryReport,
    ExpressionRequest,
    InteractionChanged,
    InteractionState,
    LookAt,
    SceneRequest,
    ScreenPriority,
    ScreenTouched,
    SoundLevel,
)
from ai_robot.ports import Screen, ScreenState

M = TypeVar("M", bound=Message)
T = TypeVar("T")

DEFAULT_EXPRESSION = "neutral"

# What the face shows during a conversation; None: nothing in particular.
INTERACTION_EXPRESSIONS: dict[InteractionState, str | None] = {
    InteractionState.IDLE: None,
    InteractionState.TRIGGERED: "listening",
    InteractionState.LISTENING: "listening",
    InteractionState.PROCESSING: "thinking",
    InteractionState.SPEAKING: "speaking",
    InteractionState.CANCELLING: None,
}
INTERACTION_SOURCE = "interaction"  # the source of the requests made for the conversation

VOICE_INTERVAL = 0.04  # seconds between two voice levels sent to the screen (25 per second)


@dataclass(frozen=True, slots=True)
class Face:
    expression: str
    tone: str | None = None


@dataclass(frozen=True, slots=True)
class Scene:
    name: str
    data: Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class Request(Generic[T]):
    content: T
    priority: int
    expires: float | None  # event-loop time; None: until replaced or withdrawn
    order: int  # arrival order: the newest wins among equal priorities


class Arbiter(Generic[T]):
    """Chooses what to show from the requests of several sources.

    Each source holds at most one request. The highest priority that has not expired
    wins, the newest among equals: the multiplexer pattern of ROS's twist_mux, also how
    OpenVoiceOS stacks what its screen shows.
    """

    def __init__(self) -> None:
        self._requests: dict[str, Request[T]] = {}
        self._order = 0

    def put(
        self, source: str, content: T | None, *, priority: int, expires: float | None = None
    ) -> None:
        """Record ``source``'s request, replacing its previous one; ``None`` withdraws it."""
        if content is None:
            self._requests.pop(source, None)
            return
        self._order += 1
        self._requests[source] = Request(content, priority, expires, self._order)

    def winner(self, now: float) -> Request[T] | None:
        """The request to show at ``now``; expired ones are dropped."""
        for source, request in list(self._requests.items()):
            if request.expires is not None and request.expires <= now:
                del self._requests[source]
        return max(self._requests.values(), key=lambda r: (r.priority, r.order), default=None)

    def next_expiry(self) -> float | None:
        times = [r.expires for r in self._requests.values() if r.expires is not None]
        return min(times, default=None)


class ScreenModule(Module):
    """Decides what the screen shows; the renderer draws it and keeps it alive.

    - Expressions: other modules ask with ``ExpressionRequest``; the conversation
      (``InteractionChanged``) asks on its own at ``ScreenPriority.INTERACTION``.
      An ``Arbiter`` picks one, ``neutral`` when nothing is asked.
    - Scenes: other modules ask with ``SceneRequest``, and a second ``Arbiter`` picks
      one. The face keeps its expression while it watches a scene from a corner.
    - The status row: the battery, from ``BatteryReport``.
    - The gaze (``LookAt``) and, while the robot listens, the microphone's loudness
      go straight to the renderer.
    - Taps on the screen are published as ``ScreenTouched``.

    The renderer animates on its own (transitions, blinking, glances, its start-up),
    so this module sends only changes.
    """

    owns = ("screen",)

    def __init__(self, ctx: ModuleContext, *, quiet_db: float, loud_db: float) -> None:
        super().__init__(ctx)
        # The microphone's loudness, in dBFS, that maps to a voice level of 0 and of 1.
        self.quiet_db = finite("quiet_db", quiet_db)
        self.loud_db = finite("loud_db", loud_db)
        if self.loud_db <= self.quiet_db:
            raise ValueError("loud_db must be above quiet_db")
        self.screen = self.port("screen", Screen)
        self.faces: Arbiter[Face] = Arbiter()
        self.scenes: Arbiter[Scene] = Arbiter()
        self.state: ScreenState | None = None  # what the screen was last given
        self.listening = False
        self._battery: float | None = None
        self._charging: bool | None = None
        self._level = 0.0
        self._level_sent_at = -math.inf
        self._changed = asyncio.Event()
        self.subscriptions: list[Subscription[Any]] = []
        self.expression_requests = self._subscribe(ExpressionRequest)
        self.scene_requests = self._subscribe(SceneRequest)
        self.interaction = self._subscribe(InteractionChanged)
        self.batteries = self._subscribe(BatteryReport)
        self.levels = self._subscribe(SoundLevel)
        self.gazes = self._subscribe(LookAt)

    def _subscribe(self, kind: type[M]) -> Subscription[M]:
        subscription = self.bus.subscribe(kind)
        self.subscriptions.append(subscription)
        return subscription

    async def start(self) -> None:
        await self._refresh()

    async def run(self) -> None:
        async with asyncio.TaskGroup() as tasks:
            tasks.create_task(self._follow(self.expression_requests, self._on_expression))
            tasks.create_task(self._follow(self.scene_requests, self._on_scene))
            tasks.create_task(self._follow(self.interaction, self._on_interaction))
            tasks.create_task(self._follow(self.batteries, self._on_battery))
            tasks.create_task(self._follow(self.levels, self._on_level))
            tasks.create_task(self._follow(self.gazes, self._on_gaze))
            tasks.create_task(self._expire())
            tasks.create_task(self._forward_taps())

    async def stop(self) -> None:
        for subscription in self.subscriptions:
            subscription.close()

    @staticmethod
    async def _follow(
        subscription: Subscription[M], handle: Callable[[M], Awaitable[None]]
    ) -> None:
        async for message in subscription:
            await handle(message)

    def _expires(self, duration: float | None) -> float | None:
        return None if duration is None else self._now() + duration

    async def _on_expression(self, request: ExpressionRequest) -> None:
        face = None if request.expression is None else Face(request.expression, request.tone)
        self.faces.put(
            request.source, face, priority=request.priority, expires=self._expires(request.duration)
        )
        await self._refresh()

    async def _on_scene(self, request: SceneRequest) -> None:
        scene = None if request.scene is None else Scene(request.scene, request.data)
        self.scenes.put(
            request.source,
            scene,
            priority=request.priority,
            expires=self._expires(request.duration),
        )
        await self._refresh()

    async def _on_interaction(self, message: InteractionChanged) -> None:
        self.listening = message.state in (InteractionState.TRIGGERED, InteractionState.LISTENING)
        expression = INTERACTION_EXPRESSIONS[message.state]
        face = None if expression is None else Face(expression)
        self.faces.put(INTERACTION_SOURCE, face, priority=ScreenPriority.INTERACTION)
        if not self.listening and self._level > 0:
            await self._send_level(0.0)
        await self._refresh()

    async def _on_battery(self, report: BatteryReport) -> None:
        percent = report.status.percent
        self._battery = None if percent is None else min(100.0, max(0.0, percent))
        self._charging = report.status.charging
        await self._refresh()

    async def _on_level(self, message: SoundLevel) -> None:
        if self.listening and self._now() - self._level_sent_at >= VOICE_INTERVAL:
            await self._send_level(self.loudness(message.rms))

    async def _on_gaze(self, message: LookAt) -> None:
        await self.screen.look(message.target)

    def loudness(self, rms: float) -> float:
        """The voice level, from 0 to 1, of a microphone chunk of loudness ``rms``."""
        if rms <= 0:
            return 0.0
        db = 20 * math.log10(rms / 32768)
        return min(1.0, max(0.0, (db - self.quiet_db) / (self.loud_db - self.quiet_db)))

    async def _send_level(self, level: float) -> None:
        self._level = level
        self._level_sent_at = self._now()
        await self.screen.voice(level)

    async def _refresh(self) -> None:
        """Send the state to the screen if it changed, and re-arm the expiry timer."""
        now = self._now()
        face = self.faces.winner(now)
        scene = self.scenes.winner(now)
        state = ScreenState(
            expression=face.content.expression if face else DEFAULT_EXPRESSION,
            tone=face.content.tone if face else None,
            scene=scene.content.name if scene else None,
            scene_data=scene.content.data if scene else {},
            battery=self._battery,
            charging=self._charging,
        )
        if state != self.state:
            self.state = state
            await self.screen.show(state)
        self._changed.set()

    async def _expire(self) -> None:
        """Refresh when the next request expires, or when the requests change."""
        while True:
            self._changed.clear()
            expiries = (self.faces.next_expiry(), self.scenes.next_expiry())
            deadline = min((d for d in expiries if d is not None), default=None)
            timeout = None if deadline is None else max(0.0, deadline - self._now())
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._changed.wait(), timeout)
            if deadline is not None and self._now() >= deadline:
                await self._refresh()

    async def _forward_taps(self) -> None:
        while True:
            touch = await self.screen.touched()
            self.bus.publish(ScreenTouched(touch.x, touch.y))

    @staticmethod
    def _now() -> float:
        return asyncio.get_running_loop().time()
