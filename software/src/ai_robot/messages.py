# SPDX-License-Identifier: MIT
"""Messages exchanged by the modules on the bus.

This file is the contract between modules: they publish and subscribe only to the
classes defined here. Each class is one topic.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import IntEnum, StrEnum
from typing import Any

from ai_robot.core.bus import Message
from ai_robot.core.checks import finite, positive
from ai_robot.ports.body import BatteryStatus
from ai_robot.ports.screen import scene_data


class InteractionState(StrEnum):
    """Where the robot is in a conversation (the same states as the previous generation)."""

    IDLE = "idle"
    TRIGGERED = "triggered"  # wake word heard
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"
    CANCELLING = "cancelling"


@dataclass(frozen=True, slots=True)
class InteractionChanged(Message):
    """The interaction state changed. Published by behavior."""

    state: InteractionState


@dataclass(frozen=True, slots=True)
class SoundLevel(Message):
    """Loudness of the latest microphone chunk. Published by voice."""

    rms: float  # root mean square of the 16-bit samples, from 0 to 32768


@dataclass(frozen=True, slots=True)
class BatteryReport(Message):
    """The battery's state. Published by system at a regular interval."""

    status: BatteryStatus


class ScreenPriority(IntEnum):
    """How much an expression request matters: the screen shows the highest one."""

    AMBIENT = 0  # the robot's mood when nothing else is going on
    INTERACTION = 50  # the conversation: listening, thinking, speaking (asked by screen)
    REACTION = 70  # a short reaction: a smile, surprise at a tap
    ALERT = 90  # something people must notice: a low battery, a fault


@dataclass(frozen=True, slots=True)
class ExpressionRequest(Message):
    """Ask the screen for an expression. Published by any module, read by screen.

    Each ``source`` (by convention, the module's name) holds at most one request: a new
    one replaces it, and ``expression=None`` withdraws it. The screen shows the request
    with the highest ``priority`` that has not expired, the newest among equals, and
    ``neutral`` when there is none. Expressions and tones are named in the screen
    protocol (protocol/screen/vocabulary.json).
    """

    source: str
    expression: str | None
    priority: int = ScreenPriority.REACTION
    duration: float | None = None  # seconds; None: until replaced or withdrawn
    tone: str | None = None  # None: the expression's own colour

    def __post_init__(self) -> None:
        if self.duration is not None:
            positive("duration", self.duration)


@dataclass(frozen=True, slots=True)
class SceneRequest(Message):
    """Ask the screen for a scene. Published by any module, read by screen.

    A scene fills the screen with information (a clock, the weather, a timer…) while
    the face watches from a corner. Requests work as for ``ExpressionRequest``: one per
    ``source``, ``scene=None`` withdraws it, the highest ``priority`` that has not
    expired wins, and with none the face has the screen to itself. Scenes and the
    ``data`` each one takes are listed in the screen protocol
    (protocol/screen/vocabulary.json). ``data`` must convert to JSON, finite numbers
    only; it is kept as a deep, read-only copy (``ports.screen.scene_data``), so that
    no subscriber can change what the others receive.
    """

    source: str
    scene: str | None
    data: Mapping[str, Any] = field(default_factory=dict)
    priority: int = ScreenPriority.REACTION
    duration: float | None = None  # seconds; None: until replaced or withdrawn

    def __post_init__(self) -> None:
        if self.duration is not None:
            positive("duration", self.duration)
        object.__setattr__(self, "data", scene_data(self.data))


@dataclass(frozen=True, slots=True)
class LookAt(Message):
    """Where the eyes should look. Published by vision (planned), read by screen."""

    target: tuple[float, float] | None  # x, y from -1 to 1 across the screen; None: roam

    def __post_init__(self) -> None:
        if self.target is not None:
            x, y = (
                min(1.0, max(-1.0, finite(name, value)))
                for name, value in zip("xy", self.target, strict=True)
            )
            object.__setattr__(self, "target", (x, y))


@dataclass(frozen=True, slots=True)
class ScreenTouched(Message):
    """Someone tapped the screen. Published by screen."""

    x: float  # from 0 at the left edge to 1 at the right one
    y: float  # from 0 at the top to 1 at the bottom
