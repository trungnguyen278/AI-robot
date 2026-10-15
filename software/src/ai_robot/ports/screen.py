# SPDX-License-Identifier: MIT
"""Screen."""

from __future__ import annotations

import math
from abc import abstractmethod
from dataclasses import dataclass

from ai_robot.ports.base import Port


@dataclass(frozen=True, slots=True)
class ScreenState:
    """Everything the screen shows; the renderer animates it on its own.

    ``expression`` and ``tone`` name an expression and a colour of the screen protocol
    (protocol/screen/vocabulary.json); ``tone=None`` keeps the expression's own colour.
    ``battery`` (percent) and ``charging`` fill the status row; ``None`` means unknown.
    """

    expression: str = "neutral"
    tone: str | None = None
    battery: float | None = None
    charging: bool | None = None

    def __post_init__(self) -> None:
        if self.battery is not None and not (
            math.isfinite(self.battery) and 0 <= self.battery <= 100
        ):
            raise ValueError(f"battery must be a percentage, got {self.battery!r}")


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
