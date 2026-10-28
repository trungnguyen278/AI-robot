# SPDX-License-Identifier: MIT
"""Waiting in tests: for a condition, with a timeout, never for a fixed time."""

from __future__ import annotations

import asyncio
from collections.abc import Callable

POLL = 0.01  # seconds between two looks at the condition


async def until(condition: Callable[[], object], timeout: float) -> None:
    """Return once ``condition()`` is true; fail after ``timeout`` seconds."""
    async with asyncio.timeout(timeout):
        while not condition():
            await asyncio.sleep(POLL)
