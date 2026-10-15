# SPDX-License-Identifier: MIT
"""Real-time pacing for simulated devices that produce data at a fixed rate."""

from __future__ import annotations

import asyncio

from ai_robot.core.checks import positive


class Pacer:
    """Makes successive ``wait()`` calls return once every ``period`` seconds.

    Like a real device's buffer, a caller that falls slightly behind catches up without
    waiting; one that falls more than ``max_lag`` seconds behind skips ahead and loses
    the data in between, as a real device would overrun.
    """

    def __init__(self, period: float, max_lag: float = 1.0) -> None:
        self.period = positive("period", period)
        self.max_lag = positive("max_lag", max_lag)
        self._due: float | None = None

    async def wait(self) -> None:
        now = asyncio.get_running_loop().time()
        if self._due is None or now - self._due > self.max_lag:
            self._due = now
        self._due += self.period
        await asyncio.sleep(max(0.0, self._due - now))
