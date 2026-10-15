# SPDX-License-Identifier: MIT
"""Simulated screen."""

from __future__ import annotations

import asyncio

from ai_robot.ports.screen import Screen, ScreenState, Touch


class SimScreen(Screen):
    """A screen without a renderer: it keeps what it was asked to show."""

    def __init__(self) -> None:
        self.state = ScreenState()
        self.updates = 0
        self.gaze: tuple[float, float] | None = None
        self.level = 0.0
        self._touches: asyncio.Queue[Touch] = asyncio.Queue()

    async def show(self, state: ScreenState) -> None:
        self.state = state
        self.updates += 1

    async def look(self, target: tuple[float, float] | None) -> None:
        self.gaze = target

    async def voice(self, level: float) -> None:
        self.level = level

    async def touched(self) -> Touch:
        return await self._touches.get()

    def tap(self, x: float, y: float) -> None:
        """Simulate a tap at ``x``, ``y`` (fractions of the width and height)."""
        self._touches.put_nowait(Touch(x, y))
