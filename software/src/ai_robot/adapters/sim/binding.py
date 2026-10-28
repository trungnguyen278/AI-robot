# SPDX-License-Identifier: MIT
"""A simulated binding, kept in memory: a robot the simulated cloud knows."""

from __future__ import annotations

from ai_robot.ports.binding import Binding, BindingStore


class SimBindingStore(BindingStore):
    """Starts ``bound``, or not, with no server of its own; forgets on stop."""

    def __init__(self, *, bound: bool) -> None:
        self.binding = Binding(None, bound)

    async def load(self) -> Binding:
        return self.binding

    async def save(self, binding: Binding) -> None:
        self.binding = binding
