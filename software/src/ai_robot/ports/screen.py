# SPDX-License-Identifier: MIT
"""Screen."""

from __future__ import annotations

import json
import math
from abc import abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any

from ai_robot.ports.base import Port


def scene_data(data: Mapping[str, Any]) -> Mapping[str, Any]:
    """A deep, read-only copy of a scene's ``data``, made of JSON values only.

    Mappings become read-only mappings and lists become tuples, so that nobody can
    change what others hold. Raises ``ValueError`` for data that does not convert to
    JSON: keys that are not strings, numbers that are not finite (JSON has no NaN),
    other objects such as dates. Converting those is the publisher's job, where their
    meaning is known; the screen protocol lists what each scene takes.
    """
    if not isinstance(data, Mapping):
        raise ValueError(f"scene data must be a mapping, got {type(data).__name__}")
    try:
        text = json.dumps(data, allow_nan=False, default=_thaw)
    except (TypeError, ValueError) as error:
        raise ValueError(f"scene data must convert to JSON: {error}") from None
    return _freeze(json.loads(text))


def _thaw(value: Any) -> Any:
    """For ``json.dumps``: read-only mappings convert like dicts; nothing else does."""
    if isinstance(value, Mapping):
        return dict(value)
    raise TypeError(f"{type(value).__name__} is not JSON")


def _freeze(value: Any) -> Any:
    if isinstance(value, dict):
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    return value


@dataclass(frozen=True, slots=True)
class ScreenState:
    """Everything the screen shows; the renderer animates it on its own.

    ``expression`` and ``tone`` name an expression and a colour of the screen protocol
    (protocol/screen/vocabulary.json); ``tone=None`` keeps the expression's own colour.
    ``scene`` names a scene of the protocol, shown with ``scene_data`` (see
    ``scene_data()``) while the face watches from a corner, or is ``None``.
    ``battery`` (percent) and ``charging`` fill the status row; ``None`` means unknown.
    """

    expression: str = "neutral"
    tone: str | None = None
    scene: str | None = None
    scene_data: Mapping[str, Any] = field(default_factory=dict)
    battery: float | None = None
    charging: bool | None = None

    def __post_init__(self) -> None:
        if self.battery is not None and not (
            math.isfinite(self.battery) and 0 <= self.battery <= 100
        ):
            raise ValueError(f"battery must be a percentage, got {self.battery!r}")
        object.__setattr__(self, "scene_data", scene_data(self.scene_data))


@dataclass(frozen=True, slots=True)
class Touch:
    """A tap on the screen, as fractions of its width and height from the top left."""

    x: float
    y: float


class Screen(Port):
    """The screen that shows the robot's face.

    The port carries what to show, not pixels: a renderer draws it and keeps it alive
    (transitions, blinking, glances) without being told, so the software sends only
    changes (docs/decisions/0006-screen-renderer.md). The methods return once the
    change is handed over; they do not wait for it to be drawn.
    """

    @abstractmethod
    async def show(self, state: ScreenState) -> None:
        """Show ``state``; the renderer moves to it with a transition."""

    @abstractmethod
    async def look(self, target: tuple[float, float] | None) -> None:
        """Turn the eyes towards ``target``, or let them roam with ``None``.

        ``x`` and ``y`` go from -1 to 1 across the screen as one faces it: (-1, -1) is
        its top left corner, (0, 0) straight ahead.
        """

    @abstractmethod
    async def voice(self, level: float) -> None:
        """Set the loudness, from 0 to 1, of the voice the face reacts to."""

    @abstractmethod
    async def touched(self) -> Touch:
        """Wait for the next tap on the screen."""
