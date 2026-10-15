# SPDX-License-Identifier: MIT
"""Base class of all ports."""

from __future__ import annotations

from abc import ABC


# No abstract methods here: each port declares its own.
class Port(ABC):  # noqa: B024
    """An interface to one piece of hardware or one external service.

    An adapter implements one port. The application opens every adapter before any
    module starts, and closes it after all modules have stopped.
    """

    async def open(self) -> None:  # noqa: B027
        """Acquire the device or the connection. By default: nothing to do.

        Stopping the robot during startup cancels ``open``; it must then release what it
        had acquired, because ``close`` is called only if ``open`` succeeded.
        """

    async def close(self) -> None:  # noqa: B027
        """Release it. Called only if ``open`` succeeded. By default: nothing to do."""
