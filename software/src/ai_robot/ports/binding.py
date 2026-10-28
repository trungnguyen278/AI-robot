# SPDX-License-Identifier: MIT
"""Where the robot keeps its binding: the server it was registered with, and whether that
server accepts it (protocol/setup/README.md, The registration)."""

from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass

from ai_robot.ports.base import Port


@dataclass(frozen=True, slots=True)
class Binding:
    """The robot's binding: the ``ai-cloud`` it was registered with, if any, and
    whether that server has accepted it since. A robot that was never set up has
    neither."""

    server: str | None = None
    bound: bool = False


class BindingStore(Port):
    """Keeps the binding across restarts, so that the robot knows that it is bound while
    it is offline. A factory reset erases it (PRIV-6)."""

    @abstractmethod
    async def load(self) -> Binding:
        """The binding last saved; ``Binding()`` if none was, or if it cannot be read."""

    @abstractmethod
    async def save(self, binding: Binding) -> None:
        """Keep ``binding``, replacing the one saved before, whole or not at all."""
